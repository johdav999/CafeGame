    struct BuildItem {const char* name;int id,width,depth,x,z;std::int64_t price,refund;std::uint64_t goal;const char* effect;};
    static constexpr std::array<BuildItem,8> buildItems{{
        {"Espresso speed kit",0,0,0,0,0,3000,1500,1,"Shots: 3.0 to 1.8 seconds. Each shot loses 15 condition points and 20 cleanliness points (standard: 10 and 15). Repairs: 5.00 to 7.50. Fits the existing counter."},
        {"Preparation station",10,3,2,10,0,4500,2250,3,"One extra shared equipment slot; two employees can prepare a mixed ticket concurrently. Shares the machine condition meter."},
        {"Storage shelf",11,2,2,21,4,2000,1000,1,"Adds 24 stored portions per ingredient: 24 to 48 total. Empty this shelf before selling."},
        {"Sage plant",20,1,1,0,5,200,100,1,"Adds 3 furnishing points to cafe attractiveness and +1 percentage point of reputation while installed."},
        {"Terracotta plant",21,1,1,0,7,200,100,1,"Adds 3 furnishing points to cafe attractiveness and +1 percentage point of reputation while installed."},
        {"Brass lamp",22,1,1,23,18,300,150,1,"Adds 3 furnishing points to cafe attractiveness and +0.5 percentage points of reputation while installed."},
        {"Forest lamp",23,1,1,0,1,300,150,1,"Adds 3 furnishing points to cafe attractiveness and +0.5 percentage points of reputation while installed."},
        {"Cold-preparation station",30,3,2,14,0,4000,2000,3,"One exclusive cold-assembly slot for iced coffee and lemonade. Uses delivered ice; no melting simulation."}
    }};
    static constexpr std::size_t equipmentSaveBytes=35*8;
    // Appearance only: two existing plant slots keep their price, footprint and benefits.
    static constexpr std::array<const char*,4> plantNames{"Snake plant","Rubber plant","Jade succulent","Monstera"};
    static constexpr std::array<const char*,3> potNames{"Terracotta","Fluted oat","Sage cylinder"};
    std::array<int,2> plantStyles{0,1},potStyles{2,0};
    bool fastMachine=false,extraStorage=false;
    sim::StationId extraStation{};
    sim::InventoryId annex{};
    int finish=0;
    unsigned restoredTableMask=3;
    bool restoreSeatMaskKnown=false;
    unsigned tableMask() const {unsigned mask=0;auto enabled=enabledSeats(layout);for(unsigned n=0;n<6;++n)if(enabled[n])mask|=1u<<n;return mask;}
    std::array<std::uint64_t,8> buildBuys{},buildSales{};
    std::array<bool,8> restockAnnex{};
    std::string equipmentMessage;
    static int buildKey(int id) {for(int n=0;n<int(buildItems.size());++n)if(buildItems[std::size_t(n)].id==id)return n;return -1;}
    static bool preparationTask(std::string_view key) {return key=="cafe:prepare" || key=="cafe:assist";}
    sim::ProcessId productRecipe(int p) const {return definitions::processes[std::size_t(p>=5?p+3:p==0 && fastMachine?6:p)].id;}
    sim::ProcessId shotRecipe() const {return definitions::processes[fastMachine?7:5].id;}
    int shotWear() const {return fastMachine?150:100;}
    int shotDirt() const {return fastMachine?200:150;}
    sim::Quantity repairPrice() const {return fastMachine?750:500;}
    void createAnnex() {
        std::vector<sim::Amount> capacity;for(std::size_t n=0;n<ingredientCount();++n)capacity.push_back({ingredient(n),24});
        auto result=runtime->createInventory(capacity);require(result);annex=result.value;
    }
    sim::Stock storedIngredient(std::size_t n) const {
        auto s=runtime->stock(storage,ingredient(n)).value;
        if(extraStorage){auto a=runtime->stock(annex,ingredient(n)).value;s.total+=a.total;s.capacity+=a.capacity;s.reservedCapacity+=a.reservedCapacity;}
        return s;
    }
    sim::InventoryId restockSource(std::size_t n) const {return runtime->stock(storage,ingredient(n)).value.available() || !extraStorage?storage:annex;}
    bool ownsBuild(int key) const {return key>=0 && key<8 && buildBuys[std::size_t(key)]>buildSales[std::size_t(key)];}
    std::string buildGate(int key) const {
        if(key<0 || key>=8)return "Choose a catalog item.";
        if(key==7 && !summerProgress())return "Open the owned courtyard and unlock the summer menu (campaign: first paid service and mixed order).";
        const auto& item=buildItems[std::size_t(key)];
        if(campaign.enabled && ((campaign.goals&item.goal)!=item.goal || credited("cafe:sales")<item.price))return "Complete the required campaign goals and earn "+std::to_string(item.price/100)+".00 in ticket sales.";
        return {};
    }
    std::string buildReason(int action,int key,int x,int z,int rotation) const {
        if(!layoutEditable())return "Close and drain guests, staff tasks and deliveries. Campaign building is available during preparation and period breaks.";
        if(key<0 || key>=8 || action<0 || action>2)return "Choose a catalog item and action.";
        const auto& item=buildItems[std::size_t(key)];bool owned=ownsBuild(key);
        if(action==0) {
            if(owned)return "Already installed.";
            auto gate=buildGate(key);if(!gate.empty())return gate;
            if(availableCash()<item.price)return "Insufficient available cash after wages.";
            if(buildBuys[std::size_t(key)]>=10000)return "Catalog purchase limit reached.";
        } else if(!owned)return "This item is not installed.";
        if(action==2 && key==2)for(std::size_t n=0;n<ingredientCount();++n){auto stock=runtime->stock(annex,ingredient(n)).value;if(stock.total || stock.reservedCapacity)return "Empty the extra storage shelf before selling it.";}
        if(key) {
            auto next=layout;auto error=action==0?next.place({std::uint64_t(item.id),x,z,item.width,item.depth,rotation}):action==1?next.move(item.id,x,z,rotation):next.erase(item.id);
            if(error!=sim::LayoutError::None)return sim::describe(error);
            if(!validGardenConnection(next))return "Keep the courtyard doorway reachable.";
        } else if(action==1)return "The speed kit fits the fixed service counter.";
        return {};
    }
    bool equipmentChange(int action,int key,int x=0,int z=0,int rotation=0) {
        equipmentMessage=buildReason(action,key,x,z,rotation);if(!equipmentMessage.empty())return false;
        // All core/layout/ledger changes stay detached until the joint loader validates them.
        Simulation next;next.contentAccess=contentAccess;if(!next.load(save()))return false;
        const auto& item=buildItems[std::size_t(key)];
        if(key)require(sim::Status{{},(action==0?next.layout.place({std::uint64_t(item.id),x,z,item.width,item.depth,rotation}):action==1?next.layout.move(item.id,x,z,rotation):next.layout.erase(item.id))==sim::LayoutError::None?sim::Error::None:sim::Error::InvalidState});
        if(action==0 || action==2) {
            bool buying=action==0;auto stream=buying?"cafe:upgrades":"cafe:resale";
            require(next.ledger->post(stream,next.ledger->sequence(stream)+1,buying?-item.price:item.refund,next.runtime->time()));
            (buying?next.buildBuys:next.buildSales)[std::size_t(key)]++;
            if(key==0)next.fastMachine=buying;
            if(key==1){if(buying){auto station=next.runtime->createStation(baseStaffCapabilities());require(station);next.extraStation=station.value;}else{require(next.runtime->removeStation(next.extraStation));next.extraStation={};}}
            if(key==2)next.extraStorage=buying;
            if(key==7){if(buying){auto station=next.runtime->createStation(std::array{std::string{"garden:cold"}});require(station);next.coldStation=station.value;}else{require(next.runtime->removeStation(next.coldStation));next.coldStation={};}}
        }
        next.syncCash();next.runtime->drainEvents();
        if(!load(next.save())){equipmentMessage="The change was rejected; cash, inventory and layout are unchanged.";return false;}
        equipmentMessage=action==2?"Sold at the displayed refund.":action==1?"Placement updated; all access routes remain open.":"Installed at the displayed price.";return true;
    }
    bool setFinish(int value) {if(!layoutEditable() || value<0 || value>3 || (value==3 && !(gardenStory.chapters&4)))return false;finish=value;equipmentMessage="Finish updated. Cosmetic only; no gameplay bonus or cost.";return true;}
    bool setPlantStyle(int id,int plant,int pot) {
        if(!layoutEditable() || id<20 || id>21 || plant<0 || plant>=int(plantNames.size()) || pot<0 || pot>=int(potNames.size()))return false;
        plantStyles[std::size_t(id-20)]=plant;potStyles[std::size_t(id-20)]=pot;
        equipmentMessage="Plant and pot style updated. Appearance changes are free.";return true;
    }
    template<class Put> void saveEquipment(Put put) const {
        put(fastMachine);put(extraStation.value);put(extraStorage);put(annex.value);put(finish);
        for(auto n:buildBuys)put(n);for(auto n:buildSales)put(n);for(auto n:restockAnnex)put(n);put(tableMask());
        for(auto n:plantStyles)put(n);for(auto n:potStyles)put(n);
        put(coldStation.value);
    }
    template<class Get> bool loadEquipment(Get get,bool hasSeatMask=true,bool hasPlantStyles=true,bool hasGardenSeats=false,bool hasSummer=false) {
        auto fast=get(),station=get(),storageEnabled=get(),inv=get(),style=get();
        if(fast>1 || storageEnabled>1 || !inv || style>3)return false;
        fastMachine=bool(fast);extraStation={station,station?runtime->epoch():0};extraStorage=bool(storageEnabled);annex={inv,runtime->epoch()};finish=int(style);
        for(std::size_t n=0;n<(hasSummer?8u:7u);++n){buildBuys[n]=get();if(buildBuys[n]>10000)return false;}
        for(std::size_t n=0;n<(hasSummer?8u:7u);++n){buildSales[n]=get();if(buildSales[n]>10000)return false;}
        for(std::size_t n=0;n<(hasSummer?8u:5u);++n){auto v=get();if(v>1)return false;restockAnnex[n]=bool(v);}
        if(hasSeatMask){auto mask=get();if(mask>(hasGardenSeats?63u:15u))return false;restoredTableMask=unsigned(mask);restoreSeatMaskKnown=true;std::array<std::uint8_t,6> enabled{};for(unsigned n=0;n<6;++n)enabled[n]=std::uint8_t((mask>>n)&1);if(!seats.setEnabled(enabled))return false;}
        if(hasPlantStyles) {
            for(auto& n:plantStyles){auto v=get();if(v>=plantNames.size())return false;n=int(v);}
            for(auto& n:potStyles){auto v=get();if(v>=potNames.size())return false;n=int(v);}
        }
        if(hasSummer){auto id=get();coldStation={id,id?runtime->epoch():0};}
        return true;
    }
    bool validateEquipment() const {
        for(auto n:plantStyles)if(n<0 || n>=int(plantNames.size()))return false;
        for(auto n:potStyles)if(n<0 || n>=int(potNames.size()))return false;
        auto caps=baseStaffCapabilities();for(std::size_t n=0;n<4;++n){auto s=runtime->station({n+1,runtime->epoch()});if(!s || s.value.slots.size()!=1 || s.value.capabilities!=std::vector<std::string>{caps[n]})return false;}
        if(annex==inventory || annex==storage || !annex || !runtime->stock(annex,beans) || runtime->stock(annex,coffee))return false;
        if(fastMachine!=ownsBuild(0) || bool(extraStation)!=ownsBuild(1) || extraStorage!=ownsBuild(2) || bool(coldStation)!=ownsBuild(7))return false;
        std::int64_t spent=0,refunds=0;std::uint64_t bought=0,sold=0;
        for(std::size_t n=0;n<8;++n) {
            if(buildSales[n]>buildBuys[n] || buildBuys[n]-buildSales[n]>1)return false;
            const auto& item=buildItems[n];spent+=std::int64_t(buildBuys[n])*item.price;refunds+=std::int64_t(buildSales[n])*item.refund;bought+=buildBuys[n];sold+=buildSales[n];
            if(n && bool(layout.find(item.id))!=ownsBuild(int(n)))return false;
            if(ownsBuild(int(n)) && !buildGate(int(n)).empty())return false;
        }
        if(credited("cafe:upgrades") || debited("cafe:resale") || debited("cafe:upgrades")!=spent || credited("cafe:resale")!=refunds || ledger->sequence("cafe:upgrades")!=bought || ledger->sequence("cafe:resale")!=sold)return false;
        if(extraStation){auto s=runtime->station(extraStation);if(!s || s.value.slots.size()!=1)return false;auto caps=baseStaffCapabilities();std::sort(caps.begin(),caps.end());auto actual=s.value.capabilities;std::sort(actual.begin(),actual.end());if(caps!=actual)return false;}
        if(coldStation){auto s=runtime->station(coldStation);if(!summerCatalog || !s || s.value.slots.size()!=1 || s.value.capabilities!=std::vector<std::string>{"garden:cold"})return false;}
        for(const auto& w:crew)if(runtime->worker(w.id).value.capabilities!=staffCapabilities())return false;
        for(std::size_t n=0;n<ingredientCount();++n){auto s=runtime->stock(annex,ingredient(n));if(!s || s.value.capacity!=24 || s.value.reserved || (!extraStorage && (s.value.total || s.value.reservedCapacity)) || (restockAnnex[n] && (!extraStorage || !restockWork[n])))return false;}
        for(std::size_t n=ingredientCount();n<8;++n)if(restockAnnex[n] || restockWork[n])return false;
        return true;
    }
