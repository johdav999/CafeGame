    sim::InventoryId storage;
    std::unique_ptr<sim::SupplyBoard> supplies;
    bool automaticSupply=false;
    void createSupplies() {
        std::vector<sim::Amount> capacities;for(std::size_t n=0;n<ingredientCount();++n)capacities.push_back({ingredient(n),24});
        auto id=runtime->createInventory(capacities);require(id);storage=id.value;
        supplies=std::make_unique<sim::SupplyBoard>(*runtime,8);
    }
    sim::Stock storedBeans() const {return storedIngredient(0);}
    const sim::SupplyOrder* incomingSupply() const {
        for(const auto& o:supplies->orders())if(o.state==sim::SupplyState::Pending)return &o;
        return nullptr;
    }
    bool purchaseBeans(sim::Quantity quantity) {
        return purchaseIngredient(0,quantity);
    }
    bool purchaseIngredient(int index,sim::Quantity quantity=12) {
        if(summary())return false;
        economyMessage.clear();
        if(index<0 || index>=int(ingredientCount()) || incomingSupply() || quantity<=0 || quantity>12)return false;
        auto cost=quantity*definitions::ingredients[std::size_t(index)].price;
        if(cost>availableCash()){economyMessage="Not enough cash for supplies. Earn from coffee or cancel an incoming delivery.";return false;}
        auto payment=ledger->prepare("cafe:purchases",ledger->sequence("cafe:purchases")+1,-cost,runtime->time());
        if(!payment){economyMessage=std::string(sim::describe(payment.error));return false;}
        auto destination=storage;auto s=runtime->stock(storage,ingredient(std::size_t(index))).value;
        if(s.capacity-s.total-s.reservedCapacity<quantity && extraStorage)destination=annex;
        auto result=supplies->place("cafe:roaster",destination,std::array{sim::Amount{ingredient(std::size_t(index)),quantity}},8000);
        if(!result){economyMessage=std::string(sim::describe(result.error));return false;}
        // Single owner thread, no callbacks or ledger mutation between prepare
        // and commit. Publication cannot allocate after the capacity reservation.
        require(ledger->commit(std::move(payment.value)));pendingSupplyCost=cost;syncCash();
        runtime->drainEvents();return true;
    }
    bool orderBeans() {return purchaseBeans(12);}
    bool cancelSupply() {
        auto incoming=incomingSupply();if(!incoming)return false;
        auto id=incoming->id;
        sim::Result<sim::Ledger::Prepared> refund;
        if(pendingSupplyCost){refund=ledger->prepare("cafe:refunds",ledger->sequence("cafe:refunds")+1,pendingSupplyCost,runtime->time());if(!refund){economyMessage=std::string(sim::describe(refund.error));return false;}}
        auto cancelled=supplies->cancel(id);if(!cancelled)return false;
        if(pendingSupplyCost)require(ledger->commit(std::move(refund.value)));
        pendingSupplyCost=0;automaticSupply=false;economyMessage.clear();syncCash();
        require(supplies->forget(id));settleWages();runtime->drainEvents();return true;
    }
    bool restock() {
        return restockIngredient(0);
    }
    bool restockIngredient(int index) {
        if(summary())return false;
        if(index<0 || index>=int(ingredientCount()) || restockWork[std::size_t(index)])return false;
        if(!immediate)return requestRestock(index);
        return transferIngredient(index);
    }
    bool transferIngredient(int index,sim::InventoryId source={}) {
        if(index<0 || index>=int(ingredientCount()))return false;
        if(!source)source=restockSource(std::size_t(index));
        auto resource=ingredient(std::size_t(index));auto stored=runtime->stock(source,resource);require(stored);
        auto from=stored.value;auto to=runtime->stock(inventory,resource);require(to);
        auto amount=std::min<sim::Quantity>({4,from.available(),to.value.capacity-to.value.total-to.value.reservedCapacity});
        if(!amount)return false;
        require(runtime->transfer(source,inventory,std::array{sim::Amount{resource,amount}}));
        runtime->drainEvents();refresh();return true;
    }
    void supplyTick() {
        auto delivered=supplies->poll();require(delivered);if(delivered.value)pendingSupplyCost=0;
        std::vector<sim::SupplyId> terminal;
        for(const auto& o:supplies->orders())if(o.state!=sim::SupplyState::Pending)terminal.push_back(o.id);
        for(auto id:terminal)require(supplies->forget(id));
        if(automaticSupply && (!campaign.enabled || campaign.phase==DayPhase::Open)) {
            for(std::size_t n=0;n<ingredientCount();++n) {
                if(!ingredientDemand(n))continue;
                auto atMachine=runtime->stock(inventory,ingredient(n));require(atMachine);
                if(atMachine.value.available()<=1)restockIngredient(int(n));
                auto stored=storedIngredient(n);auto position=stored.total+stored.reservedCapacity;
                if((n==0 || atMachine.value.total<=4) && position<=4 && !incomingSupply())purchaseIngredient(int(n),12-position);
            }
        }
        runtime->drainEvents();
    }
    template<class Put> void saveSupplies(Put put) const {
        put(storage.value);put(automaticSupply);
        auto s=supplies->snapshot();put(s.nextOrder);put(s.orders.size());
        for(const auto& o:s.orders){put(o.id.value);put(o.capacity.value);put(o.amounts[0].quantity);put(o.deadline);std::size_t n=0;while(n<ingredientCount() && ingredient(n)!=o.amounts[0].resource)++n;put(n);put(o.destination.value);}
    }
    template<class Get> bool loadSupplies(Get get,bool hasEquipment=true) {
        auto epoch=runtime->epoch();auto id=get(),automatic=get(),next=get(),count=get();
        if(!id || automatic>1 || count>1)return false;
        storage={id,epoch};automaticSupply=bool(automatic);
        auto stock=runtime->stock(storage,beans);
        if(storage==inventory || !stock || stock.value.capacity!=24 || stock.value.reserved!=0 || runtime->stock(storage,coffee))return false;
        sim::SupplySnapshot saved;saved.nextOrder=next;
        std::array<sim::Quantity,8> held{},extraHeld{};
        while(count--) {
            auto order=get(),hold=get(),quantity=get(),deadline=get(),index=get();
            auto destination=hasEquipment?get():id;
            if(!order || !hold || !quantity || quantity>12 || !deadline || deadline>std::uint64_t(runtime->time())+8000 || index>=ingredientCount())return false;
            if(destination!=id && (!extraStorage || destination!=annex.value))return false;
            saved.orders.push_back({{order,epoch},"cafe:roaster",{destination,epoch},{{ingredient(index),std::int64_t(quantity)}},std::int64_t(deadline),sim::SupplyState::Pending,{hold,epoch}});
            (destination==id?held:extraHeld)[index]+=std::int64_t(quantity);
        }
        for(std::size_t n=0;n<ingredientCount();++n){auto s=runtime->stock(storage,ingredient(n));if(!s || s.value.capacity!=24 || s.value.reserved || s.value.reservedCapacity!=held[n])return false;}
        if(hasEquipment)for(std::size_t n=0;n<ingredientCount();++n){auto s=runtime->stock(annex,ingredient(n));if(!s || s.value.capacity!=24 || s.value.reserved || s.value.reservedCapacity!=extraHeld[n])return false;}
        supplies=std::make_unique<sim::SupplyBoard>(*runtime,8);return bool(supplies->restore(saved));
    }
