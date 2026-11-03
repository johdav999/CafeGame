#pragma once
#include "simulation.hpp"
#include <source_location>
// Establish appeal through valid deliveries and purchases, so nine-guest saves
// exercise the real loader rather than fabricated review/ledger counters.
inline void establishAppealingCafe(cafe::Simulation& game) {
    auto check=[](bool ok,std::source_location at=std::source_location::current()){if(!ok)throw std::runtime_error("Appealing cafe fixture line "+std::to_string(at.line()));};
    for(int n=0;n<10;++n){
        check(game.welcome(0,4));auto id=game.guests.back().id;
        check(game.prepare(4));game.advance(.5);check(game.serve());
        game.leave(id,true);game.departed(id);
    }
    game.toggleClosed();
    check(game.editLayout(0,1,1,9,0));
    check(game.editLayout(0,2,19,9,0));
    check(game.editLayout(2,3,7,9,0));
    check(game.editLayout(2,4,13,9,0));
    check(game.setFinish(1));game.toggleClosed();
    check(game.attractiveness().total==100 && game.visitorLimit()==9);
}
