#pragma once
#include "simulation.hpp"
#include <string_view>

namespace cafe {
struct Scenario {
    std::string_view key,name,description;
    sim::Quantity beans,cash;
    std::uint32_t seed;
    sim::Milliseconds arrival;
    std::array<int,3> guests;
    int guestCount;
    bool traffic,autoSupply,staffAvailable;
    bool build=false;
};
inline constexpr std::array<Scenario,5> scenarios{{
    {"morning","Morning shift","The familiar shift: four beans, two regulars, live foot traffic.",4,5000,0x6d2b79f5u,12000,{0,0,0},2,true,false,true},
    {"rush","Commuter rush","Two takeaway guests, one bean. Order and restock before patience runs out.",1,2500,12345,3000,{1,1,1},2,true,false,true},
    {"quiet","Quiet practice","Full menu, stocked ingredients and manual arrivals. Choose one or two different items for practice guests.",100,5000,54321,12000,{2,0,0},1,false,false,true},
    {"recovery","Staff recovery","Staff start on a break. Resume work and manage a small cash reserve.",2,1200,98765,8000,{0,2,0},2,true,false,false},
    {"workshop","Layout workshop","Closed, full menu and 1000.00 for equipment, four tables and cosmetics. All campaign gates are lifted.",100,100000,87654,12000,{0,0,0},0,false,false,true,true}
}};
inline std::vector<std::string> validateScenario(const Scenario& s) {
    std::vector<std::string> issues;
    if(s.key.empty() || s.name.empty() || s.key.size()>32 || s.name.size()>80)issues.push_back("key/name: required bounded label");
    if(s.beans<0 || s.beans>100)issues.push_back("beans: expected 0..100");
    if(s.cash<0 || s.cash>1000000000)issues.push_back("cash: expected 0..1000000000 minor units");
    if(!s.seed)issues.push_back("seed: expected a nonzero uint32");
    if(s.arrival<0 || s.arrival>60000)issues.push_back("arrival: expected 0..60000 ms");
    if(s.guestCount<0 || s.guestCount>3)issues.push_back("guestCount: expected 0..3");
    if(s.build && (s.guestCount || s.traffic))issues.push_back("build: workshop starts closed with no guests or traffic");
    for(int p:s.guests)if(p<0 || p>=int(definitions::profiles.size()))issues.push_back("guests: unknown profile index");
    return issues;
}
inline std::vector<std::string> validateContent() {
    std::vector<std::string> issues;
    for(const auto& issue:sim::validateDefinitions(definitions::resources,definitions::processes))issues.push_back(issue.path+": "+std::string(sim::describe(issue.error)));
    for(const auto& p:definitions::profiles) {
        if(!p.name || !*p.name || p.patience<1 || p.patience>3600000 || !sim::satisfaction({},p.weights))issues.push_back("profiles: invalid name, patience or weights");
    }
    for(std::size_t i=0;i<scenarios.size();++i) {
        for(const auto& issue:validateScenario(scenarios[i]))issues.push_back(std::string(scenarios[i].key)+"/"+issue);
        for(std::size_t j=0;j<i;++j)if(scenarios[i].key==scenarios[j].key)issues.push_back("scenarios: duplicate key");
    }
    return issues;
}
// Validate and build a detached candidate, then reuse the joint atomic loader.
// Saves contain all resulting conditions; a preset label is not session state.
inline bool startScenario(Simulation& game,const Scenario& scenario,bool immediate=true) {
    if(!validateScenario(scenario).empty() || !validateContent().empty())return false;
    Simulation candidate{scenario.beans,scenario.cash};
    Simulation::require(candidate.demandRandom.restore({scenario.seed,0}));
    candidate.arrivals.remaining=scenario.arrival;
    candidate.automaticGuests=scenario.traffic;candidate.automaticSupply=scenario.autoSupply;
    for(int i=0;i<scenario.guestCount;++i)if(!candidate.welcome(scenario.guests[std::size_t(i)]))return false;
    if(!scenario.staffAvailable)candidate.takeBreak();
    candidate.closed=scenario.build;
    if(!game.load(candidate.save()))return false;
    game.immediate=immediate;
    return true;
}
// Explicit owned-content development/practice fixture, separate from base presets.
inline bool startGardenWorkshop(Simulation& game) {
    if(!game.contentAccess.available())return false;
    Simulation candidate{100,100000};candidate.contentAccess=game.contentAccess;
    candidate.closed=true;candidate.automaticGuests=false;candidate.immediate=game.immediate;
    if(!candidate.selectGarden() || !candidate.openCourtyard())return false;
    if(!candidate.equipmentChange(0,7,14,0,0))return false;
    for(std::size_t n=5;n<8;++n)Simulation::require(candidate.runtime->add(candidate.inventory,std::array{sim::Amount{candidate.ingredient(n),12}}));
    return game.load(candidate.save());
}
} // namespace cafe
