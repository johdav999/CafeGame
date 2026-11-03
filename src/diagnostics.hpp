#pragma once
#include "scenarios.hpp"

namespace cafe {
inline std::string staffView(const Simulation& g);
inline std::string campaignView(const Simulation& g);
inline std::string jsonText(std::string_view value);
inline std::string gardenStoryView(const Simulation& g) {
    const auto& s=g.gardenStory;
    auto partyReason=g.gardenPartyReason();
    if(s.party==Simulation::GardenParty::Prepared){auto blocked=g.gardenPartyReason(true);if(!blocked.empty())partyReason=std::move(blocked);}
    std::string out="{\"started\":"+std::to_string(s.started)+",\"chapters\":"+std::to_string(s.chapters)+",\"available\":"+std::to_string(g.contentAccess.available())+
        ",\"startReason\":"+jsonText(g.gardenStartReason())+",\"partyReason\":"+jsonText(partyReason)+
        ",\"party\":"+std::to_string(int(s.party))+",\"attempts\":"+std::to_string(s.attempts)+",\"partyDay\":"+std::to_string(s.partyDay)+
        ",\"served\":"+std::to_string(s.party==Simulation::GardenParty::Running?std::uint64_t(g.served)-s.baseline[0]:s.partyServed)+
        ",\"average\":"+std::to_string(s.party==Simulation::GardenParty::Running?(g.deliveredReviews>s.baseline[1]?(g.totalSatisfaction-s.baseline[2])/(g.deliveredReviews-s.baseline[1]):0):s.partyScore)+
        ",\"outdoorServed\":"+std::to_string(s.outdoorServed)+",\"summerMask\":"+std::to_string(s.summerMask)+",\"metMask\":"+std::to_string(s.metMask)+
        ",\"full\":"+std::to_string(s.fullParty)+",\"rewards\":"+std::to_string(g.credited("garden:chapters"))+",\"regulars\":[";
    for(std::size_t n=0;n<3;++n){if(n)out+=",";const auto& r=s.regulars[n];
        out+="{\"name\":"+jsonText(Simulation::gardenRegularNames[n])+",\"role\":"+jsonText(Simulation::gardenRegularRoles[n])+",\"story\":"+jsonText(s.chapters==31?Simulation::gardenRegularEndings[n]:(s.metMask&(1u<<n))?Simulation::gardenRegularFollowups[n]:Simulation::gardenRegularStories[n])+
             ",\"preference\":"+jsonText(definitions::menu[std::size_t(r.preference)].name)+",\"visits\":"+std::to_string(r.visits)+",\"reviews\":"+std::to_string(r.reviews)+",\"average\":"+std::to_string(r.reviews?r.satisfaction/r.reviews:0)+",\"lastDay\":"+std::to_string(r.lastDay)+",\"reason\":"+jsonText(g.gardenInviteReason(int(n)))+"}";
    }return out+"]}";
}
inline std::string equipmentView(const Simulation& g);
inline std::string clockView(const Simulation& g);
inline std::string jsonText(std::string_view value) {
    std::string out="\"";
    for(unsigned char c:value) {
        if(c=='"' || c=='\\'){out+='\\';out+=char(c);}
        else if(c<32){constexpr char hex[]="0123456789abcdef";out+="\\u00";out+=hex[c>>4];out+=hex[c&15];}
        else out+=char(c);
    }
    return out+'"';
}
struct ActionExplanation {
    int command;std::string name,reason;
    ActionExplanation(int c,std::string_view n,std::string_view r):command(c),name(n),reason(r){}
    bool enabled() const {return reason.empty();}
};
// Host navigation is an explicit input, never inferred from logical occupancy.
inline std::vector<ActionExplanation> explainActions(const Simulation& g,bool atCounter=true) {
    auto state=g.machineCondition.snapshot();auto stored=g.storedBeans();
    auto target=g.runtime->stock(g.inventory,g.beans).value;
    auto brew=g.prepareReason(0);
    std::string_view serve=!g.ready?"Prepare every item on the ticket first":!g.handoverReady()?"Wait for staff to reach handover":!atCounter?"Wait for the guest to reach the counter":std::string_view{};
    auto care=g.maintenance!=Simulation::Maintenance::None?std::string_view{"Wait for or cancel machine care"}:std::string_view{};
    std::vector<ActionExplanation> actions{
        {0,"Brew espresso",brew},{1,"Serve ticket",serve},
        {5,"Cancel order",g.active()?"":"There is no active order"},
        {6,"Welcome guest",g.closed?"Reopen the cafe first":g.queue.claims().size()>=3?"The queue is full":!g.visitorRoom()?"Cafe visitor limit reached; wait for a guest to leave":g.admitted>=8000000?"Guest admission limit reached":""},
        {8,"Order 12 beans",g.incomingSupply()?"A delivery already reserves incoming space":stored.capacity-stored.total-stored.reservedCapacity<12?"Make room in the storeroom":g.availableCash()<1200?"Earn 12.00 available cash after wages":""},
        {9,"Restock machine",g.restockWork[0]?"Staff are already restocking beans":!stored.available()?"Wait for a bean delivery":target.capacity-target.total-target.reservedCapacity<=0?"The machine inventory is full":""},
        {11,"Cancel delivery",g.incomingSupply()?"":"There is no pending delivery"},
        {12,"Clean machine",!care.empty()?care:state.cleanliness==1000?"The machine is already clean":""},
        {13,"Repair machine",!care.empty()?care:state.integrity==1000?"The machine is already in full condition":g.availableCash()<g.repairPrice()?"Earn enough available cash for this machine's repair":""},
        {14,"Cancel maintenance",g.maintenance!=Simulation::Maintenance::None?"":"There is no pending machine care"}
    };
    for(int p=1;p<5;++p)actions.emplace_back(20+p,definitions::menu[std::size_t(p)].name,g.prepareReason(p));
    return actions;
}
inline std::string shiftReport(const Simulation& g) {
    auto rng=g.demandRandom.snapshot();
    std::string out="{\"schema\":1,\"kind\":\"shift-snapshot\",\"timeMs\":"+std::to_string(g.runtime->time());
    auto number=[&](const char* key,auto value){out+=",\""+std::string(key)+"\":"+std::to_string(value);};
    auto stamp=currentContent();number("saveSchema",saveSchema);number("contentVersion",stamp.version);number("ruleRevision",ruleRevision);
    out+=",\"contentFingerprint\":"+jsonText(std::to_string(stamp.fingerprint));
    number("served",g.served);number("cashMinor",g.wallet);number("profitMinor",g.profit());
    number("salesMinor",g.credited("cafe:sales"));number("suppliesMinor",g.debited("cafe:purchases")-g.credited("cafe:refunds"));
    number("wagesMinor",g.debited("cafe:wages"));number("wagesDueMinor",g.wagesDue());number("wasted",g.wasted);
    number("hiringMinor",g.debited("cafe:hires"));number("staffCount",g.crew.size());
    number("campaign",g.campaign.enabled);number("day",g.campaign.day);number("dayPhase",int(g.campaign.phase));
    number("overheadMinor",g.debited("cafe:overhead"));number("goalRewardsMinor",g.credited("cafe:goals"));
    number("upgradesMinor",g.debited("cafe:upgrades")-g.credited("cafe:resale"));number("tables",g.serviceTableCount());
    number("admitted",g.admitted);number("missed",g.missed);number("reviews",g.reviewCount());
    number("deliveredReviews",g.deliveredReviews);number("failedReviews",g.failedReviews);number("reputation",g.reputation());
    auto appeal=g.attractiveness();number("attractiveness",appeal.total);
    number("attractivenessMenu",appeal.menu);number("attractivenessExperience",appeal.experience);number("attractivenessFurnishings",appeal.furnishings);number("visitorLimit",g.visitorLimit());number("visitingGuests",g.visitingGuests());
    number("randomState",rng.value);number("randomDraws",rng.draws);number("arrivalsInMs",g.arrivals.remaining);
    number("automaticGuests",g.automaticGuests);number("automaticSupply",g.automaticSupply);
    if(g.gardenStory.started){number("gardenChapters",g.gardenStory.chapters);number("gardenRewardsMinor",g.credited("garden:chapters"));number("gardenPartyAttempts",g.gardenStory.attempts);number("gardenPartyState",int(g.gardenStory.party));}
    if(g.summerCatalog){
        number("coldStationInstalled",bool(g.coldStation));
        const std::array<std::string,3> keys{"ice","lemonBase","cakeStock"};
        for(std::size_t n=5;n<8;++n){const auto& key=keys[n-5];auto stored=g.storedIngredient(n);
            number((key+"Ready").c_str(),g.runtime->stock(g.inventory,g.ingredient(n)).value.available());
            number((key+"Stored").c_str(),stored.total);number((key+"Incoming").c_str(),stored.reservedCapacity);
        }
    }
    return out+"}";
}
inline std::string inspectShift(const Simulation& g,bool atCounter=true) {
    auto usage=g.runtime->metrics();
    std::string out="{\"report\":"+shiftReport(g)+",\"runtime\":{\"inventories\":"+std::to_string(usage.inventories)+",\"reservations\":"+std::to_string(usage.reservations)+",\"jobs\":"+std::to_string(usage.jobs)+",\"customers\":"+std::to_string(usage.customers)+",\"orders\":"+std::to_string(usage.orders)+",\"receipts\":"+std::to_string(usage.receipts)+",\"events\":"+std::to_string(usage.events)+",\"jobLimit\":"+std::to_string(usage.limits.jobs)+",\"customerLimit\":"+std::to_string(usage.limits.customers)+"},\"stocks\":[";
    bool comma=false;
    std::vector<std::pair<sim::InventoryId,sim::ResourceId>> inventories;
    for(std::size_t n=0;n<g.resourceCount();++n)inventories.push_back({g.inventory,definitions::resources[n]});
    for(std::size_t n=0;n<g.ingredientCount();++n)inventories.push_back({g.storage,g.ingredient(n)});
    for(std::size_t n=0;n<g.ingredientCount();++n)inventories.push_back({g.annex,g.ingredient(n)});
    for(const auto& entry:inventories) {
        auto stock=g.runtime->stock(entry.first,entry.second);Simulation::require(stock);
        if(comma)out+=",";comma=true;const auto& s=stock.value;
        out+="{\"inventory\":"+std::to_string(entry.first.value)+",\"resource\":"+jsonText(s.resource.value)+",\"total\":"+std::to_string(s.total)+",\"available\":"+std::to_string(s.available())+",\"held\":"+std::to_string(s.reserved)+",\"incoming\":"+std::to_string(s.reservedCapacity)+",\"capacity\":"+std::to_string(s.capacity)+"}";
    }
    out+="],\"jobs\":[";
    if(g.order) {
        auto order=g.runtime->order(g.order);Simulation::require(order);comma=false;
        for(auto id:g.productionJobs()) {
            auto job=sim::inspectJob(*g.runtime,id);Simulation::require(job);const auto& j=job.value;
            if(comma)out+=",";comma=true;
            out+="{\"id\":"+std::to_string(id.value)+",\"order\":"+std::to_string(j.job.order.value)+",\"worker\":"+std::to_string(j.job.worker.value)+",\"station\":"+std::to_string(j.job.station.value)+",\"process\":"+jsonText(j.job.process.value)+",\"state\":"+std::to_string(int(j.job.state))+",\"remainingMs\":"+std::to_string(j.remaining)+",\"reason\":"+jsonText(j.explanation)+"}";
        }
    }
    out+="],\"tasks\":[";comma=false;
    for(const auto& t:g.tasks->tasks()) {
        if(comma)out+=",";comma=true;
        out+="{\"id\":"+std::to_string(t.id.value)+",\"key\":"+jsonText(t.spec.key)+",\"role\":"+jsonText(t.spec.role)+",\"priority\":"+std::to_string(t.spec.priority)+",\"state\":"+std::to_string(int(t.state))+",\"worker\":"+std::to_string(t.worker.value)+",\"remainingMs\":"+std::to_string(t.remaining)+",\"dependencies\":[";
        for(std::size_t i=0;i<t.spec.dependencies.size();++i){if(i)out+=",";out+=std::to_string(t.spec.dependencies[i].value);}out+="]}";
    }
    out+="],\"claims\":[";comma=false;int pool=0;
    for(const auto* p:{&g.queue,&g.counter,&g.seats}) {
        for(const auto& c:p->claims()) {
            if(comma)out+=",";comma=true;
            out+="{\"pool\":"+std::to_string(pool)+",\"guest\":"+std::to_string(c.owner.value)+",\"point\":"+(c.point==Simulation::Pool::waiting?"null":std::to_string(c.point))+",\"occupied\":"+std::to_string(c.occupied)+"}";
        }++pool;
    }
    out+="],\"actions\":[";comma=false;
    for(const auto& a:explainActions(g,atCounter)) {
        if(comma)out+=",";comma=true;
        out+="{\"command\":"+std::to_string(a.command)+",\"name\":"+jsonText(a.name)+",\"enabled\":"+(a.enabled()?"true":"false")+",\"reason\":"+jsonText(a.reason)+"}";
    }
    return out+"],\"staff\":"+staffView(g)+",\"campaign\":"+campaignView(g)+",\"equipment\":"+equipmentView(g)+",\"clock\":"+clockView(g)+"}";
}
inline std::string equipmentView(const Simulation& g) {
    std::string out="{\"editable\":"+std::to_string(g.layoutEditable())+",\"fast\":"+std::to_string(g.fastMachine)+",\"station\":"+std::to_string(bool(g.extraStation))+
        ",\"extraStorage\":"+std::to_string(g.extraStorage)+",\"finish\":"+std::to_string(g.finish)+",\"netCost\":"+std::to_string(g.debited("cafe:upgrades")-g.credited("cafe:resale"))+
        ",\"extraTablesReason\":"+jsonText(g.extraTablesReason())+
        ",\"message\":"+jsonText(g.equipmentMessage)+",\"catalog\":[";
    for(int key=0;key<8;++key){if(key)out+=",";const auto& item=Simulation::buildItems[std::size_t(key)];
        out+="{\"key\":"+std::to_string(key)+",\"id\":"+std::to_string(item.id)+",\"name\":"+jsonText(item.name)+",\"price\":"+std::to_string(item.price)+",\"refund\":"+std::to_string(item.refund)+
            ",\"width\":"+std::to_string(item.width)+",\"depth\":"+std::to_string(item.depth)+",\"x\":"+std::to_string(item.x)+",\"z\":"+std::to_string(item.z)+",\"owned\":"+std::to_string(g.ownsBuild(key))+
            ",\"effect\":"+jsonText(item.effect)+",\"gate\":"+jsonText(g.buildGate(key))+
            ",\"buyReason\":"+jsonText(g.buildReason(0,key,item.x,item.z,0))+",\"sellReason\":"+jsonText(g.buildReason(2,key,0,0,0))+"}";}
    out+="],\"plantStyles\":["+std::to_string(g.plantStyles[0])+","+std::to_string(g.plantStyles[1])+"],\"potStyles\":["+std::to_string(g.potStyles[0])+","+std::to_string(g.potStyles[1])+"],\"plantNames\":[";
    for(std::size_t n=0;n<g.plantNames.size();++n){if(n)out+=",";out+=jsonText(g.plantNames[n]);}
    out+="],\"potNames\":[";for(std::size_t n=0;n<g.potNames.size();++n){if(n)out+=",";out+=jsonText(g.potNames[n]);}
    return out+"]}";
}
inline std::string journalView(const Simulation& g) {
    const auto& j=g.journal;
    std::string out="{\"eligible\":"+std::to_string(j.eligible)+",\"days\":"+std::to_string(j.days)+
        ",\"earned\":"+std::to_string(std::popcount(j.achievements))+",\"totalRewards\":"+std::to_string(g.credited("cafe:daily")+g.credited("cafe:achievements"))+
        ",\"dailyRewards\":"+std::to_string(std::popcount(j.daily)*Simulation::dailyReward)+
        ",\"achievementRewards\":"+std::to_string(std::popcount(j.newAchievements)*Simulation::achievementReward)+",\"daily\":[";
    auto selection=g.dailySelection();
    for(std::size_t slot=0;slot<3;++slot) {
        if(slot)out+=",";auto id=selection[slot];const auto& goal=Simulation::dailyGoals[id];
        out+="{\"id\":"+std::to_string(id)+",\"name\":"+jsonText(goal.name)+",\"description\":"+jsonText(goal.description)+
            ",\"progress\":"+std::to_string(std::min(goal.target,g.dailyProgress(id)))+",\"target\":"+std::to_string(goal.target)+
            ",\"complete\":"+std::to_string(bool(j.daily&(std::uint64_t(1)<<slot)))+",\"reward\":"+std::to_string(Simulation::dailyReward)+"}";
    }
    out+="],\"achievements\":[";
    for(std::size_t id=0;id<Simulation::lifetimeGoals.size();++id) {
        if(id)out+=",";auto bit=std::uint64_t(1)<<id;const auto& goal=Simulation::lifetimeGoals[id];
        out+="{\"id\":"+std::to_string(id)+",\"name\":"+jsonText(goal.name)+",\"description\":"+jsonText(goal.description)+
            ",\"progress\":"+std::to_string((j.achievements&bit)?goal.target:std::min(goal.target,g.lifetimeProgress(id)))+",\"target\":"+std::to_string(goal.target)+
            ",\"complete\":"+std::to_string(bool(j.achievements&bit))+",\"new\":"+std::to_string(bool(j.newAchievements&bit))+
            ",\"reward\":"+std::to_string(Simulation::achievementReward)+"}";
    }
    return out+"]}";
}
inline std::string clockView(const Simulation& g) {
    const auto& s=g.schedule;
    return "{\"day\":"+std::to_string(s.day)+",\"minutes\":"+std::to_string(g.clockMinutes())+
        ",\"elapsedMs\":"+std::to_string(s.elapsed)+",\"period\":"+std::to_string(s.period)+",\"stage\":"+std::to_string(int(s.stage))+
        ",\"name\":"+jsonText(Simulation::periodNames[std::size_t(s.period)])+
        ",\"start\":"+std::to_string(480+(s.period?Simulation::periodEnds[std::size_t(s.period-1)]/1000:0))+
        ",\"end\":"+std::to_string(480+Simulation::periodEnds[std::size_t(s.period)]/1000)+
        ",\"running\":"+(g.clockRunning()?"true":"false")+",\"canContinue\":"+(g.canContinuePeriod()?"true":"false")+"}";
}
inline std::string campaignView(const Simulation& g) {
    const auto& c=g.campaign;auto d=g.dayTotals();
    std::string out="{\"enabled\":"+std::to_string(c.enabled)+",\"day\":"+std::to_string(c.day)+",\"phase\":"+std::to_string(int(c.phase))+
        ",\"remainingMs\":"+std::to_string(std::max<std::int64_t>(0,Simulation::shiftLength-g.schedule.elapsed))+
        ",\"goals\":"+std::to_string(c.goals)+",\"unlocked\":"+std::to_string(g.unlockedMask())+",\"restart\":"+std::to_string(!c.checkpoint.empty())+
        ",\"canOpen\":"+std::to_string(c.enabled && c.phase==Simulation::DayPhase::Preparation && g.tasks->tasks().empty() && !g.incomingSupply() && (g.gardenStory.party!=Simulation::GardenParty::Prepared || g.gardenPartyReason(true).empty()))+
        ",\"canNext\":"+std::to_string(g.summary() && c.day<365 && !g.wagesDue() && !g.overheadDue())+
        ",\"overheadDue\":"+std::to_string(g.overheadDue())+",\"wagesDue\":"+std::to_string(g.wagesDue())+",\"profit\":"+std::to_string(g.dayProfit())+
        ",\"overhead\":"+std::to_string(g.summary()?Simulation::dayOverhead:0)+",\"message\":"+jsonText(g.campaignMessage)+",\"totals\":[";
    for(std::size_t n=0;n<d.size();++n){if(n)out+=",";out+=std::to_string(d[n]);}out+="],\"objectives\":[";
    for(int n=0;n<4;++n){if(n)out+=",";out+=jsonText(Simulation::goalNames[std::size_t(n)]);}out+="],\"regulars\":[";
    for(std::size_t n=0;n<3;++n){if(n)out+=",";const auto& r=c.regulars[n];out+="{\"name\":"+jsonText(Simulation::regularNames[n])+",\"preference\":"+jsonText(definitions::menu[std::size_t(r.preference)].name)+",\"visits\":"+std::to_string(r.visits)+",\"reviews\":"+std::to_string(r.reviews)+",\"average\":"+std::to_string(r.reviews?r.satisfaction/r.reviews:0)+",\"lastScore\":"+std::to_string(r.lastScore)+"}";}
    return out+"],\"journal\":"+journalView(g)+",\"garden\":"+gardenStoryView(g)+"}";
}
inline std::string authoredContent() {
    std::string out="{\"scenarios\":[";
    for(std::size_t i=0;i<scenarios.size();++i) {
        if(i)out+=",";const auto& s=scenarios[i];
        out+="{\"key\":"+jsonText(s.key)+",\"name\":"+jsonText(s.name)+",\"description\":"+jsonText(s.description)+"}";
    }
    out+="],\"processes\":[";
    for(std::size_t i=0;i<definitions::processes.size();++i) {
        if(i)out+=",";const auto& p=definitions::processes[i];
        out+="{\"key\":"+jsonText(p.id.value)+",\"durationMs\":"+std::to_string(p.duration)+",\"capability\":"+jsonText(p.capability)+"}";
    }
    out+="],\"profiles\":[";
    for(std::size_t i=0;i<definitions::profiles.size();++i) {
        if(i)out+=",";const auto& p=definitions::profiles[i];
        out+="{\"name\":"+jsonText(p.name)+",\"patienceMs\":"+std::to_string(p.patience)+",\"takeaway\":"+(p.takeaway?"true":"false")+"}";
    }
    return out+"]}";
}
inline std::string menuView(const Simulation& g) {
    std::string out="{\"summer\":"+std::to_string(g.summerCatalog)+",\"message\":"+jsonText(g.menuMessage)+",\"next\":"+std::to_string(g.nextProduct())+",\"products\":[";
    for(int p=0;p<8;++p) {
        if(p)out+=",";const auto& product=definitions::menu[std::size_t(p)];
        out+="{\"name\":"+jsonText(product.name)+",\"unlocked\":"+(g.unlocked(p)?"true":"false")+",\"price\":"+std::to_string(product.price)+",\"reason\":"+jsonText(g.prepareReason(p))+"}";
    }
    out+="],\"tickets\":[";bool comma=false;
    for(const auto& guest:g.guests) {
        if(comma)out+=",";comma=true;
        out+="{\"guest\":"+std::to_string(guest.id.value)+",\"name\":"+jsonText(g.regularName(guest.regular))+",\"phase\":"+std::to_string(int(guest.phase))+",\"price\":"+std::to_string(g.ticketPrice(guest.items))+",\"table\":"+std::to_string(guest.tableService)+",\"taken\":"+std::to_string(guest.orderTaken)+",\"paid\":"+std::to_string(guest.rating!=0)+",\"service\":"+jsonText(g.tableStatus(guest))+",\"takeaway\":"+std::to_string(Simulation::profiles[std::size_t(guest.profile)].takeaway)+",\"seatingPreference\":"+jsonText(g.seatingPreferenceName(guest))+",\"destination\":"+jsonText(g.tableDestination(guest))+",\"serviceReason\":"+jsonText(g.tableServiceReason(guest))+",\"seat\":"+(g.seats.claim(guest.id) && g.seats.claim(guest.id)->point!=Simulation::Pool::waiting?std::to_string(g.seats.claim(guest.id)->point):"null")+",\"items\":[";
        for(int n=0;n<2;++n) {
            int p=guest.items[std::size_t(n)];if(p<0)continue;if(n)out+=",";
            std::string status=guest.rating==1?"Served":guest.rating?"Cancelled":"Waiting";
            std::int64_t remaining=0;int quality=0;
            if(guest.id==g.customer && g.active()) {
                const auto& item=g.items[std::size_t(n)];auto o=g.runtime->order(g.order).value;auto j=g.runtime->job(o.jobs[std::size_t(n)]).value;
                if(item.madeAt>=0) {
                    auto fresh=sim::Freshness{item.madeAt,definitions::menu[std::size_t(p)].lifetime,item.quality}.sample(g.runtime->time()).value;
                    status="Ready for handover";remaining=fresh.remaining;quality=fresh.score;
                } else if(item.shot && g.runtime->job(item.shot).value.state!=sim::JobState::Completed)status="Brew espresso shot";
                else if(j.state==sim::JobState::Running || j.state==sim::JobState::Assigned)status=p==1?"Add hot water":p==2?"Steam milk":p==3?"Steep tea":p==4?"Plate croissant":p==5||p==6?"Cold assembly":p==7?"Plate berry cake":"Brew espresso";
                else status="Waiting for equipment";
            }
            if(guest.prepared) {
                const auto& item=guest.tray[std::size_t(n)];
                auto fresh=sim::Freshness{item.madeAt,definitions::menu[std::size_t(p)].lifetime,item.quality}.sample(g.runtime->time()).value;
                status="Ready for handover";remaining=fresh.remaining;quality=fresh.score;
            }
            out+="{\"product\":"+std::to_string(p)+",\"status\":"+jsonText(status)+",\"freshMs\":"+std::to_string(remaining)+",\"quality\":"+std::to_string(quality)+"}";
        }out+="],\"shortages\":[";
        if(!guest.rating && !guest.prepared && guest.phase!=Simulation::GuestPhase::Leaving && !(guest.id==g.customer && g.active())) {
            const auto shortages=g.ticketShortages(guest.items);
            for(std::size_t n=0;n<shortages.size();++n){if(n)out+=",";out+=std::to_string(shortages[n]);}
        }
        out+="]}";
    }
    out+="],\"ingredients\":[";
    for(std::size_t n=0;n<g.ingredientCount();++n) {
        if(n)out+=",";auto at=g.runtime->stock(g.inventory,g.ingredient(n)).value,stored=g.storedIngredient(n);
        auto primary=g.runtime->stock(g.storage,g.ingredient(n)).value;auto space=primary.capacity-primary.total-primary.reservedCapacity;
        if(g.extraStorage){auto extra=g.runtime->stock(g.annex,g.ingredient(n)).value;space=std::max(space,extra.capacity-extra.total-extra.reservedCapacity);}
        out+="{\"name\":"+jsonText(definitions::ingredients[n].name)+",\"needed\":"+(g.ingredientDemand(n)?"true":"false")+",\"price\":"+std::to_string(definitions::ingredients[n].price)+",\"stock\":"+std::to_string(at.available())+",\"stored\":"+std::to_string(stored.available())+",\"incoming\":"+std::to_string(stored.reservedCapacity)+",\"space\":"+std::to_string(space)+",\"workSpace\":"+std::to_string(at.capacity-at.total-at.reservedCapacity)+",\"restocking\":"+std::to_string(bool(g.restockWork[n]))+"}";
    }
    return out+"]}";
}
inline std::string staffView(const Simulation& g) {
    std::string out="{\"message\":"+jsonText(g.staffMessage)+",\"hiringMinor\":"+std::to_string(g.debited("cafe:hires"))+",\"canHire\":"+(g.crew.size()<3 && g.availableCash()>=Simulation::hireCost?"true":"false")+",\"staff\":[";
    bool comma=false;
    for(const auto& w:g.crew) {
        if(comma)out+=",";comma=true;auto task=g.tasks->current(w.id);auto core=g.runtime->worker(w.id).value;
        std::string reason;
        if(!g.onShift(w.id))reason="On break; no wage accrual";
        else if(w.breakPending)reason="Break after ticket preparation";
        else if(task)reason=task->state==sim::TaskState::Assigned?"Walking to task":"Working";
        else if(std::all_of(w.priorities.begin(),w.priorities.end(),[](int p){return p==0;}))reason="All roles disabled; on-shift wages still accrue";
        else reason="Idle; waiting for an eligible task";
        if(task)reason+=" · "+g.staffDestination(w.id);
        out+="{\"id\":"+std::to_string(w.id.value)+",\"name\":"+jsonText(Simulation::staffName(w.name))+",\"onShift\":"+(g.onShift(w.id)?"true":"false")+",\"breakPending\":"+(w.breakPending?"true":"false")+",\"workedMs\":"+std::to_string(w.worked)+",\"paid\":"+std::to_string(w.paid)+",\"due\":"+std::to_string((w.worked/60000)*100-w.paid)+",\"task\":"+jsonText(task?task->spec.key:"")+",\"state\":"+std::to_string(task?int(task->state):-1)+",\"remainingMs\":"+std::to_string(task?task->remaining:0)+",\"reason\":"+jsonText(reason)+",\"canDismiss\":"+(g.crew.size()>1 && !task && !core.job && g.wagesDue()<=g.ledger->balance()?"true":"false")+",\"priorities\":[";
        for(std::size_t n=0;n<4;++n){if(n)out+=",";out+=std::to_string(w.priorities[n]);}out+="]}";
    }
    return out+"]}";
}
} // namespace cafe
