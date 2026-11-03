    // Table visits are independent of the single production station's ticket.
    // Ready orders retain their runtime output reservations until delivered.
    sim::CustomerId preparationChoice{};
    const char* seatingPreferenceName(const Guest& g) const {return g.seatingPreference?"Outdoors":"Indoors";}
    std::string tableDestination(const Guest& g) const {
        if(!g.tableService)return "Counter";
        auto c=seats.claim(g.id);
        if(!c && g.phase==GuestPhase::Leaving)return "Exit";
        if(!c || c->point==Pool::waiting)return "Waiting for a table";
        return c->point<4?"Indoor table "+std::to_string(c->point+1):"Outdoor table "+std::to_string(c->point-3);
    }
    std::string tableServiceReason(const Guest& g) const {
        if(!g.tableService || g.rating)return {};
        if(g.phase==GuestPhase::ToSeat){auto c=seats.claim(g.id);return c && c->point!=Pool::waiting?"Walking to "+tableDestination(g):"All tables are occupied or awaiting cleaning; waiting in arrival order.";}
        if(auto t=tasks->task(g.visit))return t->state==sim::TaskState::Assigned?"Staff walking to "+tableDestination(g):t->state==sim::TaskState::Queued?"Waiting for an available staff member with the serving role enabled.":"Staff working at "+tableDestination(g);
        return {};
    }
    std::string staffDestination(sim::WorkerId worker) const {
        auto t=tasks->current(worker);if(!t)return {};
        for(const auto& g:guests)if(g.visit==t->id || g.cleanup==t->id)return tableDestination(g);
        if(auto id=productionJob(worker);coldStation && id && runtime->job(id).value.station==coldStation)return "Cold-preparation station";
        return "Indoor counter / equipment";
    }
    std::string tableStatus(const Guest& g) const {
        if(g.phase==GuestPhase::Leaving)return "Leaving";
        if(g.rating)return "Enjoying visit";
        if(!g.tableService)return g.id==customer?(ready?"Ready to serve":"Preparing"):"Waiting";
        if(g.phase==GuestPhase::ToSeat)return "Waiting for a table";
        if(g.visit){auto t=tasks->task(g.visit);return t && t->spec.key=="cafe:deliver"?"Serving":"Taking order";}
        if(g.prepared)return "Ready to serve";
        if(g.id==customer && active())return "Preparing";
        return g.orderTaken?"Waiting for serving":"Waiting to order";
    }
    sim::CustomerId nextCustomer() const {
        auto waiting=[&](const Guest& g){auto c=runtime->customer(g.id);return c && c.value.state==sim::CustomerState::Waiting;};
        for(const auto& g:guests)if(g.id==preparationChoice && waiting(g) && (!g.tableService || g.orderTaken))return g.id;
        for(const auto& g:guests)if(waiting(g) && g.tableService && g.orderTaken)return g.id;
        if(!queue.claims().empty())return queue.claims().front().owner;
        // The synchronous console adapter may collect at the same instant.
        for(const auto& g:guests)if(waiting(g) && g.tableService)return g.id;
        return {};
    }
    Guest* visitingGuest(sim::TaskId task) {for(auto& g:guests)if(g.visit==task)return &g;return nullptr;}
    void clearVisit(Guest& g) {
        if(auto t=tasks->task(g.visit)) {
            if(!sim::TaskBoard::terminal(t->state))require(tasks->cancel(t->id));
            require(tasks->forget(t->id));
        }
        g.visit={};
    }
    bool collectOrder(sim::CustomerId id) {
        auto* g=guest(id);
        if(summary() || !g || !g->tableService || g->phase!=GuestPhase::Dining || g->rating || g->orderTaken || g->visit)return false;
        g->visit=addTask("cafe:take-order","cafe:barista",25,500);
        workflowTick();return true;
    }
    bool prepareGuest(sim::CustomerId id,bool instant=false) {
        auto* g=guest(id);
        if(!g || g->rating || !g->tableService || !g->orderTaken || g->phase!=GuestPhase::Dining || g->prepared || g->visit)return false;
        auto c=runtime->customer(id);if(!c || c.value.state!=sim::CustomerState::Waiting)return false;
        preparationChoice=id;bool result=prepare(g->items[0],instant);preparationChoice={};return result;
    }
    bool requestServing(sim::CustomerId id) {
        auto* g=guest(id);
        if(summary() || !g || !g->prepared || g->visit || g->rating || g->phase!=GuestPhase::Dining)return false;
        g->visit=addTask("cafe:deliver","cafe:barista",25,500);
        workflowTick();return true;
    }
    bool deliverPrepared(Guest& g) {
        auto o=runtime->order(g.prepared);
        if(!o || o.value.state!=sim::OrderState::Ready)return false;
        auto saved=drink;drink.reset();
        for(const auto& item:g.tray)if(item.product>=0) {
            sim::Freshness fresh{item.madeAt,definitions::menu[std::size_t(item.product)].lifetime,item.quality};
            if(!drink || fresh.sample(runtime->time()).value.score<drink->sample(runtime->time()).value.score)drink=fresh;
        }
        auto inputs=satisfactionInputs(g);drink=saved;
        auto rating=sim::satisfaction(inputs,profiles[std::size_t(g.profile)].weights);require(rating);
        auto payment=ledger->prepare("cafe:sales",runtime->receiptSequence()+1-legacyServed,o.value.price,runtime->time());
        if(!payment)return false;
        auto delivered=runtime->deliver(g.prepared);if(!delivered)return false;
        require(ledger->commit(std::move(payment.value)));++served;lastPaid=delivered.value.value;syncCash();
        startDining(g);recordReview(g,1,rating.value,inputs);g.prepared={};g.tray={};payments();runtime->drainEvents();return true;
    }
    void tableServiceTick() {
        for(auto& g:guests) {
            if(g.prepared) {
                bool expired=false;
                for(const auto& item:g.tray)if(item.product>=0 && runtime->time()>=item.madeAt+definitions::menu[std::size_t(item.product)].lifetime)expired=true;
                if(expired){leave(g.id);continue;}
            }
            if(auto task=tasks->task(g.visit);task && sim::TaskBoard::terminal(task->state)) {
                if(task->state==sim::TaskState::Completed) {
                    if(task->spec.key=="cafe:take-order")g.orderTaken=true;
                    else deliverPrepared(g);
                }
                clearVisit(g);
            }
        }
        auto* g=guest(customer);
        if(!immediate && ready && g && g->tableService) {
            // Free staff for more preparation; delivery starts only on a click.
            g->prepared=order;clearServiceWork();retireShots();g->tray=items;
            customer={};order={};items={};drink.reset();refresh();
        }
    }
    template<class Put> void saveTableGuest(const Guest& g,Put put) const {
        put(g.tableService);put(g.orderTaken);put(g.visit.value);put(g.prepared.value);
        if(g.prepared)for(const auto& i:g.tray){put(std::uint64_t(i.product+1));put(i.quality);put(i.used);put(std::uint64_t(i.madeAt+1));}
        put(g.seatingPreference);
    }
    template<class Get> bool loadTableGuest(Guest& g,Get get,bool hasSeatingPreference=false) {
        auto table=get(),taken=get(),visit=get(),prepared=get();
        if(table>1 || taken>1 || (!table && (taken || visit || prepared)))return false;
        g.tableService=bool(table);g.orderTaken=bool(taken);
        auto epoch=runtime->epoch();g.visit={visit,visit?epoch:0};g.prepared={prepared,prepared?epoch:0};
        if(g.prepared) {
            auto o=runtime->order(g.prepared);auto c=runtime->customer(g.id);
            if(!g.orderTaken || !o || !c || o.value.customer!=g.id || c.value.order!=g.prepared || o.value.state!=sim::OrderState::Ready || g.id==customer)return false;
            for(auto& i:g.tray) {
                auto p=get(),q=get(),used=get(),made=get();
                if(p>(summerCatalog?8u:5u) || q>1000 || used>1 || made>std::uint64_t(runtime->time())+1)return false;
                i={int(p)-1,int(q),{},bool(used),std::int64_t(made)-1};
                if(p==0 && (q!=1000 || used || made))return false;
                if(p && !made)return false;
            }
        }
        if(hasSeatingPreference){auto preference=get();if(preference>1)return false;g.seatingPreference=int(preference);}
        return true;
    }
