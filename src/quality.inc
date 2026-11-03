    static constexpr std::size_t qualitySaveBytes=13*8;
    sim::Condition machineCondition;
    std::optional<sim::Freshness> drink;
    int batchQuality=0;
    std::int64_t wasted=0;
    enum class Maintenance {None,Clean,Repair,QueuedClean,QueuedRepair};
    static constexpr int machineMinimum=200;
    bool maintenanceQueued() const {return maintenance==Maintenance::QueuedClean || maintenance==Maintenance::QueuedRepair;}
    sim::TaskId maintenanceTask;
    Maintenance maintenance=Maintenance::None;
    sim::Quantity maintenanceCost=0;
    bool qualitySuspended=false;
    std::string qualityMessage;
    bool machineUsable() const {auto s=machineCondition.snapshot();return s.integrity>=machineMinimum && s.cleanliness>=machineMinimum && !maintenanceTask;}
    void observeBrew() {
        if(qualitySuspended)return;
        drink.reset();batchQuality=0;if(!order)return;
        auto o=runtime->order(order);require(o);
        for(std::size_t n=0;n<o.value.jobs.size();++n) {
            auto& item=items[n];if(item.product<0)continue;
            auto j=runtime->job(o.value.jobs[n]);require(j);
            if(!item.used && (item.product==0 || item.shot)) {
                auto source=runtime->job(item.shot?item.shot:j.value.id);require(source);
                if(source.value.state==sim::JobState::Running || source.value.state==sim::JobState::Completed || source.value.deadline>0) {
                    auto state=machineCondition.snapshot();item.quality=std::min(state.integrity,state.cleanliness);item.used=true;
                    require(machineCondition.use(state.lastUse+1,shotWear(),shotDirt()));
                }
            }
            if(j.value.state==sim::JobState::Completed)item.madeAt=j.value.deadline;
            batchQuality=batchQuality?std::min(batchQuality,item.quality):item.quality;
            if(o.value.state==sim::OrderState::Ready && item.madeAt>=0) {
                sim::Freshness fresh{item.madeAt,definitions::menu[std::size_t(item.product)].lifetime,item.quality};
                if(!drink || fresh.sample(runtime->time()).value.score<drink->sample(runtime->time()).value.score)drink=fresh;
            }
        }
    }
    bool requestMaintenance(Maintenance kind) {
        if(summary())return false;
        qualityMessage.clear();
        if((kind!=Maintenance::Clean && kind!=Maintenance::Repair) || maintenance!=Maintenance::None)return false;
        auto state=machineCondition.snapshot();
        if((kind==Maintenance::Clean && state.cleanliness==1000) || (kind==Maintenance::Repair && state.integrity==1000))return false;
        sim::Quantity cost=kind==Maintenance::Repair?repairPrice():0;
        if(cost>availableCash()){qualityMessage=fastMachine?"A repair needs 7.50 available cash.":"A repair needs 5.00 available cash.";return false;}
        if(active()) {
            maintenance=kind==Maintenance::Clean?Maintenance::QueuedClean:Maintenance::QueuedRepair;
            qualityMessage="Machine care queued after the current ticket. No payment until work can start.";
            return true;
        }
        sim::Result<sim::Ledger::Prepared> payment;
        if(cost){payment=ledger->prepare("cafe:maintenance",ledger->sequence("cafe:maintenance")+1,-cost,runtime->time());if(!payment){qualityMessage=std::string(sim::describe(payment.error));return false;}}
        auto task=tasks->enqueue({kind==Maintenance::Clean?"cafe:machine-clean":"cafe:machine-repair","cafe:barista",30,kind==Maintenance::Clean?2000:4000,{}});
        if(!task)return false;
        if(cost)require(ledger->commit(std::move(payment.value)));
        maintenanceTask=task.value;maintenance=kind;maintenanceCost=cost;syncCash();workflowTick();return true;
    }
    bool cancelMaintenance() {
        if(maintenanceQueued()){maintenance=Maintenance::None;qualityMessage="Queued machine care cancelled.";return true;}
        auto task=tasks->task(maintenanceTask);if(!task || sim::TaskBoard::terminal(task->state))return false;
        sim::Result<sim::Ledger::Prepared> refund;
        if(maintenanceCost){refund=ledger->prepare("cafe:repair-refunds",ledger->sequence("cafe:repair-refunds")+1,maintenanceCost,runtime->time());if(!refund)return false;}
        require(tasks->cancel(maintenanceTask));
        if(maintenanceCost)require(ledger->commit(std::move(refund.value)));
        maintenanceCost=0;require(tasks->forget(maintenanceTask));maintenanceTask={};maintenance=Maintenance::None;
        syncCash();settleWages();return true;
    }
    void qualityTick() {
        observeBrew();
        if(maintenanceQueued() && !active()) {
            auto queued=maintenance;
            maintenance=Maintenance::None;
            if(!requestMaintenance(queued==Maintenance::QueuedClean?Maintenance::Clean:Maintenance::Repair))maintenance=queued;
        }
        if(maintenanceTask) {
            auto task=tasks->task(maintenanceTask);if(!task)throw std::runtime_error("Missing machine task");
            if(task->state==sim::TaskState::Completed) {
                if(maintenance==Maintenance::Clean)machineCondition.clean();else machineCondition.repair();
                maintenanceCost=0;require(tasks->forget(maintenanceTask));maintenanceTask={};maintenance=Maintenance::None;
            }
        }
        if(active())for(const auto& item:items)if(item.product>=0) {
            bool expired=item.madeAt>=0 && runtime->time()>=item.madeAt+definitions::menu[std::size_t(item.product)].lifetime;
            if(item.shot && item.madeAt<0) {
                auto shot=runtime->job(item.shot);require(shot);
                auto o=runtime->order(order).value;
                auto n=std::size_t(&item-items.data());auto final=runtime->job(o.jobs[n]).value;
                expired|=shot.value.state==sim::JobState::Completed && final.state<=sim::JobState::Assigned && runtime->time()>=shot.value.deadline+45000;
            }
            if(expired){qualityMessage="An item expired. The ticket was cancelled and prepared items discarded.";leave(customer);break;}
        }
        // Cancelled/abandoned drinks are discarded, never silently served later.
        for(std::size_t p=0;p<(summerCatalog?8u:5u);++p) {
            auto resource=productResource(int(p));auto loose=runtime->stock(inventory,resource);require(loose);
            if(loose.value.available()) {auto count=loose.value.available();require(runtime->remove(inventory,std::array{sim::Amount{resource,count}}));wasted+=count;}
        }
        runtime->drainEvents();refresh();
    }
    template<class Put> void saveQuality(Put put) const {
        auto state=machineCondition.snapshot();put(state.integrity);put(state.cleanliness);put(state.lastUse);put(state.uses);
        put(batchQuality);put(bool(drink));put(drink?drink->madeAt:0);put(wasted);put(maintenanceTask.value);put(std::uint64_t(maintenance));put(maintenanceCost);
        put(drink?drink->lifetime:0);put(drink?drink->baseQuality:0);
    }
    template<class Get> bool loadQuality(Get get) {
        auto integrity=get(),cleanliness=get(),last=get(),uses=get(),base=get(),hasDrink=get(),made=get(),waste=get(),task=get(),kind=get(),cost=get();
        if(integrity>1000 || cleanliness>1000 || base>1000 || hasDrink>1 || made>std::uint64_t(runtime->time()) || waste>1000000000 || kind>4 || cost>750 || (kind<=2?bool(task)!=bool(kind):bool(task)||bool(cost)))return false;
        if(!machineCondition.restore({int(integrity),int(cleanliness),last,uses}))return false;
        batchQuality=int(base);wasted=std::int64_t(waste);maintenanceTask={task,task?runtime->epoch():0};maintenance=Maintenance(kind);maintenanceCost=std::int64_t(cost);
        auto lifetime=get(),drinkQuality=get();
        if(lifetime>120000 || drinkQuality>1000 || (!hasDrink && (made || lifetime || drinkQuality)))return false;
        if(hasDrink){drink=sim::Freshness{std::int64_t(made),std::int64_t(lifetime),int(drinkQuality)};if(!drink->valid())return false;}else drink.reset();
        std::size_t linked=0;
        for(const auto& t:tasks->tasks())if(t.spec.key=="cafe:machine-clean" || t.spec.key=="cafe:machine-repair") {
            ++linked;if(t.id!=maintenanceTask || active() || sim::TaskBoard::terminal(t.state) ||
                t.spec.key!=(maintenance==Maintenance::Clean?"cafe:machine-clean":"cafe:machine-repair") || !validStaffRole(t.spec.role) || t.spec.priority!=30 ||
                t.spec.duration!=(maintenance==Maintenance::Clean?2000:4000) || !t.spec.dependencies.empty())return false;
        }
        if(linked!=std::size_t(bool(maintenanceTask)) || maintenanceCost!=(maintenance==Maintenance::Repair?repairPrice():0) ||
           debited("cafe:maintenance")-credited("cafe:repair-refunds")<maintenanceCost)return false;
        return true; // Per-item/core relationships are checked by loadMenu.
    }
    void migrateQuality() {
        qualitySuspended=false;
        if(order) {
            auto o=runtime->order(order).value;auto j=runtime->job(o.jobs.front()).value;
            if(j.state==sim::JobState::Running || j.state==sim::JobState::Completed || j.deadline>0) {
                require(machineCondition.restore({1000,1000,j.id.value,1}));batchQuality=1000;
                if(ready)drink=sim::Freshness{j.deadline,45000,1000};
            }
        }
    }
