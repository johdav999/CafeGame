    sim::GridLayout gardenLayout{garden::width,garden::depth,{},{{0,garden::doorZ}}};
    std::uint64_t gardenBuys=0,gardenSales=0;
    bool courtyardOpen() const {return gardenState.selected && gardenState.restoration==garden::Restoration::CourtyardOpen;}
    std::size_t combinedTableCount() const {return tableCount()+gardenLayout.placements().size();}
    std::size_t serviceTableCount() const {return courtyardOpen()?combinedTableCount():tableCount();}
    std::optional<sim::Placement> tablePlacement(std::size_t point) const {
        if(point<4)return layout.find(point+1);
        if(point>=6 || !courtyardOpen())return {};
        auto p=gardenLayout.find(101+point-4);if(p)p->x+=24;return p;
    }
    void requestTable(const Guest& visitor) {
        auto next=seats;auto enabled=enabledSeats(layout),preferred=enabled;
        bool freePreferred=false;
        // Restrict only free points on a detached pool. Existing claims retain
        // their points/tokens, and an older waiter always keeps FIFO priority.
        if(std::none_of(next.claims().begin(),next.claims().end(),[](auto c){return c.point==Pool::waiting;})) {
            for(std::size_t n=0;n<enabled.size();++n) {
                bool claimed=std::any_of(next.claims().begin(),next.claims().end(),[&](auto c){return c.point==n;});
                bool wanted=(n>=4)==bool(visitor.seatingPreference);
                if(enabled[n] && !claimed && wanted)freePreferred=true;
                if(!claimed && !wanted)preferred[n]=0;
            }
        }
        if(freePreferred)require(next.setEnabled(preferred));
        require(next.request(visitor.id));
        if(freePreferred)require(next.setEnabled(enabled));
        std::swap(seats,next);
    }
    bool restoreSeating(bool hasGardenSeats) {
        const auto enabled=enabledSeats(layout);
        if(hasGardenSeats && restoreSeatMaskKnown && restoredTableMask!=tableMask())return false;
        if(hasGardenSeats && std::any_of(seats.claims().begin(),seats.claims().end(),[](auto c){return c.point==Pool::waiting;})) {
            std::array<std::uint8_t,6> claimed{};
            for(auto c:seats.claims())if(c.point!=Pool::waiting){if(c.point>=6)return false;claimed[c.point]=1;}
            if(claimed!=enabled)return false;
        }
        // Old G2 saves have only indoor claims. Enabling their new outdoor
        // capacity may promote an existing waiter, preserving claim order.
        return bool(seats.setEnabled(enabled));
    }
    // Reuse the simulator's reachability validator for the indoor side of the
    // doorway. No renderer navigation internals or second path algorithm.
    bool validGardenConnection(const sim::GridLayout& indoor,bool opening=false) const {
        if(!courtyardOpen() && !opening)return true;
        auto points=indoor.placements();
        // Require the additional doorway point on a detached indoor board.
        sim::GridLayout connected{24,20,{{5,4,14,4},{19,0,4,3},{2,1,2,3}},
            {{22,8},{16,3},{8,3},{14,8},{21,3},{16,8},{18,8},{20,8},{11,8},{10,8},{9,8},
             {6,3},{11,3},{14,3},{17,3},{23,garden::doorZ}}};
        return connected.validate(points)==sim::LayoutError::None;
    }
    bool openCourtyard() {
        if(!contentAccess.available() || !gardenState.selected || !layoutEditable() || (campaign.enabled && campaign.phase!=DayPhase::Preparation))return false;
        if(!validGardenConnection(layout,true)){layoutMessage="Clear the indoor doorway before opening the courtyard.";return false;}
        gardenState.restoration=garden::Restoration::CourtyardOpen;
        campaign.checkpoint.clear();layoutMessage="Courtyard open. Outdoor tables share staff, supplies and equipment with the indoor cafe.";return true;
    }
    sim::LayoutError gardenPreview(int id,int x,int z,int rotation) const {
        if(!courtyardOpen() || !garden::outdoorTable(id))return sim::LayoutError::Invalid;
        auto next=gardenLayout;
        return next.find(id)?next.move(id,x,z,rotation):next.place({std::uint64_t(id),x,z,4,8,rotation});
    }
    bool editGardenLayout(int action,int id,int x,int z,int rotation) {
        if(!contentAccess.available() || !courtyardOpen() || !layoutEditable()){layoutMessage="Open the courtyard and finish guests, tasks and deliveries before building.";return false;}
        if(!garden::outdoorTable(id) || action<0 || action>2){layoutMessage="The courtyard supports outdoor tables 1 and 2 only.";return false;}
        auto next=gardenLayout;
        auto error=action==0?next.move(id,x,z,rotation):action==1?next.erase(id):next.place({std::uint64_t(id),x,z,4,8,rotation});
        if(error!=sim::LayoutError::None){layoutMessage=sim::describe(error);return false;}
        if(!validGardenConnection(layout)){layoutMessage="Keep the courtyard doorway reachable.";return false;}
        auto pool=seats;if(!pool.setEnabled(enabledSeats(layout,&next))){layoutMessage="An outdoor table is still claimed.";return false;}
        if(action==2 && (availableCash()<600 || gardenBuys>=10000)){layoutMessage="An outdoor table costs 6.00 available cash; purchase limit is 10000.";return false;}
        const char* stream=action==1?"garden:table-sales":"garden:table-buys";
        if(action!=0){
            auto payment=ledger->prepare(stream,ledger->sequence(stream)+1,action==1?300:-600,runtime->time());
            if(!payment){layoutMessage=sim::describe(payment.error);return false;}
            require(ledger->commit(std::move(payment.value)));
            if(action==1)++gardenSales;else ++gardenBuys;
        }
        std::swap(gardenLayout,next);std::swap(seats,pool);syncCash();settleWages();
        layoutMessage=action==1?"Outdoor table sold for 3.00.":action==2?"Outdoor table purchased for 6.00.":"Outdoor table moved free. Doorway and access remain clear.";return true;
    }
    template<class Put> void saveGardenLayout(Put put) const {
        for(std::uint64_t id:{101,102}){auto p=gardenLayout.find(id);put(bool(p));put(p?p->x:0);put(p?p->z:0);put(p?p->rotation:0);}
        put(gardenBuys);put(gardenSales);
    }
    template<class Get> bool loadGardenLayout(Get get) {
        std::vector<sim::Placement> placed;
        for(std::uint64_t id:{101,102}){
            auto present=get(),x=get(),z=get(),rotation=get();
            if(present>1 || x>garden::width || z>garden::depth || rotation>3 || (!present && (x || z || rotation)))return false;
            if(present)placed.push_back({id,int(x),int(z),4,8,int(rotation)});
        }
        gardenBuys=get();gardenSales=get();
        if(gardenBuys>10000 || gardenSales>gardenBuys || gardenBuys-gardenSales!=placed.size() ||
           (!courtyardOpen() && (!placed.empty() || gardenBuys || gardenSales)))return false;
        if(ledger->sequence("garden:table-buys")!=gardenBuys || ledger->sequence("garden:table-sales")!=gardenSales ||
           debited("garden:table-buys")!=std::int64_t(gardenBuys)*600 || credited("garden:table-buys") ||
           credited("garden:table-sales")!=std::int64_t(gardenSales)*300 || debited("garden:table-sales"))return false;
        return gardenLayout.restore(placed)==sim::LayoutError::None;
    }
