#pragma once
#include "diagnostics.hpp"

namespace cafe {
// Explicit deterministic reference policy, not an in-game automated manager.
// Zero travel time; 100 ms decisions. Measures logical balance, not render speed.
inline void referenceDecisions(Simulation& game,bool resumeStaff=true) {
        if(game.intermission() && !game.summary())game.nextPeriod();
        std::vector<sim::CustomerId> departures;
        for(const auto& g:game.guests) {
            if(g.phase==Simulation::GuestPhase::Leaving)departures.push_back(g.id);
            if(g.phase==Simulation::GuestPhase::ToSeat) {
                auto c=game.seats.claim(g.id);if(c && c->point!=Simulation::Pool::waiting)game.seated(g.id,c->point,c->token);
            }
        }
        for(auto id:departures)game.departed(id);
        if(resumeStaff && !game.onShift())game.takeBreak();
        if(game.ready && game.handoverReady())game.serve();
        if(game.stock<=1)game.restock();
        if(game.stock+game.storedBeans().total<=4 && !game.incomingSupply() && game.availableCash()>=1200)game.orderBeans();
        for(int n=1;n<int(game.ingredientCount());++n) {
            if(!game.ingredientDemand(std::size_t(n)))continue;
            auto resource=game.ingredient(std::size_t(n));auto at=game.runtime->stock(game.inventory,resource).value;
            auto stored=game.storedIngredient(std::size_t(n));
            if(at.available()<=1)game.restockIngredient(n);
            if(at.total+stored.total<=4 && !game.incomingSupply())game.purchaseIngredient(n);
        }
        if(!game.active() && !game.maintenanceTask) {
            auto condition=game.machineCondition.snapshot();
            if(condition.integrity<500)game.requestMaintenance(Simulation::Maintenance::Repair);
            else if(condition.cleanliness<500)game.requestMaintenance(Simulation::Maintenance::Clean);
            else if(game.nextCustomer())game.brew();
        }
}
inline std::string runBalance(const Scenario& scenario,std::uint32_t seed,int seconds) {
    if(seconds<1 || seconds>3600 || !seed)throw std::invalid_argument("Balance bounds: 1..3600 seconds, nonzero seed");
    auto definition=scenario;definition.seed=seed;
    Simulation game; if(!startScenario(game,definition))throw std::invalid_argument("Invalid scenario");
    std::int64_t beanBlocked=0,machineBlocked=0,idle=0;
    for(int tick=0;tick<seconds*10;++tick) {
        referenceDecisions(game);
        // Exclusive categories, sampled after policy decisions, before time advance.
        if(!game.queue.claims().empty() && !game.active()) {
            if(game.stock==0)beanBlocked+=100;
            else if(!game.machineUsable())machineBlocked+=100;
        }
        if(!game.active() && !game.maintenanceTask)idle+=100;
        game.advance(.1);
    }
    auto report=shiftReport(game);report.replace(report.find("shift-snapshot"),14,"balance-run");report.pop_back();
    return report+",\"scenario\":"+jsonText(scenario.key)+",\"seed\":"+std::to_string(seed)+",\"durationSeconds\":"+std::to_string(seconds)+",\"policy\":\"reference-v2-menu-zero-travel-100ms\",\"beanBlockedMs\":"+std::to_string(beanBlocked)+",\"machineBlockedMs\":"+std::to_string(machineBlocked)+",\"idleMs\":"+std::to_string(idle)+"}";
}
} // namespace cafe
