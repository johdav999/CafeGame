    static constexpr std::size_t layoutSaveBytes=45*8;
    sim::GridLayout layout{24,20,{{5,4,14,4},{19,0,4,3},{2,1,2,3}},
        {{22,8},{16,3},{8,3},{14,8},{21,3},{16,8},{18,8},{20,8},{11,8},{10,8},{9,8},
         {6,3},{11,3},{14,3},{17,3}}};
    bool closed=false;
    std::string layoutMessage;
    void createLayout() {
        if(layout.place({1,4,9,4,8,0})!=sim::LayoutError::None ||
           layout.place({2,16,9,4,8,0})!=sim::LayoutError::None)throw std::runtime_error("Invalid cafe layout");
        require(seats.setEnabled(enabledSeats(layout)));
    }
    bool layoutEditable() const {return closed && guests.empty() && !active() && tasks->tasks().empty() && !incomingSupply() && (!campaign.enabled || campaign.phase==DayPhase::Preparation || (intermission() && campaign.phase==DayPhase::Open));}
    std::string extraTablesReason() const {return campaign.enabled && (!(campaign.goals&1) || credited("cafe:sales")<600)?"Serve your first paid order and earn 6.00 total in ticket sales.":"";}
    std::size_t tableCount() const {return std::count_if(layout.placements().begin(),layout.placements().end(),[](const auto& p){return p.id>=1 && p.id<=4;});}
    void toggleClosed() {
        if(schedule.stage!=PeriodStage::Service){layoutMessage="Finish this period and use the clock's Continue button to reopen.";return;}
        if(campaign.enabled){closeDay();return;}
        closed=!closed;
        if(closed)for(auto& g:guests)if(g.phase==GuestPhase::Queue)leave(g.id,true);
        layoutMessage=closed?"Closed: finish current service and let guests and cleanup leave before editing.":"Cafe open. Welcome guests to begin service.";
    }
    std::array<std::uint8_t,6> enabledSeats(const sim::GridLayout& board,const sim::GridLayout* outdoor=nullptr) const {
        const auto& gardenBoard=outdoor?*outdoor:gardenLayout;
        return {std::uint8_t(bool(board.find(1))),std::uint8_t(bool(board.find(2))),std::uint8_t(bool(board.find(3))),std::uint8_t(bool(board.find(4))),
            std::uint8_t(courtyardOpen() && bool(gardenBoard.find(101))),std::uint8_t(courtyardOpen() && bool(gardenBoard.find(102)))};
    }
    // Preview all four complete sets together, including chair space and access.
    // Empty future slots are validated without buying or reserving furniture.
    std::optional<std::vector<sim::Placement>> fourTablePlan() const {
        std::vector<sim::Placement> other;
        for(auto p:layout.placements())if(p.id>4)other.push_back(p);
        for(int z:{10,9,11}) {
            auto full=other;for(int n=0;n<4;++n)full.push_back({std::uint64_t(n+1),n*6,z,4,8,0});
            if(layout.validate(full)==sim::LayoutError::None)return full;
        }
        // A sideways two-by-two option leaves the same safe chair footprints.
        for(int x:{1,2,3}) {
            auto full=other;for(int n=0;n<4;++n)full.push_back({std::uint64_t(n+1),x+(n%2)*10,9+(n/2)*6,4,8,1});
            if(layout.validate(full)==sim::LayoutError::None)return full;
        }
        return {};
    }
    bool arrangeTablesForExpansion() {
        if(!layoutEditable()){layoutMessage="Finish guests, cleanup and deliveries, then arrange tables during preparation or a period break.";return false;}
        auto plan=fourTablePlan();
        if(!plan){layoutMessage="Decorations or equipment occupy the four-table layouts. Move them out of the dining area, then try again. Nothing was moved or charged.";return false;}
        std::erase_if(*plan,[&](const auto& p){return p.id<=4 && !layout.find(p.id);});
        auto next=layout;const auto result=next.restore(*plan);
        if(result!=sim::LayoutError::None){layoutMessage=sim::describe(result);return false;}
        if(!validGardenConnection(next)){layoutMessage="This blocks the courtyard doorway. Nothing was moved or charged.";return false;}
        std::swap(layout,next);
        layoutMessage="Tables arranged free. Room for four complete table sets; all walking routes stay open. Buy missing tables separately.";return true;
    }
    // Copy/preflight allocations before posting any cash or publishing furniture.
    bool editLayout(int action,int id,int x,int z,int rotation) {
        if(summary())return false;
        if(!layoutEditable()){layoutMessage="Close the cafe and wait for all guests and tasks to finish.";return false;}
        if(action==3 && id==0)return arrangeTablesForExpansion();
        if(id<1 || id>4 || action<0 || action>2){layoutMessage="Choose table 1 to 4 and a valid action.";return false;}
        if(action==2 && id>=3 && !extraTablesReason().empty()){layoutMessage=extraTablesReason();return false;}
        auto candidate=layout;sim::Quantity amount=0;const char* stream=nullptr;
        sim::LayoutError error;
        if(action==0)error=candidate.move(id,x,z,rotation);
        else if(action==1){error=candidate.erase(id);amount=300;stream="cafe:furniture-sales";}
        else {error=candidate.place({std::uint64_t(id),x,z,4,8,rotation});amount=-600;stream="cafe:furniture-buys";}
        if(error!=sim::LayoutError::None){layoutMessage=sim::describe(error);return false;}
        if(!validGardenConnection(candidate)){layoutMessage="This blocks the courtyard doorway. Nothing was moved or charged.";return false;}
        if(amount<0 && -amount>availableCash()){layoutMessage="A table set costs 6.00 available cash.";return false;}
        auto pool=seats;require(pool.setEnabled(enabledSeats(candidate)));
        sim::Result<sim::Ledger::Prepared> payment;
        if(stream){payment=ledger->prepare(stream,ledger->sequence(stream)+1,amount,runtime->time());if(!payment){layoutMessage=std::string(sim::describe(payment.error));return false;}}
        if(stream)require(ledger->commit(std::move(payment.value)));
        std::swap(layout,candidate);std::swap(seats,pool);syncCash();settleWages();
        layoutMessage=action==1?"Table sold for 3.00.":action==2?"Table set purchased for 6.00.":"Placement accepted. Routes updated.";return true;
    }
    template<class Put> void saveLayout(Put put) const {
        put(closed);for(std::uint64_t id:{1,2,3,4}) {auto p=layout.find(id);put(bool(p));put(p?p->x:0);put(p?p->z:0);put(p?p->rotation:0);}
        // Non-table placements have fixed authored dimensions.
        for(std::size_t n=1;n<buildItems.size();++n){auto p=layout.find(buildItems[n].id);put(bool(p));put(p?p->x:0);put(p?p->z:0);put(p?p->rotation:0);}
    }
    template<class Get> bool loadLayout(Get get,bool allowClosingQueue=false,bool hasEquipment=true,bool hasSummer=false) {
        auto c=get();if(c>1)return false;closed=bool(c);
        std::vector<sim::Placement> placed;
        for(std::uint64_t id=1;id<=(hasEquipment?4u:2u);++id) {
            auto present=get(),x=get(),z=get(),rotation=get();
            if(present>1 || x>24 || z>20 || rotation>3 || (!present && (x || z || rotation)))return false;
            if(present)placed.push_back({id,int(x),int(z),4,8,int(rotation)});
        }
        if(hasEquipment)for(std::size_t n=1;n<(hasSummer?8u:7u);++n){const auto& item=buildItems[n];auto present=get(),x=get(),z=get(),rotation=get();if(present>1 || x>24 || z>20 || rotation>3 || (!present && (x || z || rotation)))return false;if(present)placed.push_back({std::uint64_t(item.id),int(x),int(z),item.width,item.depth,int(rotation)});}
        if(layout.restore(placed)!=sim::LayoutError::None)return false;
        // The courtyard follows later in the envelope. Validate indoor identity
        // here and validate the joint mask only after both layouts are loaded.
        if(restoreSeatMaskKnown && (restoredTableMask&15)!=(tableMask()&15))return false;
        if(!allowClosingQueue && closed && std::any_of(guests.begin(),guests.end(),[](auto g){return g.phase==GuestPhase::Queue;}))return false;
        auto buys=ledger->sequence("cafe:furniture-buys"),sales=ledger->sequence("cafe:furniture-sales");
        if(sales>buys+2 || 2+buys-sales!=tableCount())return false;
        return true;
    }
