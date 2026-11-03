    struct StaffMember {
        sim::WorkerId id{};
        int name=0;
        std::array<int,4> priorities{2,2,2,2}; // preparation, serving, restocking, cleaning
        std::int64_t worked=0,paid=0;
        bool breakPending=false;
    };
    std::vector<StaffMember> crew;
    std::array<sim::TaskId,8> restockWork{};
    std::int64_t retiredWorked=0,retiredWages=0;
    std::string staffMessage;
    static constexpr sim::Quantity hireCost=1500;
    static const char* staffName(int name) {return name==0?"Alex":name==1?"Sam":"Robin";}
    static std::string staffRole(sim::WorkerId id) {return "cafe:crew-"+std::to_string(id.value);}
    bool validStaffRole(const std::string& role) const {
        if(role=="cafe:unassigned")return true;
        for(const auto& w:crew)if(role==staffRole(w.id))return true;
        // Completed collect/prepare nodes can outlive a subsequently dismissed
        // idle owner until their dependent handover retires the graph.
        return role.starts_with("cafe:crew-") && role.size()>10 && role.size()<32 && std::all_of(role.begin()+10,role.end(),[](char c){return c>='0' && c<='9';});
    }
    StaffMember* member(sim::WorkerId id) {for(auto& w:crew)if(w.id==id)return &w;return nullptr;}
    const StaffMember* member(sim::WorkerId id) const {for(const auto& w:crew)if(w.id==id)return &w;return nullptr;}
    bool onShift(sim::WorkerId id) const {for(const auto& w:tasks->staff())if(w.id==id)return w.available;return false;}
    static int taskRole(std::string_view key) {
        if(key=="cafe:handover" || key=="cafe:take-order" || key=="cafe:deliver")return 1;
        if(key=="cafe:collect" || key.starts_with("cafe:restock-"))return 2;
        if(key=="cafe:clean")return 3;
        return 0;
    }
    static std::vector<std::string> baseStaffCapabilities() {return {"cafe:brew","cafe:water","cafe:steam","cafe:plate"};}
    std::vector<std::string> staffCapabilities() const {auto caps=baseStaffCapabilities();if(summerCatalog)caps.push_back("garden:cold");return caps;}
    bool hire() {
        if(summary())return false;
        staffMessage.clear();
        if(crew.size()>=3){staffMessage="The cafe supports three staff.";return false;}
        if(ledger->sequence("cafe:hires")>=10000){staffMessage="Hiring limit reached.";return false;}
        if(availableCash()<hireCost){staffMessage="Hiring costs 15.00 available cash after wages.";return false;}
        auto payment=ledger->prepare("cafe:hires",ledger->sequence("cafe:hires")+1,-hireCost,runtime->time());if(!payment)return false;
        crew.reserve(3);auto worker=runtime->createWorker(staffCapabilities());if(!worker)return false;
        auto added=tasks->addStaff({worker.value,{staffRole(worker.value)}});
        if(!added){require(runtime->removeWorker(worker.value));return false;}
        int name=0;while(std::any_of(crew.begin(),crew.end(),[&](const auto& w){return w.name==name;}))++name;
        crew.push_back({worker.value,name});require(runtime->setAvailable(worker.value,false));
        require(ledger->commit(std::move(payment.value)));syncCash();runtime->drainEvents();staffMessage="Staff hired. Wages are 1.00 per on-shift minute each.";workflowTick();return true;
    }
    bool dismiss(sim::WorkerId id) {
        if(summary())return false;
        staffMessage.clear();auto* w=member(id);
        if(!w || crew.size()<=1){staffMessage="Keep at least one staff member.";return false;}
        if(tasks->current(id) || runtime->worker(id).value.job){staffMessage="Dismissal requires an idle worker.";return false;}
        if(wagesDue()>ledger->balance()){staffMessage="Pay outstanding wages before dismissal.";return false;}
        auto s=tasks->snapshot();std::erase_if(s.staff,[&](const auto& row){return row.id==id;});
        // A detached board validates removal before either owner publishes it.
        sim::TaskBoard candidate(runtime->epoch(),32);if(!candidate.restore(s))return false;
        settleWages();retiredWorked+=w->worked;retiredWages+=w->paid;
        require(runtime->removeWorker(id));require(tasks->restore(std::move(s)));
        std::erase_if(crew,[&](const auto& row){return row.id==id;});staff=crew.front().id;
        runtime->drainEvents();staffMessage="Idle staff dismissed. Hiring fees are not refunded.";workflowTick();return true;
    }
    bool setPriority(sim::WorkerId id,int role,int value) {
        if(summary())return false;
        auto* w=member(id);if(!w || role<0 || role>=4 || value<0 || value>3)return false;
        w->priorities[std::size_t(role)]=value;staffMessage="Priorities apply to the next task; current work is preserved.";workflowTick();return true;
    }
    bool staffBreak(sim::WorkerId id) {
        if(summary())return false;
        auto* w=member(id);if(!w)return false;
        if(w->breakPending){w->breakPending=false;staffMessage="Scheduled break cancelled.";return true;}
        if(!onShift(id)){require(tasks->available(id,true));staffMessage="Staff resumed work.";workflowTick();return true;}
        auto job=runtime->worker(id);require(job);
        if(job.value.job){w->breakPending=true;staffMessage="Break scheduled after this ticket's preparation; equipment claims remain guarded.";return true;}
        require(tasks->available(id,false));require(runtime->setAvailable(id,false));runtime->drainEvents();
        staffMessage="Staff on break. Interrupted timed work can be reassigned.";workflowTick();return true;
    }
    // Per-worker priorities are cafe policy. Retarget only queued tasks through
    // the board's validated snapshot API; TaskBoard still owns dependencies,
    // claims, assignment tokens, interruption and remaining work.
    void scheduleStaff() {
        auto s=tasks->snapshot();std::array<bool,3> taken{};bool changed=false;
        std::vector<std::string> roles(s.tasks.size(),"cafe:unassigned");
        // Choose employee/task pairs by personal role priority, then task urgency,
        // stable task ID and stable employee ID. Off always excludes new work.
        for(std::size_t choice=0;choice<crew.size();++choice) {
            int selectedTask=-1,selectedWorker=-1,best=-1000000;
            for(std::size_t n=0;n<s.tasks.size();++n) {
                const auto& task=s.tasks[n];if(task.state!=sim::TaskState::Queued || roles[n]!="cafe:unassigned")continue;
                bool ready=true;for(auto dep:task.spec.dependencies){auto t=tasks->task(dep);if(!t || t->state!=sim::TaskState::Completed)ready=false;}
                if(!ready)continue;
                sim::WorkerId retained{};
                if(!extraStation && task.spec.key=="cafe:prepare")for(auto id:productionJobs()){auto job=runtime->job(id).value;if(job.state==sim::JobState::Assigned || job.state==sim::JobState::Running){retained=job.worker;break;}}
                for(std::size_t i=0;i<crew.size();++i) {
                    const auto& w=crew[i];auto entry=std::find_if(s.staff.begin(),s.staff.end(),[&](const auto& row){return row.id==w.id;});
                    if(taken[i] || entry==s.staff.end() || !entry->available || entry->task || w.breakPending || (retained && w.id!=retained))continue;
                    int preference=retained?3:w.priorities[std::size_t(taskRole(task.spec.key))];if(!preference)continue;
                    int score=preference*1000+task.spec.priority;
                    if(score>best){best=score;selectedTask=int(n);selectedWorker=int(i);}
                }
            }
            if(selectedTask<0)break;
            roles[std::size_t(selectedTask)]=staffRole(crew[std::size_t(selectedWorker)].id);taken[std::size_t(selectedWorker)]=true;
        }
        for(std::size_t n=0;n<s.tasks.size();++n)if(s.tasks[n].state==sim::TaskState::Queued && s.tasks[n].spec.role!=roles[n]){s.tasks[n].spec.role=std::move(roles[n]);changed=true;}
        if(changed)require(tasks->restore(std::move(s)));
        require(tasks->assign(runtime->time()));
    }
    sim::WorkerId preparingStaff() const {
        auto t=tasks->task(serviceWork[1]);return t && (t->state==sim::TaskState::Assigned || t->state==sim::TaskState::Running)?t->worker:sim::WorkerId{};
    }
    void assignProduction() {
        bool any=false;
        for(const auto& w:crew){auto task=tasks->current(w.id);bool enabled=task && preparationTask(task->spec.key) && onShift(w.id);any|=enabled;auto core=runtime->worker(w.id);require(core);if(core.value.available!=enabled)require(runtime->setAvailable(w.id,enabled));}
        if(any && active()){require(runtime->assign(immediate));observeBrew();}
        runtime->drainEvents();
    }
    bool requestRestock(int index) {
        if(summary())return false;
        if(index<0 || index>=int(ingredientCount()) || restockWork[std::size_t(index)])return false;
        auto source=restockSource(std::size_t(index));auto from=runtime->stock(source,ingredient(std::size_t(index))).value,to=runtime->stock(inventory,ingredient(std::size_t(index))).value;
        if(!from.available() || to.capacity-to.total-to.reservedCapacity<=0)return false;
        auto t=tasks->enqueue({"cafe:restock-"+std::to_string(index),"cafe:unassigned",15,1500,{}});if(!t)return false;
        restockWork[std::size_t(index)]=t.value;restockAnnex[std::size_t(index)]=source==annex;return true;
    }
    void finishRestocks() {
        for(std::size_t n=0;n<ingredientCount();++n)if(restockWork[n]) {
            auto t=tasks->task(restockWork[n]);require(sim::Status{{},t?sim::Error::None:sim::Error::InvalidId});
            if(t->state==sim::TaskState::Completed)transferIngredient(int(n),restockAnnex[n]?annex:storage);
            if(sim::TaskBoard::terminal(t->state)){require(tasks->forget(t->id));restockWork[n]={};restockAnnex[n]=false;}
        }
    }
    sim::Quantity expectedWages() const {
        auto total=retiredWages;for(const auto& w:crew)total+=(w.worked/60000)*100;return total;
    }
    void accrueStaff(sim::Milliseconds elapsed) {for(auto& w:crew)if(onShift(w.id)){w.worked+=elapsed;staffedMs+=elapsed;}}
    template<class Put> void saveStaff(Put put) const {
        put(crew.size());put(retiredWorked);put(retiredWages);
        for(const auto& w:crew){put(w.id.value);put(w.name);put(w.worked);put(w.paid);put(w.breakPending);for(auto p:w.priorities)put(p);}
        for(auto id:restockWork)put(id.value);
    }
    template<class Get> bool loadStaff(Get get,bool hasSummer=false) {
        auto count=get(),worked=get(),paid=get();if(count<1 || count>3 || worked>1800000000000ULL || paid>1000000000)return false;
        crew.clear();retiredWorked=std::int64_t(worked);retiredWages=std::int64_t(paid);
        while(count--) {
            auto id=get(),name=get(),time=get(),wages=get(),pendingBreak=get();
            if(!id || id>10001 || name>2 || time>600000000000ULL || time>std::uint64_t(runtime->time()) || wages>1000000000 || wages%100 || pendingBreak>1 || (!crew.empty() && id<=crew.back().id.value))return false;
            StaffMember w{{id,runtime->epoch()},int(name),{},std::int64_t(time),std::int64_t(wages),bool(pendingBreak)};
            for(auto& p:w.priorities){auto value=get();if(value>3)return false;p=int(value);}
            if(!runtime->worker(w.id) || wages>std::uint64_t(time/60000)*100 || std::any_of(crew.begin(),crew.end(),[&](const auto& row){return row.name==w.name;}))return false;
            crew.push_back(w);
        }
        for(std::size_t n=0;n<(hasSummer?8u:5u);++n){auto value=get();restockWork[n]={value,value?runtime->epoch():0};}
        return crew.front().id==staff;
    }
