#pragma once
#include "balance.hpp"
#include "previous_guest_envelope.hpp"
#include <source_location>
inline void cafeScheduleChecks() {
    using namespace cafe;
    auto check=[](bool ok,std::source_location at=std::source_location::current()){if(!ok)throw std::runtime_error("Cafe schedule line "+std::to_string(at.line()));};
    auto word=[](auto& bytes,std::size_t offset,std::uint64_t value){for(int n=0;n<8;++n)bytes[offset+n]=std::uint8_t(value>>(n*8));};
    Simulation game{100,1000000};check(game.clockMinutes()==480 && game.schedule.day==1 && !game.nextPeriod());
    game.advance(1000);check(game.clockMinutes()==720 && game.intermission() && game.layoutEditable() && !game.pending);
    auto wages=game.staffedMs;auto cash=game.wallet;
    game.advance(300);check(game.clockMinutes()==720 && game.staffedMs==wages && game.wallet==cash);
    check(game.editLayout(0,1,3,9,0));check(game.purchaseIngredient(0));game.advance(8);
    check(!game.incomingSupply() && game.clockMinutes()==720 && game.staffedMs==wages);
    auto stopped=game.save();Simulation loaded;check(loaded.load(stopped) && loaded.save()==stopped && loaded.intermission());
    check(game.nextPeriod() && game.schedule.period==1 && game.clockMinutes()==720 && !game.nextPeriod());
    game.advance(120);check(game.clockMinutes()==840 && game.intermission());
    check(game.nextPeriod());game.advance(240);check(game.clockMinutes()==1080 && game.intermission());
    check(game.nextPeriod() && game.schedule.day==2 && game.schedule.period==0 && game.clockMinutes()==480);
    // The boundary stops business time, while accepted tickets and cleanup drain.
    Simulation busy{100,1000000};busy.advance(239);check(busy.welcome(0,0) && busy.brew());
    busy.advance(2);check(busy.clockMinutes()==720 && busy.closed && !busy.intermission() && !busy.nextPeriod() && !busy.welcome());
    busy.advance(2);check(busy.ready && busy.serve());busy.advance(Simulation::diningDuration({0,-1})/1000.0);referenceDecisions(busy);busy.advance(1);
    check(busy.intermission() && busy.guests.empty() && busy.layoutEditable() && busy.clockMinutes()==720);
    // Malformed schedule fields cannot replace a live game.
    auto bad=stopped;auto offset=bad.size()-compatibilitySaveBytes-garden::saveBytes-Simulation::gardenStorySaveBytes-loaded.campaignSaveBytes()-Simulation::journalSaveBytes-Simulation::scheduleSaveBytes;
    word(bad,offset+24,99);auto live=loaded.save();check(!loaded.load(bad) && loaded.save()==live);
    bad=stopped;word(bad,offset+8,600001);check(!loaded.load(bad) && loaded.save()==live);
    // Schema 15 preserves the complete cafe, adding a fresh sandbox business clock.
    Simulation oldGame{20,9000};check(oldGame.welcome(1,0) && oldGame.brew());oldGame.advance(1);auto old=withoutTableGuestFields(oldGame);
    old.erase(old.end()-compatibilitySaveBytes-Simulation::journalSaveBytes,old.end()-compatibilitySaveBytes);
    auto start=old.size()-compatibilitySaveBytes-oldGame.campaignSaveBytes()-Simulation::scheduleSaveBytes;
    old.erase(old.begin()+start,old.begin()+start+Simulation::scheduleSaveBytes);word(old,8,15);
    auto oldRules=contentForRules(7,7);word(old,old.size()-16,oldRules.version);word(old,old.size()-8,oldRules.fingerprint);
    Simulation migrated;auto result=migrated.restore(old);check(result && result.migrated && migrated.clockMinutes()==480 && migrated.brewing==oldGame.brewing && migrated.wallet==oldGame.wallet);
}
