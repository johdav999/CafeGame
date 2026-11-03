#pragma once
#include "engine/simulator.hpp"
#include "definitions.hpp"
#include "compatibility.hpp"
#include "engine/simulator/occupancy.hpp"
#include "engine/simulator/workflow.hpp"
#include "engine/simulator/supply.hpp"
#include "engine/simulator/economy.hpp"
#include "engine/simulator/quality.hpp"
#include "engine/simulator/layout.hpp"
#include "engine/simulator/demand.hpp"
#include <optional>
#include <array>
#include <algorithm>
#include <bit>
#include <cmath>
#include <limits>
#include <stdexcept>

namespace cafe {
namespace sim = engine::simulator;
// Cafe policy and wallet are game-owned. Scene/HUD are projections of this session.
struct Simulation {
    garden::Access contentAccess{};
    garden::State gardenState{};
    bool selectGarden() {
        if(!contentAccess.available() || !layoutEditable() || (campaign.enabled && campaign.phase!=DayPhase::Preparation))return false;
        if(gardenState.selected)return true;
        Simulation next;next.contentAccess=contentAccess;
        if(!next.load(save()))return false;
        next.gardenState.selected=true;next.enableSummerCatalog();next.campaign.checkpoint.clear();
        return load(next.save());
    }
    const char* gardenStatus() const {return garden::status(contentAccess,gardenState);}
    static constexpr std::size_t maxSaveBytes=8*1024*1024+65536;
    enum class GuestPhase { Queue, Counter, ToSeat, Dining, Leaving };
    struct PreparedItem {
        int product=-1,quality=1000;
        sim::JobId shot{};
        bool used=false;
        sim::Milliseconds madeAt=-1;
    };
    struct Guest {sim::CustomerId id;GuestPhase phase;std::int64_t remaining=15000;sim::TaskId cleanup{};bool hasDeparted=false;int profile=0;std::int64_t arrived=0,budget=120000;int rating=0,score=0;bool legacyPatience=false;std::array<int,2> items{0,-1};int regular=-1;
        bool tableService=false,orderTaken=false;
        sim::TaskId visit{};
        sim::OrderId prepared{};
        std::array<PreparedItem,2> tray{};
        int seatingPreference=0; // 0 indoors, 1 outdoors; fallback is always allowed
    };
    // Consumption time begins at successful delivery. Two-item orders add the
    // time for both products; sitting and waiting for food does not consume it.
    static constexpr std::array<std::int64_t,8> diningTimes{15000,20000,25000,25000,30000,25000,25000,30000};
    static constexpr std::int64_t maxDiningTime=60000;
    static_assert(diningTimes.size()==definitions::menu.size());
    static std::int64_t diningDuration(std::array<int,2> ticket) {
        std::int64_t duration=0;for(int p:ticket)if(p>=0 && p<int(diningTimes.size()))duration+=diningTimes[std::size_t(p)];
        return std::clamp<std::int64_t>(duration,diningTimes[0],maxDiningTime);
    }
    static void startDining(Guest& visitor) {visitor.remaining=diningDuration(visitor.items);}
    using Pool=sim::OccupancyPool<>;
    Pool queue{3,3,true}, counter{1,1}, seats{6,9};
    std::vector<Guest> guests;
    const sim::ResourceId beans=definitions::resources[0], coffee=definitions::resources[1];
    const sim::ProcessId recipe=definitions::processes[0].id;
    std::unique_ptr<sim::Runtime> runtime;
    sim::InventoryId inventory;
    sim::CustomerId customer;
    sim::OrderId order;
    int served=0,coins=0;
    std::int64_t wallet=0;
    std::uint64_t lastPaid=0;
    double fraction=0,brewing=0;
    std::int64_t pending=0;
    bool ready=false;
    int orderState=-1,jobState=-1,stock=0,inputHeld=0,outputHeld=0,patience=0;
    #include "menu.inc"
    #include "staff.inc"
    #include "workflows.inc"
    #include "supplies.inc"
    #include "economy.inc"
    #include "quality.inc"
    #include "layout.inc"
    #include "garden_layout.inc"
    #include "demand.inc"
    #include "campaign.inc"
    #include "schedule.inc"
    #include "journal.inc"
    #include "equipment.inc"
    #include "summer.inc"
    #include "table_service.inc"
    #include "garden_story.inc"
    explicit Simulation(sim::Quantity startingBeans=100,sim::Quantity openingCash=0,bool legacyCatalog=false) {
        if(startingBeans<0 || startingBeans>100)throw std::invalid_argument("Invalid starting stock");
        ledger=std::make_unique<sim::Ledger>(openingCash,128,18);syncCash();
        runtime=std::make_unique<sim::Runtime>(std::span(definitions::resources).first(11));
        for(std::size_t n=0;n<(legacyCatalog?6:8);++n)require(runtime->defineProcess(definitions::processes[n]));
        std::vector<sim::Amount> capacities;
        for(std::size_t n=0;n<11;++n){const auto& r=definitions::resources[n];capacities.push_back({r,r==beans?100:r==definitions::resources[10]?2:24});}
        auto i=runtime->createInventory(capacities);require(i);inventory=i.value;
        if(startingBeans)require(runtime->add(inventory,std::array{sim::Amount{beans,startingBeans}}));
        for(std::size_t n=1;n<5;++n)require(runtime->add(inventory,std::array{sim::Amount{ingredient(n),12}}));
        createSupplies();
        if(!legacyCatalog)createAnnex();
        std::vector<std::string> capabilities;
        for(std::size_t n=0;n<5;++n)if(std::find(capabilities.begin(),capabilities.end(),definitions::processes[n].capability)==capabilities.end()) {
            capabilities.push_back(definitions::processes[n].capability);require(runtime->createStation(std::array{capabilities.back()}));
        }
        auto worker=runtime->createWorker(capabilities);require(worker);staff=worker.value;crew.push_back({staff,0});createBoard();require(runtime->setAvailable(staff,false));
        createLayout();runtime->drainEvents();refresh();
    }
    template<class T> static void require(const T& result) {
        if(!result)throw std::runtime_error(std::string(sim::describe(result.error)));
    }
    bool active() const { return orderState>=0 && orderState<=int(sim::OrderState::Ready); }
    Guest* guest(sim::CustomerId id) {for(auto& g:guests)if(g.id==id)return &g;return nullptr;}
    // Low-level authored/native admission. Player and automatic adapters opt in
    // to the dynamic appeal cap; fixtures retain the bounded nine-record limit.
    bool welcome(int profile=0,int first=0,int second=-1,bool respectAttractiveness=false,int seatingPreference=-1) {
        if(!validTicket({first,second}))return false;
        menuMessage=recipeReason(first);if(menuMessage.empty() && second>=0)menuMessage=recipeReason(second);if(!menuMessage.empty())return false;
        if(profile<0 || profile>=int(profiles.size()) || seatingPreference< -1 || seatingPreference>1 || admitted>=8000000 || closed || (profiles[std::size_t(profile)].takeaway && queue.claims().size()>=3) || guests.size()>=maximumVisitors || (respectAttractiveness && !profileRoom(profile)))return false;
        guests.reserve(maximumVisitors);
        const auto budget=profiles[std::size_t(profile)].patience+(profiles[std::size_t(profile)].takeaway?0:tableWaitBudget);
        auto c=runtime->arriveCustomer(budget);if(!c)return false;
        guests.push_back({c.value,GuestPhase::Queue});
        auto& g=guests.back();g.profile=profile;g.items={first,second};g.arrived=runtime->time();g.budget=budget;++admitted;
        g.tableService=!profiles[std::size_t(profile)].takeaway;
        g.seatingPreference=seatingPreference<0?(courtyardOpen() && profile==2?1:0):seatingPreference;
        if(g.tableService){g.remaining=tableWaitBudget;requestTable(g);g.phase=GuestPhase::ToSeat;}
        else require(queue.request(g.id));
        runtime->drainEvents();return true;
    }
    void leave(sim::CustomerId id,bool neutral=false) {
        auto* g=guest(id);if(!g)return;
        if(id==customer)observeBrew();
        auto c=runtime->customer(id);require(c);
        clearVisit(*g);g->prepared={};g->tray={};
        if(separatePatience(*g) && c.value.state!=sim::CustomerState::Served)g->remaining=0;
        if(c.value.state==sim::CustomerState::Waiting || c.value.state==sim::CustomerState::InService)require(runtime->abandon(id));
        if(!g->rating && c.value.state!=sim::CustomerState::Served)recordReview(*g,neutral?3:2,0);
        if(id==customer){clearServiceWork();retireShots();}
        if(!immediate && c.value.state==sim::CustomerState::Served && g->phase==GuestPhase::Dining && seats.claim(id) && !g->cleanup)g->cleanup=addTask("cafe:clean","cafe:cleaner",5,1000);
        queue.release(id);counter.release(id);if(!g->cleanup)seats.release(id);g->phase=GuestPhase::Leaving;
        runtime->drainEvents();refresh();
    }
    void departed(sim::CustomerId id) {
        auto* g=guest(id);if(!g || g->phase!=GuestPhase::Leaving)return;
        if(g->cleanup){g->hasDeparted=true;return;}
        require(runtime->forgetCustomer(id));std::erase_if(guests,[&](const auto& v){return v.id==id;});
        if(id==customer){customer={};order={};items={};}refresh();
    }
    void seated(sim::CustomerId id,std::size_t point,std::uint64_t token) {
        auto* g=guest(id);if(!g || g->phase!=GuestPhase::ToSeat)return;
        if(seats.occupy(id,point,token)){g->phase=GuestPhase::Dining;if(separatePatience(*g))g->remaining=profiles[std::size_t(g->profile)].patience;}
    }
    void payments() {
        for(const auto& receipt:runtime->pendingReceipts()) {
            auto ticket=runtime->order(receipt.order);require(ticket);
            if(receipt.amount!=ticket.value.price || receipt.id.value>lastPaid+1)throw std::runtime_error("Invalid cafe receipt");
            if(receipt.id.value>lastPaid) {
                require(ledger->post("cafe:sales",receipt.id.value-legacyServed,receipt.amount,runtime->time()));
                ++served;lastPaid=receipt.id.value;syncCash();
            }
            require(runtime->acknowledgeReceipt(receipt.id));
        }
        settleWages();
    }
    bool brew(bool immediateArrival=true) {
        return prepare(nextProduct(),immediateArrival);
    }
    bool prepare(int product,bool immediateArrival=true) {
        menuMessage.clear();
        auto reason=prepareReason(product);if(!reason.empty()){menuMessage=reason;return false;}
        if(!counter.claims().empty()) {
            auto owner=counter.claims().front().owner;auto c=runtime->customer(owner);require(c);
            if(c.value.state!=sim::CustomerState::Departed)return false;
            leave(owner);
        }
        if(customer && !guest(customer)) {require(runtime->forgetCustomer(customer));customer={};order={};items={};}
        if(!nextCustomer() && !welcome(0,0,-1,!immediate))return false;
        auto target=nextCustomer();
        auto* visitor=guest(target);std::vector<sim::OrderLine> lines;
        if(visitor->tableService && !visitor->orderTaken) {
            if(!immediateArrival)return false;
            auto seat=seats.claim(target);if(!seat || seat->point==Pool::waiting)return false;
            seated(target,seat->point,seat->token);visitor->orderTaken=true;
        }
        customer=target;
        for(int p:visitor->items)if(p>=0)lines.push_back({productResource(p),1,productRecipe(p)});
        auto o=runtime->acceptOrder(customer,lines,inventory,inventory,ticketPrice(visitor->items),sim::AbandonmentPolicy::CancelProduction,false);require(o);order=o.value;qualityMessage.clear();
        items={};
        for(std::size_t n=0;n<lines.size();++n) {
            items[n].product=visitor->items[n];
            if(definitions::menu[std::size_t(items[n].product)].shot) {
                auto shot=runtime->enqueue(shotRecipe(),inventory,inventory);require(shot);items[n].shot=shot.value;
            }
        }
        if(!visitor->tableService){require(queue.release(customer));require(counter.request(customer));visitor->phase=GuestPhase::Counter;}
        immediate=immediateArrival;runtime->drainEvents();refresh();beginServiceWork();refresh();return true;
    }
    void advance(double seconds) {
        if(!std::isfinite(seconds)||seconds<0||seconds>3600)throw std::invalid_argument("Invalid simulation delta");
        scheduleTick();campaignTick();scheduleTick();if(summary())return;
        const double ms=seconds*1000+fraction;
        auto whole=static_cast<std::int64_t>(std::floor(ms+1e-9));fraction=std::max(0.0,ms-double(whole));
        pending+=whole;
        for(int boundary=0;boundary<256;++boundary) {
        if(demandDue())demandArrival();
        auto step=pending;
        if(clockRunning())step=std::min(step,periodEnds[std::size_t(schedule.period)]-schedule.elapsed);
        for(const auto& w:crew)if(onShift(w.id))step=std::min(step,60000-w.worked%60000);
        for(const auto& task:tasks->tasks())if(task.state==sim::TaskState::Running && task.remaining>0)step=std::min(step,task.remaining);
        // Stop at production boundaries so dependent recipes start at the exact
        // completion time, independent of frame partitioning or travel time.
        if(active())for(auto id:productionJobs()) {
            auto j=runtime->job(id);require(j);
            if(j.value.state==sim::JobState::Running && j.value.deadline>runtime->time())step=std::min(step,j.value.deadline-runtime->time());
        }
        for(const auto& item:items)if(item.product>=0 && item.madeAt>=0) {
            auto deadline=item.madeAt+definitions::menu[std::size_t(item.product)].lifetime;
            if(deadline>runtime->time())step=std::min(step,deadline-runtime->time());
        }
        for(const auto& item:items)if(item.shot) {
            auto shot=runtime->job(item.shot).value;
            if(shot.state==sim::JobState::Completed && shot.deadline+45000>runtime->time())step=std::min(step,shot.deadline+45000-runtime->time());
        }
        if(automaticGuests && !closed)step=std::min(step,arrivals.remaining);
        // Resolve customer/freshness boundaries before scheduling later visits.
        for(const auto& g:guests) {
            auto c=runtime->customer(g.id);require(c);
            if(c.value.state==sim::CustomerState::Waiting || c.value.state==sim::CustomerState::InService)step=std::min(step,guestPatience(g));
            if(g.phase==GuestPhase::Dining && c.value.state==sim::CustomerState::Served && g.remaining>0)step=std::min(step,g.remaining);
            if(g.prepared)for(const auto& item:g.tray)if(item.product>=0) {
                auto deadline=item.madeAt+definitions::menu[std::size_t(item.product)].lifetime;
                if(deadline>runtime->time())step=std::min(step,deadline-runtime->time());
            }
        }
        if(drink && drink->madeAt+drink->lifetime>runtime->time())step=std::min(step,drink->madeAt+drink->lifetime-runtime->time());
        runtime->drainEvents();
        auto result=runtime->advance(step);require(result);pending-=result.value.consumed;
        if(clockRunning())schedule.elapsed+=result.value.consumed;
        if(automaticGuests && !closed)require(arrivals.elapse(result.value.consumed));
        // Pay the interval using availability before boundary effects (a guest
        // expiry may cancel preparation and begin a scheduled break at its end).
        if(campaignWorking())accrueStaff(result.value.consumed);
        for(auto& g:guests) {
            auto c=runtime->customer(g.id);require(c);
            if(separatePatience(g) && !g.rating && g.phase!=GuestPhase::Leaving) {
                g.remaining=std::max<std::int64_t>(0,g.remaining-result.value.consumed);
                if(!g.remaining){leave(g.id);continue;}
            }
            if(c.value.state==sim::CustomerState::Departed && g.phase!=GuestPhase::Leaving)leave(g.id);
            else if(g.phase==GuestPhase::Dining && c.value.state==sim::CustomerState::Served) {
                g.remaining=std::max<std::int64_t>(0,g.remaining-result.value.consumed);
                if(!g.remaining)leave(g.id);
            }
        }
        settleWages();supplyTick();qualityTick();workflowTick();qualityTick();tableServiceTick();payments();runtime->drainEvents();refresh();scheduleTick();campaignTick();scheduleTick();
        if(summary())break;
        if(result.value.blocked)break;
        if(!pending){if(demandDue())demandArrival();break;}
        }
    }
    bool serve(bool immediateSeating=true) {
        qualityTick();if(!ready || !handoverReady())return false;
        auto* visitor=guest(customer);if(!visitor || visitor->rating)return false;
        auto inputs=satisfactionInputs(*visitor);auto rating=sim::satisfaction(inputs,profiles[std::size_t(visitor->profile)].weights);require(rating);
        auto price=runtime->order(order).value.price;
        auto payment=ledger->prepare("cafe:sales",runtime->receiptSequence()+1-legacyServed,price,runtime->time());
        if(!payment){economyMessage=std::string(sim::describe(payment.error));return false;}
        auto result=runtime->deliver(order);require(result);
        require(ledger->commit(std::move(payment.value)));++served;lastPaid=result.value.value;syncCash();recordReview(*visitor,1,rating.value,inputs);payments();runtime->drainEvents();
        if(handoverReady()){auto t=tasks->task(serviceWork[2]).value();require(tasks->complete(t.id,t.worker,t.token));}
        clearServiceWork();retireShots();
        startDining(*visitor);
        if(visitor->tableService){visitor->prepared={};visitor->tray={};refresh();campaignTick();return true;}
        require(counter.release(customer));
        if(!serviceTableCount() || profiles[std::size_t(visitor->profile)].takeaway){leave(customer);refresh();campaignTick();return true;}
        requestTable(*guest(customer));guest(customer)->phase=GuestPhase::ToSeat;
        if(immediateSeating) {auto claim=seats.claim(customer);if(claim && claim->point!=Pool::waiting)seated(customer,claim->point,claim->token);}
        refresh();campaignTick();return true;
    }
    bool cancel() {
        if(!active())return false;
        leave(customer);qualityTick();return true;
    }
    void refresh() {
        auto inputs=runtime->stock(inventory,beans);auto outputs=runtime->stock(inventory,coffee);require(inputs);require(outputs);
        stock=int(inputs.value.available());inputHeld=int(inputs.value.reserved);outputHeld=int(outputs.value.reserved+outputs.value.reservedCapacity);
        brewing=0;ready=false;orderState=-1;jobState=-1;patience=0;
        if(order) {
            auto o=runtime->order(order);require(o);orderState=int(o.value.state);ready=o.value.state==sim::OrderState::Ready;
            patience=int(guest(customer)?guestPatience(*guest(customer))/1000:0);
            auto current=productionJob();if(current) {auto j=runtime->job(current);require(j);jobState=int(j.value.state);if(j.value.state==sim::JobState::Running)brewing=double(j.value.deadline-runtime->time())/1000;}
        }
        coins=int(wallet/100);observeBrew();
    }
    std::vector<std::uint8_t> save() const {
        std::vector<std::uint8_t> bytes;
        auto put=[&](std::uint64_t n){for(int i=0;i<8;++i)bytes.push_back(std::uint8_t(n>>(8*i)));};
        put(0x43414645);put(saveSchema);put(std::uint64_t(served));put(std::uint64_t(wallet));put(lastPaid);
        put(std::bit_cast<std::uint64_t>(fraction));put(std::uint64_t(pending));put(inventory.value);put(customer.value);put(order.value);
        auto core=runtime->save();put(core.size());bytes.insert(bytes.end(),core.begin(),core.end());
        saveEquipment(put);
        put(guests.size());for(const auto& g:guests){put(g.id.value);put(std::uint64_t(g.phase));put(std::uint64_t(g.remaining));saveTableGuest(g,put);}
        for(const auto* pool:{&queue,&counter,&seats}) {
            put(pool->claims().size());for(const auto& c:pool->claims()){put(c.owner.value);put(c.point==Pool::waiting?128:c.point);put(c.occupied);}
        }
        saveWorkflows(put);saveSupplies(put);saveEconomy(put);saveQuality(put);saveLayout(put);saveDemand(put);saveMenu(put);saveSchedule(put);saveCampaign(put);saveJournal(put);saveGardenStory(put);
        put(gardenState.selected?garden::requiredBit:0);
        put(gardenState.selected?garden::contentVersion:0);
        put(gardenState.selected?garden::fingerprint():0);
        put(std::uint64_t(gardenState.restoration));
        saveGardenLayout(put);
        auto content=currentContent();put(content.version);put(content.fingerprint);return bytes;
    }
    LoadResult restore(std::span<const std::uint8_t> bytes) {
        auto result=inspectSave(bytes,currentContent(),contentAccess);if(!result)return result;
        if(!load(bytes))return {LoadError::Malformed,result.sourceSchema};
        return result;
    }
    bool load(std::span<const std::uint8_t> bytes,bool checkpointOnly=false) {
        try {
            auto compatibility=inspectSave(bytes,currentContent(),contentAccess);if(!compatibility)return false;
            if(compatibility.sourceSchema>=9)bytes=bytes.first(bytes.size()-compatibilitySaveBytes);
            std::size_t cursor=0;
            auto get=[&](){if(bytes.size()-cursor<8)throw std::runtime_error("Truncated cafe save");std::uint64_t n=0;for(int i=0;i<8;++i)n|=std::uint64_t(bytes[cursor++])<<(8*i);return n;};
            if(get()!=0x43414645)return false;
            auto version=get();if(version!=saveSchema && version!=10 && version!=11 && version!=12 && version!=13 && version!=14 && version!=15 && version!=16 && version!=17 && version!=18 && version!=19 && version!=20 && version!=21 && version!=22 && version!=23)return false;
            auto count=get(),money=get(),paid=get(),fractionBits=get(),elapsed=get(),inv=get(),guest=get(),ticket=get(),length=get();
            const double rem=std::bit_cast<double>(fractionBits);
            if(count>(version>=5?4000000ULL:2000000ULL) || money>1000000000 || (version<5 && money!=count*500) || paid!=count || !std::isfinite(rem)||rem<0||rem>=1||elapsed>3600000||length>bytes.size()-cursor||bool(guest)!=bool(ticket))return false;
            Simulation candidate{100,0,version<13};candidate.qualitySuspended=true;
            candidate.contentAccess=contentAccess;
            // inspectSave validated the fixed-width expansion trailer. Establish
            // content selection before validating the nested opening checkpoint.
            if(version>=20){
                auto offset=bytes.size()-(version==20?garden::foundationSaveBytes:garden::saveBytes);
                candidate.gardenState.selected=bytes[offset]!=0;
                candidate.gardenState.restoration=garden::Restoration(bytes[offset+24]);
            }
            if(version>=23 && candidate.gardenState.selected)candidate.enableSummerCatalog();
            auto restored=candidate.runtime->restore(bytes.subspan(cursor,std::size_t(length)));if(!restored)return false;
            cursor+=std::size_t(length);
            if(version>=13 && !candidate.loadEquipment(get,version>=14,version>=15,version>=22,version>=23))return false;
            auto sequence=candidate.runtime->receiptSequence();auto receipts=candidate.runtime->pendingReceipts();
            if(sequence<paid||sequence>paid+1 || (version>=8 && !receipts.empty()))return false;
            if(sequence>paid&&(receipts.size()!=1||receipts[0].id.value!=sequence||receipts[0].amount!=500))return false;
            auto epoch=candidate.runtime->epoch();candidate.inventory={inv,epoch};
            candidate.customer={guest,guest?epoch:0};candidate.order={ticket,ticket?epoch:0};
            candidate.served=int(count);candidate.wallet=std::int64_t(money);candidate.lastPaid=paid;candidate.fraction=rem;candidate.pending=std::int64_t(elapsed);
            if(ticket) {
                auto o=candidate.runtime->order(candidate.order);auto c=candidate.runtime->customer(candidate.customer);
                if(!o||!c||o.value.customer!=candidate.customer||c.value.order!=candidate.order||o.value.output!=candidate.inventory||o.value.jobs.empty()||o.value.jobs.size()>2)return false;
            }
            if(version>=2) {
                auto n=get();if(n>maximumVisitors)return false;
                while(n--) {
                    auto id=get(),phase=get(),dwell=get();
                    if(!id || phase>4 || dwell>std::uint64_t(version>=19?tableWaitBudget:8000) || candidate.guest({id,epoch}))return false;
                    auto c=candidate.runtime->customer({id,epoch});if(!c)return false;
                    const auto p=GuestPhase(phase);
                    candidate.guests.push_back({{id,epoch},p,std::int64_t(dwell)});
                    if(version>=18 && !candidate.loadTableGuest(candidate.guests.back(),get,version>=22))return false;
                    bool table=candidate.guests.back().tableService;
                    if((p==GuestPhase::Queue && c.value.state!=sim::CustomerState::Waiting) ||
                       (p==GuestPhase::Counter && (id!=guest || c.value.state!=sim::CustomerState::InService)) ||
                       ((p==GuestPhase::ToSeat || p==GuestPhase::Dining) && c.value.state!=sim::CustomerState::Served && !(table && (c.value.state==sim::CustomerState::Waiting || c.value.state==sim::CustomerState::InService))) ||
                       (p==GuestPhase::Leaving && c.value.state!=sim::CustomerState::Served && c.value.state!=sim::CustomerState::Departed))return false;

                }
                int kind=0;
                for(auto* pool:{&candidate.queue,&candidate.counter,&candidate.seats}) {
                    n=get();if(n>maximumVisitors)return false;std::vector<Pool::Claim> claims;
                    while(n--) {
                        auto owner=get(),point=get(),occupied=get();auto* g=candidate.guest({owner,epoch});
                        if(!g || point>128 || occupied>1 || (kind==0 && g->phase!=GuestPhase::Queue) ||
                           (kind==1 && g->phase!=GuestPhase::Counter) ||
                           (kind==2 && g->phase!=GuestPhase::ToSeat && g->phase!=GuestPhase::Dining && !(version>=3 && g->phase==GuestPhase::Leaving)))return false;
                        if(g->phase==GuestPhase::Dining && (!occupied || point==128))return false;
                        claims.push_back({{owner,epoch},point==128?Pool::waiting:std::size_t(point),0,bool(occupied)});
                    }
                    if(kind==2 && version<14) {
                        // Older envelopes have no early table mask. Reconstruct
                        // only occupied points, then validate against the layout.
                        std::array<std::uint8_t,6> enabled{};
                        for(const auto& claim:claims)if(claim.point!=Pool::waiting){if(claim.point>=4)return false;enabled[claim.point]=1;}
                        if(!pool->setEnabled(enabled))return false;
                    }
                    if(!pool->restore(claims))return false;++kind;
                }
                for(const auto& g:candidate.guests)if(g.phase!=GuestPhase::Leaving) {
                    auto* pool=g.phase==GuestPhase::Queue?&candidate.queue:g.phase==GuestPhase::Counter?&candidate.counter:&candidate.seats;
                    if(!pool->claim(g.id))return false;
                }
                auto service=candidate.runtime->serviceQueue();
                std::vector<sim::CustomerId> waiting;
                for(const auto& g:candidate.guests)if(candidate.runtime->customer(g.id).value.state==sim::CustomerState::Waiting)waiting.push_back(g.id);
                if(service!=waiting)return false;
                if(ticket && candidate.runtime->order(candidate.order).value.state<=sim::OrderState::Ready && !candidate.guest(candidate.customer))return false;
            } else if(ticket && candidate.runtime->order(candidate.order).value.state<=sim::OrderState::Ready) {
                candidate.guests.push_back({candidate.customer,GuestPhase::Counter});require(candidate.counter.request(candidate.customer));
            }
            candidate.immediate=immediate;candidate.refresh();
            if(version>=3){if(!candidate.loadWorkflows(get,version>=6,version>=11,version>=13,version>=23))return false;}
            else {
                candidate.staff={staff.value,epoch};candidate.createBoard();require(candidate.tasks->advance(candidate.runtime->time()));
                if(candidate.active()) {
                    bool hostMode=candidate.immediate;candidate.immediate=candidate.jobState>=int(sim::JobState::Running)?true:hostMode;candidate.beginServiceWork();candidate.immediate=hostMode;
                }
            }
            if(version>=4){if(!candidate.loadSupplies(get,version>=13))return false;}
            else candidate.createSupplies();
            if(version>=5){if(!candidate.loadEconomy(get,version>=11))return false;}
            else {candidate.legacyServed=count;candidate.ledger=std::make_unique<sim::Ledger>(std::int64_t(money),128,18);candidate.staffedMs=0;candidate.pendingSupplyCost=0;}
            if(version>=6){if(!candidate.loadQuality(get))return false;}else candidate.migrateQuality();
            if(version>=7){if(!candidate.loadLayout(get,version>=12,version>=13,version>=23))return false;}
            else if(candidate.ledger->sequence("cafe:furniture-buys") || candidate.ledger->sequence("cafe:furniture-sales"))return false;
            if(version>=8){if(!candidate.loadDemand(get,version>=9))return false;}else candidate.migrateDemand(version);
            if(!candidate.loadMenu(get,version>=13))return false;
            if(version>=16 && !candidate.loadSchedule(get))return false;
            if(version>=12 && !candidate.loadCampaign(get,checkpointOnly,version>=13,version>=16,version>=24))return false;
            if(version>=17){if(!candidate.loadJournal(get))return false;}else candidate.migrateJournal();
            if(version>=24 && !candidate.loadGardenStory(get))return false;
            if(version>=20)for(int n=0;n<4;++n)get();
            if(version>=21 && !candidate.loadGardenLayout(get))return false;
            if(version<21 && (candidate.ledger->sequence("garden:table-buys") || candidate.ledger->sequence("garden:table-sales")))return false;
            if(!candidate.validGardenConnection(candidate.layout))return false;
            if(!candidate.restoreSeating(version>=22))return false;
            if(version<16)candidate.migrateSchedule();
            if(!candidate.validSchedule())return false;
            if(version<12 && (candidate.ledger->sequence("cafe:overhead") || candidate.ledger->sequence("cafe:goals")))return false;
            if(cursor!=bytes.size())return false;
            for(auto& g:candidate.guests) {
                const auto duration=diningDuration(g.items);
                // Preserve the fraction left in older eight-second visits.
                if(version<19)g.remaining=(g.remaining*duration+7999)/8000;
                const auto limit=candidate.separatePatience(g) && !g.rating? (g.phase==GuestPhase::ToSeat?tableWaitBudget:profiles[std::size_t(g.profile)].patience):duration;
                if(g.remaining>limit || (candidate.separatePatience(g) && !g.rating && g.phase!=GuestPhase::Leaving && !g.remaining))return false;
            }
            if(version<13){for(std::size_t n=6;n<8;++n)require(candidate.runtime->defineProcess(definitions::processes[n]));candidate.createAnnex();candidate.runtime->drainEvents();}
            if(!candidate.validateEquipment())return false;
            if(!candidate.validGardenStory())return false;
            if(version<23 && candidate.gardenState.selected)candidate.enableSummerCatalog();
            candidate.refresh();candidate.payments();candidate.refresh();
            if(version<8)candidate.baselineServed=std::uint64_t(candidate.served);
            // Publish the entire validated game envelope together. Constants stay fixed.
            runtime.swap(candidate.runtime);inventory=candidate.inventory;customer=candidate.customer;order=candidate.order;gardenStory=std::move(candidate.gardenStory);
            served=candidate.served;wallet=candidate.wallet;lastPaid=candidate.lastPaid;fraction=candidate.fraction;pending=candidate.pending;
            coins=candidate.coins;brewing=candidate.brewing;ready=candidate.ready;
            orderState=candidate.orderState;jobState=candidate.jobState;stock=candidate.stock;
            inputHeld=candidate.inputHeld;outputHeld=candidate.outputHeld;patience=candidate.patience;
            preparationChoice={};guests.swap(candidate.guests);std::swap(queue,candidate.queue);std::swap(counter,candidate.counter);std::swap(seats,candidate.seats);
            staff=candidate.staff;tasks.swap(candidate.tasks);serviceWork=candidate.serviceWork;
            assistTask=candidate.assistTask;
            crew=std::move(candidate.crew);restockWork=candidate.restockWork;retiredWorked=candidate.retiredWorked;retiredWages=candidate.retiredWages;staffMessage.clear();
            storage=candidate.storage;supplies.swap(candidate.supplies);automaticSupply=candidate.automaticSupply;
            ledger.swap(candidate.ledger);staffedMs=candidate.staffedMs;pendingSupplyCost=candidate.pendingSupplyCost;legacyServed=candidate.legacyServed;economyMessage.clear();
            machineCondition=candidate.machineCondition;drink=candidate.drink;batchQuality=candidate.batchQuality;wasted=candidate.wasted;
            maintenanceTask=candidate.maintenanceTask;maintenance=candidate.maintenance;maintenanceCost=candidate.maintenanceCost;qualitySuspended=false;qualityMessage.clear();
            std::swap(layout,candidate.layout);closed=candidate.closed;layoutMessage.clear();
            demandRandom=candidate.demandRandom;arrivals=candidate.arrivals;automaticGuests=candidate.automaticGuests;
            admitted=candidate.admitted;missed=candidate.missed;deliveredReviews=candidate.deliveredReviews;failedReviews=candidate.failedReviews;
            totalSatisfaction=candidate.totalSatisfaction;baselineServed=candidate.baselineServed;
            lastOutcome=candidate.lastOutcome;lastScore=candidate.lastScore;lastProfile=candidate.lastProfile;lastInputs=candidate.lastInputs;
            items=candidate.items;menuMessage.clear();
            campaign=std::move(candidate.campaign);schedule=candidate.schedule;campaignMessage.clear();
            journal=candidate.journal;
            fastMachine=candidate.fastMachine;extraStation=candidate.extraStation;extraStorage=candidate.extraStorage;annex=candidate.annex;finish=candidate.finish;
            buildBuys=candidate.buildBuys;buildSales=candidate.buildSales;restockAnnex=candidate.restockAnnex;equipmentMessage.clear();
            plantStyles=candidate.plantStyles;potStyles=candidate.potStyles;
            summerCatalog=candidate.summerCatalog;coldStation=candidate.coldStation;
            gardenState=candidate.gardenState;
            std::swap(gardenLayout,candidate.gardenLayout);gardenBuys=candidate.gardenBuys;gardenSales=candidate.gardenSales;
            return true;
        } catch(const std::exception&) { return false; }
    }
};
}
