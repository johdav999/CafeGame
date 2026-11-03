#pragma once
#include "balance.hpp"
#include <source_location>
inline void cafeAuthoringChecks() {
    auto check=[](bool value,std::source_location line=std::source_location::current()){if(!value)throw std::runtime_error("Cafe authoring line "+std::to_string(line.line()));};
    check(cafe::validateContent().empty());
    cafe::Simulation game;
    for(const auto& scenario:cafe::scenarios) {
        check(cafe::startScenario(game,scenario));
        check(game.stock==scenario.beans && game.wallet==scenario.cash && game.guests.size()==std::size_t(scenario.guestCount));
        check(game.demandRandom.snapshot().value==scenario.seed && game.arrivals.remaining==scenario.arrival);
        check(game.automaticGuests==scenario.traffic && game.onShift()==scenario.staffAvailable);
        auto before=game.save();auto inspected=cafe::inspectShift(game);auto report=cafe::shiftReport(game);
        check(!inspected.empty() && !report.empty() && game.save()==before);
        cafe::Simulation restored;check(restored.load(before) && restored.save()==before);
    }
    auto before=game.save();auto invalid=cafe::scenarios[0];invalid.beans=101;
    check(!cafe::startScenario(game,invalid) && game.save()==before);
    invalid=cafe::scenarios[0];invalid.seed=0;check(!cafe::startScenario(game,invalid) && game.save()==before);
    invalid=cafe::scenarios[0];invalid.guests[0]=3;check(!cafe::startScenario(game,invalid) && game.save()==before);
    invalid=cafe::scenarios[0];invalid.arrival=-1;check(!cafe::startScenario(game,invalid) && game.save()==before);
    check(cafe::jsonText("\"\n\\\t")=="\"\\\"\\u000a\\\\\\u0009\"");
    check(cafe::startScenario(game,cafe::scenarios[2]));
    auto actions=cafe::explainActions(game);check(actions[0].enabled() && !actions[1].enabled());
    check(game.brew());actions=cafe::explainActions(game);check(!actions[0].enabled());
    game.advance(3);check(game.ready);before=game.save();
    check(cafe::inspectShift(game,false).find("Wait for the guest to reach the counter")!=std::string::npos && game.save()==before);
    auto a=cafe::runBalance(cafe::scenarios[0],123,120),b=cafe::runBalance(cafe::scenarios[0],123,120);
    check(a==b && a.find("\"served\":0")==std::string::npos);
    check(cafe::runBalance(cafe::scenarios[0],124,120)!=a);
    check(cafe::runBalance(cafe::scenarios[2],123,120).find("\"served\":1")!=std::string::npos);
    bool rejected=false;try{cafe::runBalance(cafe::scenarios[0],0,120);}catch(const std::invalid_argument&){rejected=true;}check(rejected);
}
