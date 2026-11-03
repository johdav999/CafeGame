    bool immediate=true;
    sim::WorkerId staff;
    std::unique_ptr<sim::TaskBoard> tasks;
    std::array<sim::TaskId,3> serviceWork{};
    sim::TaskId assistTask{};
    void createBoard() {
        tasks=std::make_unique<sim::TaskBoard>(runtime->epoch(),32);
        for(const auto& w:crew)require(tasks->addStaff({w.id,{staffRole(w.id)}}));
    }
    bool onShift() const {return onShift(staff);}
    void takeBreak() {
        staffBreak(staff);
    }
    sim::TaskId addTask(const char* key,const char* role,int priority,sim::Milliseconds duration,std::vector<sim::TaskId> dependencies={}) {
        (void)role;auto t=tasks->enqueue({key,"cafe:unassigned",priority,duration,std::move(dependencies)});require(t);return t.value;
    }
    void clearServiceWork() {
        if(serviceWork[0]) {
            auto first=tasks->task(serviceWork[0]);if(first && !sim::TaskBoard::terminal(first->state))require(tasks->cancel(first->id));
            for(auto id:std::array{serviceWork[2],assistTask,serviceWork[1],serviceWork[0]}) {auto t=tasks->task(id);if(t){if(!sim::TaskBoard::terminal(t->state))require(tasks->cancel(t->id));require(tasks->forget(t->id));}}
        }
        serviceWork={};assistTask={};
    }
    void beginServiceWork() {
        clearServiceWork();
        serviceWork[0]=addTask("cafe:collect","cafe:barista",20,immediate?0:500);
        serviceWork[1]=addTask("cafe:prepare","cafe:barista",20,0,{serviceWork[0]});
        if(extraStation)assistTask=addTask("cafe:assist","cafe:barista",20,0,{serviceWork[0]});
        std::vector<sim::TaskId> dependencies{serviceWork[1]};if(assistTask)dependencies.push_back(assistTask);
        serviceWork[2]=addTask("cafe:handover","cafe:barista",20,0,std::move(dependencies));
        workflowTick();
    }
    bool handoverReady() const {
        auto t=tasks->task(serviceWork[2]);return t && onShift(t->worker) && t->state==sim::TaskState::Running;
    }
    Guest* cleaningGuest(sim::TaskId id) {for(auto& g:guests)if(g.cleanup==id)return &g;return nullptr;}
    void workflowTick() {
        require(tasks->advance(runtime->time()));
        finishRestocks();
        for(int iteration=0;iteration<6;++iteration) {
            for(auto& worker:crew) {
                auto current=tasks->current(worker.id);
                if(current && current->state==sim::TaskState::Running && preparationTask(current->spec.key) && order) {
                    auto o=runtime->order(order);require(o);
                    if(o.value.state==sim::OrderState::Ready)require(tasks->complete(current->id,worker.id,current->token));
                }
                current=tasks->current(worker.id);
                if(worker.breakPending && (!current || !preparationTask(current->spec.key))) {
                    worker.breakPending=false;require(tasks->available(worker.id,false));
                }
            }
            scheduleStaff();assignProduction();
            if(!immediate)break;
            bool started=false;
            for(const auto& worker:crew) {
                auto current=tasks->current(worker.id);
                if(!current || current->state!=sim::TaskState::Assigned)continue;
                require(tasks->start(current->id,worker.id,current->token));started=true;
                if(current->spec.key=="cafe:collect" && current->remaining==0)require(tasks->complete(current->id,worker.id,current->token));
            }
            if(!started)break;
        }
        std::vector<sim::CustomerId> finished;
        for(auto& g:guests)if(g.cleanup) {
            auto t=tasks->task(g.cleanup);require(sim::Status{{},t?sim::Error::None:sim::Error::InvalidId});
            if(sim::TaskBoard::terminal(t->state)) {
                seats.release(g.id);require(tasks->forget(g.cleanup));g.cleanup={};
                if(g.hasDeparted)finished.push_back(g.id);
            }
        }
        for(auto id:finished)departed(id);
    }
    template<class Put> void saveWorkflows(Put put) const {
        auto text=[&](const std::string& value){put(value.size());for(unsigned char c:value)put(c);};
        put(staff.value);saveStaff(put);put(assistTask.value);for(auto id:serviceWork)put(id.value);
        for(const auto& g:guests){put(g.cleanup.value);put(g.hasDeparted);}
        auto s=tasks->snapshot();put(std::uint64_t(s.now));put(s.nextTask);put(s.staff.size());
        for(const auto& w:s.staff) {
            put(w.id.value);put(std::uint64_t(w.start));put(std::uint64_t(w.end));put(w.available);put(w.task.value);put(w.roles.size());
            for(const auto& role:w.roles)text(role);
        }
        put(s.tasks.size());
        for(const auto& t:s.tasks) {
            put(t.id.value);text(t.spec.key);text(t.spec.role);put(std::bit_cast<std::uint64_t>(std::int64_t(t.spec.priority)));
            put(std::uint64_t(t.spec.duration));put(t.spec.dependencies.size());for(auto id:t.spec.dependencies)put(id.value);
            put(std::uint64_t(t.state));put(t.worker.value);put(std::uint64_t(t.remaining));
        }
    }
    template<class Get> bool loadWorkflows(Get get,bool allowMaintenance=false,bool hasRoster=true,bool hasEquipment=true,bool hasSummer=false) {
        auto text=[&](){auto n=get();if(n>64)throw std::runtime_error("Workflow string limit");std::string value;while(n--){auto c=get();if(c>127)throw std::runtime_error("Invalid workflow key");value.push_back(char(c));}return value;};
        auto number=[&](){auto n=get();if(n>std::uint64_t(std::numeric_limits<std::int64_t>::max()))throw std::runtime_error("Workflow number overflow");return std::int64_t(n);};
        auto flag=[&](){auto n=get();if(n>1)throw std::runtime_error("Invalid workflow flag");return bool(n);};
        auto taskId=[&](){auto n=get();return sim::TaskId{n,n?runtime->epoch():0};};
        auto workerId=[&](){auto n=get();return sim::WorkerId{n,n?runtime->epoch():0};};
        staff=workerId();if(!runtime->worker(staff))return false;
        if(hasRoster){if(!loadStaff(get,hasSummer))return false;}else {crew={{staff,0}};restockWork={};}
        createBoard();
        if(hasEquipment)assistTask=taskId();
        for(auto& id:serviceWork)id=taskId();
        for(auto& g:guests){g.cleanup=taskId();g.hasDeparted=flag();}
        sim::WorkflowSnapshot s;s.now=number();s.nextTask=get();s.nextToken=s.nextTask;
        auto count=get();if(count!=crew.size())return false;
        for(std::size_t i=0;i<crew.size();++i) {
            sim::StaffSchedule w;w.id=workerId();w.start=number();w.end=number();w.available=flag();w.task=taskId();
            auto roles=get();if(roles!=(hasRoster?1:2))return false;while(roles--)w.roles.push_back(text());
            if(w.id!=crew[i].id || w.start!=0 || w.end!=std::numeric_limits<std::int64_t>::max())return false;
            if(!hasRoster){if(w.roles!=std::vector<std::string>{"cafe:barista","cafe:cleaner"})return false;w.roles={staffRole(w.id)};}
            else if(w.roles!=std::vector<std::string>{staffRole(w.id)})return false;
            s.staff.push_back(w);
        }
        count=get();if(count>32)return false;
        while(count--) {
            sim::WorkflowTask t;t.id=taskId();t.spec.key=text();t.spec.role=text();auto priority=std::bit_cast<std::int64_t>(get());
            if(priority<-100 || priority>100)return false;t.spec.priority=int(priority);t.spec.duration=number();
            auto deps=get();if(deps>8)return false;while(deps--)t.spec.dependencies.push_back(taskId());
            auto state=get();if(state>4)return false;t.state=sim::TaskState(state);t.worker=workerId();t.remaining=number();t.token=t.worker?t.id.value:0;s.tasks.push_back(t);
        }
        if(!hasRoster)for(auto& t:s.tasks)t.spec.role=t.worker?staffRole(t.worker):"cafe:unassigned";
        for(const auto& t:s.tasks)if(!validStaffRole(t.spec.role))return false;
        if(!tasks->restore(s) || tasks->time()!=runtime->time())return false;
        for(const auto& worker:crew)if(worker.breakPending && (!onShift(worker.id) || !tasks->current(worker.id) || !preparationTask(tasks->current(worker.id)->spec.key)))return false;
        std::vector<sim::TaskId> linked;
        const std::array<std::string,3> keys{"cafe:collect","cafe:prepare","cafe:handover"};
        if(serviceWork[0]) {
            if(!active())return false;
            for(std::size_t i=0;i<3;++i) {
                std::vector<sim::TaskId> deps=i?std::vector<sim::TaskId>{serviceWork[i-1]}:std::vector<sim::TaskId>{};if(i==2 && assistTask)deps.push_back(assistTask);
                auto t=tasks->task(serviceWork[i]);if(!t || t->spec.key!=keys[i] || t->spec.priority!=20 ||
                    (i && t->spec.duration!=0) || (!i && t->spec.duration!=0 && t->spec.duration!=500) ||
                    t->spec.dependencies!=deps || t->state==sim::TaskState::Cancelled)return false;
                linked.push_back(t->id);
            }
            auto prep=tasks->task(serviceWork[1]).value();auto hand=tasks->task(serviceWork[2]).value();
            if((prep.state==sim::TaskState::Completed || hand.state!=sim::TaskState::Queued) && !ready)return false;
            // A running preparation workflow can be walking to its next recipe
            // station while that core job is Assigned (multi-step tickets).
        } else if(serviceWork[1] || serviceWork[2] || assistTask || active())return false;
        if(assistTask) {
            auto t=tasks->task(assistTask);if(!extraStation || !t || t->spec.key!="cafe:assist" || t->spec.priority!=20 || t->spec.duration || t->spec.dependencies!=std::vector<sim::TaskId>{serviceWork[0]} || t->state==sim::TaskState::Cancelled)return false;
            if(t->state==sim::TaskState::Completed && !ready)return false;linked.push_back(t->id);
        }
        if(active() && bool(extraStation)!=bool(assistTask))return false;
        for(const auto& g:guests) {
            if(g.visit) {
                auto t=tasks->task(g.visit);
                if(!t || !g.tableService || g.rating || g.phase!=GuestPhase::Dining || t->spec.priority!=25 || t->spec.duration!=500 || !t->spec.dependencies.empty() ||
                   (t->spec.key!="cafe:take-order" && t->spec.key!="cafe:deliver") ||
                   (t->spec.key=="cafe:take-order" && g.orderTaken) || (t->spec.key=="cafe:deliver" && !g.prepared))return false;
                linked.push_back(g.visit);
            }
            if(g.hasDeparted && g.phase!=GuestPhase::Leaving)return false;
            if(g.cleanup) {
                auto t=tasks->task(g.cleanup);auto c=seats.claim(g.id);
                if(!t || g.phase!=GuestPhase::Leaving || !c || c->point==Pool::waiting || t->spec.key!="cafe:clean" || t->spec.duration!=1000 || t->spec.priority!=5 || !t->spec.dependencies.empty())return false;
                linked.push_back(t->id);
            } else if(g.phase==GuestPhase::Leaving && seats.claim(g.id))return false;
        }
        if(allowMaintenance)for(const auto& t:tasks->tasks())if(t.spec.key=="cafe:machine-clean" || t.spec.key=="cafe:machine-repair")linked.push_back(t.id);
        for(std::size_t n=0;n<ingredientCount();++n)if(restockWork[n]) {
            auto t=tasks->task(restockWork[n]);if(!t || t->spec.key!="cafe:restock-"+std::to_string(n) || t->spec.priority!=15 || t->spec.duration!=1500 || !t->spec.dependencies.empty() || t->state==sim::TaskState::Completed)return false;
            linked.push_back(t->id);
        }
        std::sort(linked.begin(),linked.end());return linked.size()==tasks->tasks().size() && std::adjacent_find(linked.begin(),linked.end())==linked.end();
    }
