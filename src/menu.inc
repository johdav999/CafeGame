    // Game-owned ticket intent and per-item presentation/quality. Core orders
    // own finished output claims; intermediate jobs exist only for this ticket.
    std::array<PreparedItem,2> items{};
    std::string menuMessage;
    std::size_t menuSaveBytes() const {return (1+guests.size()*3+2*5)*8;}
    static bool validTicket(std::array<int,2> ticket) {
        return ticket[0]>=0 && ticket[0]<8 && ticket[1]>=-1 && ticket[1]<8 && ticket[0]!=ticket[1];
    }
    static const sim::ResourceId& ingredient(std::size_t n) {return definitions::resources[std::size_t(definitions::ingredients[n].resource)];}
    static const sim::ResourceId& productResource(int p) {return definitions::resources[std::size_t(definitions::menu[std::size_t(p)].resource)];}
    static sim::Quantity ticketPrice(std::array<int,2> ticket) {
        sim::Quantity price=0;for(int p:ticket)if(p>=0)price+=definitions::menu[std::size_t(p)].price;return price;
    }
    bool welcomeMenu(int profile,int seatingPreference=-1) {
        if(summerProgress() && admitted%3!=0) {
            const int first=coldStation?(admitted%2?5:6):7;
            return welcome(profile,first,coldStation && admitted%2?7:4,true,seatingPreference);
        }
        if(campaign.enabled) {
            int first=profile==1?1:profile==2?2:0;
            if(!unlocked(first))first=0;
            return welcome(profile,first,admitted%2?4:-1,true,seatingPreference);
        }
        // Deterministic profile-specific rotation; RNG still owns arrival/profile
        // choices. Direct welcome(profile, first, second) is the practice adapter.
        auto n=admitted;
        if(profile==1)return welcome(profile,n%2?1:2,n%2?4:-1,true,seatingPreference);
        if(profile==2)return welcome(profile,n%3?2:0,-1,true,seatingPreference);
        switch(n%5) {
            case 0:return welcome(profile,0,-1,true,seatingPreference);
            case 1:return welcome(profile,1,-1,true,seatingPreference);
            case 2:return welcome(profile,2,4,true,seatingPreference);
            case 3:return welcome(profile,3,4,true,seatingPreference);
            default:return welcome(profile,4,-1,true,seatingPreference);
        }
    }
    int nextProduct() const {
        for(const auto& g:guests)if(g.id==nextCustomer())return g.items[0];
        return 0;
    }
    std::array<int,2> nextTicket() const {
        for(const auto& g:guests)if(g.id==nextCustomer())return g.items;
        return {0,-1};
    }
    std::vector<sim::Amount> ticketInputs(std::array<int,2> ticket) const {
        std::array<sim::Quantity,8> counts{};
        for(int p:ticket)if(p>=0) {
            const auto& recipe=definitions::processes[std::size_t(p>=5?p+3:p)];
            if(definitions::menu[std::size_t(p)].shot)++counts[0];
            for(const auto& a:recipe.inputs)for(std::size_t n=0;n<counts.size();++n)if(a.resource==ingredient(n))counts[n]+=a.quantity;
        }
        std::vector<sim::Amount> result;for(std::size_t n=0;n<counts.size();++n)if(counts[n])result.push_back({ingredient(n),counts[n]});return result;
    }
    std::vector<std::size_t> ticketShortages(std::array<int,2> ticket) const {
        std::vector<std::size_t> result;
        for(const auto& amount:ticketInputs(ticket)) {
            auto stock=runtime->stock(inventory,amount.resource);require(stock);
            if(stock.value.available()>=amount.quantity)continue;
            for(std::size_t n=0;n<ingredientCount();++n)
                if(amount.resource==ingredient(n))result.push_back(n);
        }
        return result;
    }
    std::string prepareReason(int product) const {
        auto gate=recipeReason(product);if(!gate.empty())return gate;
        if(closed && !nextCustomer())return "Open service before preparing tickets.";
        if(active())return "Finish or cancel the current ticket.";
        if(product!=nextProduct())return "Prepare the first item on the next guest's ticket.";
        if(maintenance!=Maintenance::None)return "Wait for or cancel machine care.";
        if(!nextCustomer() && !immediate && !visitorRoom())return "Cafe visitor limit reached; wait for a guest to leave.";
        if(!nextCustomer() && (guests.size()>=maximumVisitors || admitted>=8000000))return "Wait for a departing guest to leave.";
        auto ticket=nextTicket();int uses=0;
        for(int p:ticket)if(p==0 || (p>=0 && definitions::menu[std::size_t(p)].shot))++uses;
        auto condition=machineCondition.snapshot();
        if(uses && condition.integrity<machineMinimum+(uses-1)*shotWear())return "Repair the machine before this ticket.";
        if(uses && condition.cleanliness<machineMinimum+(uses-1)*shotDirt())return "Clean the machine before this ticket.";
        const auto shortages=ticketShortages(ticket);
        if(!shortages.empty())return "Restock "+std::string(definitions::ingredients[shortages.front()].name)+" for this ticket.";
        return {};
    }
    std::vector<sim::JobId> productionJobs() const {
        std::vector<sim::JobId> jobs;
        if(order){auto o=runtime->order(order);require(o);jobs=o.value.jobs;}
        for(const auto& item:items)if(item.shot)jobs.push_back(item.shot);
        return jobs;
    }
    sim::JobId productionJob(sim::WorkerId owner={}) const {
        auto jobs=productionJobs();
        for(auto id:jobs) {auto j=runtime->job(id);require(j);if((!owner || j.value.worker==owner) && (j.value.state==sim::JobState::Assigned || j.value.state==sim::JobState::Running))return id;}
        if(owner)return {};
        for(auto id:jobs) {auto j=runtime->job(id);require(j);if(j.value.state==sim::JobState::Queued)return id;}
        return jobs.empty()?sim::JobId{}:jobs.front();
    }
    void retireShots() {
        for(auto& item:items)if(item.shot) {
            auto j=runtime->job(item.shot);require(j);
            if(j.value.state<=sim::JobState::Running)require(runtime->cancel(item.shot));
            require(runtime->forgetJob(item.shot));item.shot={};
        }
        auto shot=runtime->stock(inventory,definitions::resources[10]);require(shot);
        if(shot.value.available()) {require(runtime->remove(inventory,std::array{sim::Amount{definitions::resources[10],shot.value.available()}}));wasted+=shot.value.available();}
        for(auto& w:crew)if(w.breakPending && !tasks->current(w.id) && !runtime->worker(w.id).value.job) {
            w.breakPending=false;require(tasks->available(w.id,false));require(runtime->setAvailable(w.id,false));
        }
    }
    template<class Put> void saveMenu(Put put) const {
        put(guests.size());for(const auto& g:guests){put(g.id.value);put(g.items[0]);put(std::uint64_t(g.items[1]+1));}
        for(const auto& i:items){put(std::uint64_t(i.product+1));put(i.quality);put(i.shot.value);put(i.used);put(std::uint64_t(i.madeAt+1));}
    }
    template<class Get> bool loadMenu(Get get,bool hasEquipment=true) {
        if(get()!=guests.size())return false;
        for(auto& g:guests) {
            auto id=get(),first=get(),second=get();if(id!=g.id.value || first>7 || second>8 || (!summerCatalog && (first>4 || second>5)))return false;
            g.items={int(first),int(second)-1};if(!validTicket(g.items))return false;
            auto c=runtime->customer(g.id);require(c);
            if(g.tableService && (profiles[std::size_t(g.profile)].takeaway || g.phase==GuestPhase::Queue || g.phase==GuestPhase::Counter))return false;
            if(g.tableService && c.value.state==sim::CustomerState::InService && g.id!=customer && !g.prepared)return false;
            if(c.value.order) {
                auto o=runtime->order(c.value.order);require(o);
                if(o.value.price!=ticketPrice(g.items) || o.value.lines.size()!=std::size_t(g.items[1]<0?1:2))return false;
                for(std::size_t n=0;n<o.value.lines.size();++n) {
                    int p=g.items[n];const auto& line=o.value.lines[n];
                    if(line.item!=productResource(p) || line.quantity!=1 || line.process!=productRecipe(p))return false;
                    if(g.prepared) {
                        const auto& item=g.tray[n];auto job=runtime->job(o.value.jobs[n]);
                        if(item.product!=p || item.shot || !job || job.value.state!=sim::JobState::Completed || item.madeAt!=job.value.deadline || item.madeAt<0)return false;
                    }
                }
                if(g.prepared && g.items[1]<0 && g.tray[1].product!=-1)return false;
            }
        }
        for(auto& i:items) {
            auto p=get(),q=get(),shot=get(),used=get(),made=get();
            if(p>(summerCatalog?8u:5u) || q>1000 || used>1 || made>std::uint64_t(runtime->time())+1)return false;
            i={int(p)-1,int(q),{shot,shot?runtime->epoch():0},bool(used),std::int64_t(made)-1};
            if(i.product<0 && (q!=1000 || shot || used || made))return false;
        }
        if(order) {
            auto o=runtime->order(order).value;auto* visitor=guest(customer);
            if(!visitor || o.jobs.size()!=o.lines.size())return false;
            for(std::size_t n=0;n<2;++n) {
                const auto& item=items[n];if(item.product!=visitor->items[n])return false;
                if(item.product<0)continue;
                auto j=runtime->job(o.jobs[n]);if(!j || j.value.process!=productRecipe(item.product) || j.value.input!=inventory || j.value.output!=inventory)return false;
                if(item.product>=3 && item.product!=5 && (item.used || item.quality!=1000))return false;
                bool completed=j.value.state==sim::JobState::Completed;
                if(completed!=(item.madeAt>=0) || (completed && item.madeAt!=j.value.deadline))return false;
                const bool needsShot=definitions::menu[std::size_t(item.product)].shot;
                if(bool(item.shot)!=(needsShot && active()))return false;
                auto source=j;
                if(item.shot){source=runtime->job(item.shot);if(!source || source.value.order || source.value.state>=sim::JobState::Cancelled || source.value.process!=shotRecipe() || source.value.input!=inventory || source.value.output!=inventory)return false;}
                bool started=source.value.state==sim::JobState::Running || source.value.state==sim::JobState::Completed || source.value.deadline>0;
                if((item.product==0 || item.shot) && item.used!=started)return false;
                if(!item.used && item.quality!=1000)return false;
                if(needsShot && started && !item.used && active())return false;
                if(needsShot && completed && !item.used)return false;
            }
            if(items[0].shot && items[0].shot==items[1].shot)return false;
        } else for(const auto& i:items)if(i.product>=0)return false;
        // Validate capacities and all retained records, including unlinked work.
        std::size_t jobCount=0,orderCount=0;
        for(const auto& g:guests) {auto c=runtime->customer(g.id).value;if(c.order){auto o=runtime->order(c.order).value;jobCount+=o.jobs.size();++orderCount;}}
        for(const auto& i:items)jobCount+=bool(i.shot);
        auto metrics=runtime->metrics();if(metrics.jobs!=jobCount || metrics.orders!=orderCount || metrics.customers!=guests.size() || metrics.inventories!=(hasEquipment?3:2) || metrics.stations!=4+std::size_t(bool(extraStation))+std::size_t(bool(coldStation)) || metrics.workers!=crew.size() || metrics.reservations!=std::size_t(bool(incomingSupply())))return false;
        for(std::size_t n=0;n<resourceCount();++n) {const auto& r=definitions::resources[n];
            auto s=runtime->stock(inventory,r);if(!s || s.value.capacity!=(r==beans?100:r==definitions::resources[10]?2:24))return false;
        }
        if(bool(drink)!=ready)return false;
        auto saved=drink;auto base=batchQuality;qualitySuspended=false;observeBrew();
        if(bool(saved)!=bool(drink) || base!=batchQuality || (saved && (saved->madeAt!=drink->madeAt || saved->baseQuality!=drink->baseQuality || saved->lifetime!=drink->lifetime)))return false;
        return true;
    }
