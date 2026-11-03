#pragma once
#include "previous_guest_envelope.hpp"
#include "simulation.hpp"
#include <source_location>
inline void diningCheck(bool ok,std::source_location at=std::source_location::current()) {
    if(!ok)throw std::runtime_error("Cafe dining line "+std::to_string(at.line()));
}
inline void diningStep(cafe::Simulation& game) {
    namespace sim=cafe::sim;
    game.workflowTick();
    for(const auto& worker:game.crew)if(auto task=game.tasks->current(worker.id))if(task->state==sim::TaskState::Assigned)cafe::Simulation::require(game.tasks->start(task->id,worker.id,task->token));
    for(auto id:game.productionJobs()){auto job=game.runtime->job(id).value;if(job.state==sim::JobState::Assigned)cafe::Simulation::require(game.runtime->arrive(id,job.assignment));}
    game.advance(.01);
}
template<class Ready> void diningUntil(cafe::Simulation& game,Ready ready) {
    for(int n=0;n<3000 && !ready();++n)diningStep(game);
    diningCheck(ready());
}
inline void deliverDiningVisit(cafe::Simulation& game,int first,int second=-1) {
    using S=cafe::Simulation;game.immediate=false;
    diningCheck(game.welcome(0,first,second));auto id=game.guests.front().id;
    auto seat=game.seats.claim(id).value();game.seated(id,seat.point,seat.token);
    auto before=game.guest(id)->remaining;game.advance(5);diningCheck(game.guest(id)->remaining==before-5000 && !game.guest(id)->rating);
    diningCheck(game.collectOrder(id));diningUntil(game,[&]{return game.guest(id)->orderTaken;});
    diningCheck(game.prepareGuest(id));diningUntil(game,[&]{return bool(game.guest(id)->prepared);});
    game.advance(5);diningCheck(game.guest(id)->remaining>0 && game.guest(id)->remaining<before && !game.guest(id)->rating);
    diningCheck(game.requestServing(id));diningUntil(game,[&]{return game.guest(id)->rating==1;});
    diningCheck(game.guest(id)->phase==S::GuestPhase::Dining);
}
inline void cafeDiningChecks() {
    using S=cafe::Simulation;
    struct Visit {int first,second;std::int64_t duration;};
    for(auto visit:std::array<Visit,9>{{{0,-1,15000},{1,-1,20000},{2,-1,25000},{3,-1,25000},{4,-1,30000},{0,4,45000},{4,0,45000},{2,4,55000},{0,3,40000}}}) {
        S game{100,10000};deliverDiningVisit(game,visit.first,visit.second);
        auto id=game.guests.front().id;diningCheck(game.guest(id)->remaining==visit.duration);
        game.advance(8);diningCheck(game.guest(id)->phase==S::GuestPhase::Dining && bool(game.seats.claim(id)));
        auto saved=game.save();diningCheck(game.load(saved) && game.save()==saved);id=game.guests.front().id;
        diningCheck(game.guest(id)->remaining==visit.duration-8000);
        game.advance(double(game.guest(id)->remaining-1)/1000);diningCheck(game.guest(id)->remaining==1 && bool(game.seats.claim(id)));
        game.advance(.001);diningCheck(game.guest(id)->phase==S::GuestPhase::Leaving && bool(game.guest(id)->cleanup) && bool(game.seats.claim(id)));
        game.departed(id);diningUntil(game,[&]{return game.guests.empty();});diningCheck(game.seats.claims().empty());
    }
    auto word=[](auto& bytes,std::size_t offset,std::uint64_t value){for(int n=0;n<8;++n)bytes[offset+n]=std::uint8_t(value>>(n*8));};
    for(int pastry:{-1,4}) {
        S old{100,10000};deliverDiningVisit(old,0,pastry);old.guests.front().remaining=4000;
        auto bytes=withoutGardenFields(old);word(bytes,8,18);auto prior=cafe::contentForRules(10,10);word(bytes,bytes.size()-16,prior.version);word(bytes,bytes.size()-8,prior.fingerprint);
        S migrated;auto result=migrated.restore(bytes);diningCheck(result && result.migrated);
        diningCheck(migrated.guests.front().remaining==S::diningDuration({0,pastry})/2 && migrated.wallet==old.wallet && migrated.served==old.served);
        auto current=migrated.save();diningCheck(migrated.load(current) && migrated.save()==current);
    }
    S corrupt{100,10000};deliverDiningVisit(corrupt,0);auto saved=corrupt.save(),bad=saved;
    std::uint64_t core=0;for(int n=0;n<8;++n)core|=std::uint64_t(saved[80+n])<<(n*8);
    std::size_t equipment=0;corrupt.saveEquipment([&](auto){equipment+=8;});auto dwell=88+core+equipment+24;
    word(bad,dwell,60001);diningCheck(!corrupt.load(bad) && corrupt.save()==saved);
    bad=saved;word(bad,dwell,16000);diningCheck(!corrupt.load(bad) && corrupt.save()==saved);
}
