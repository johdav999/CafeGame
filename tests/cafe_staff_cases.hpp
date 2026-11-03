#pragma once
#include "balance.hpp"
#include "fixtures/schema10.hpp"
#include <source_location>
inline void cafeStaffChecks() {
    using namespace cafe;using namespace engine::simulator;
    auto check=[](bool ok,std::source_location at=std::source_location::current()){if(!ok)throw std::runtime_error("Cafe staff line "+std::to_string(at.line()));};
    auto roundtrip=[&](Simulation& g){auto bytes=g.save();Simulation copy;check(copy.load(bytes) && copy.save()==bytes);};
    Simulation poor{4,1499};auto before=poor.save();check(!poor.hire() && poor.save()==before);
    Simulation wages{20,5000};check(wages.hire() && wages.hire() && wages.crew.size()==3 && wages.wallet==2000);
    before=wages.save();check(!wages.hire() && wages.save()==before);
    check(!wages.setPriority(wages.staff,4,2) && !wages.setPriority(wages.staff,0,4) && wages.save()==before);
    wages.advance(30);auto sam=wages.crew[1].id;check(wages.staffBreak(sam));wages.advance(30);
    check(wages.crew[0].worked==60000 && wages.crew[1].worked==30000 && wages.crew[2].worked==60000);
    check(wages.wallet==1800 && wages.debited("cafe:wages")==200 && wages.staffedMs==150000);roundtrip(wages);
    check(wages.dismiss(sam) && wages.crew.size()==2 && wages.retiredWorked==30000);roundtrip(wages);
    check(wages.hire() && wages.crew.back().name==1 && wages.crew.back().worked==0);roundtrip(wages);
    Simulation preference;preference.crew[0].priorities={1,0,0,3};
    auto urgent=preference.addTask("cafe:machine-clean","cafe:barista",30,2000);
    auto preferred=preference.addTask("cafe:clean","cafe:cleaner",5,1000);preference.workflowTick();
    check(preference.tasks->current(preference.staff)->id==preferred && preference.tasks->task(urgent)->state==TaskState::Queued);
    Simulation disabled{20,5000};for(int role=0;role<4;++role)check(disabled.setPriority(disabled.staff,role,0));
    check(disabled.brew());disabled.advance(1);check(disabled.jobState==int(JobState::Queued) && !disabled.ready);
    check(disabled.setPriority(disabled.staff,2,3));check(disabled.setPriority(disabled.staff,0,3));disabled.advance(3);
    check(disabled.ready && !disabled.serve());check(disabled.setPriority(disabled.staff,1,3));check(disabled.serve());roundtrip(disabled);
    Simulation debt{20,3500};check(debt.hire() && debt.hire());debt.advance(180);check(debt.wagesDue()==400 && debt.wallet==0);
    before=debt.save();check(!debt.dismiss(debt.crew[1].id) && debt.save()==before);roundtrip(debt);
    check(debt.brew());debt.advance(3);check(debt.serve() && debt.wagesDue()==0 && debt.wallet==100);
    check(debt.dismiss(debt.crew[1].id));roundtrip(debt);
    Simulation deadline{20,5000};check(welcomeCounterGuest(deadline));deadline.advance(118);check(deadline.brew() && deadline.staffBreak(deadline.staff));deadline.advance(2);
    check(deadline.crew[0].worked==120000 && deadline.debited("cafe:wages")==200 && !deadline.onShift() && !deadline.active());roundtrip(deadline);
    // Three people work on a drink, a dirty table and a stock run concurrently.
    Simulation game{20,10000};check(game.hire() && game.hire());
    auto alex=game.crew[0].id,cleaner=game.crew[1].id,runner=game.crew[2].id;
    const std::array<std::array<int,4>,3> roles{{{3,3,0,0},{0,3,0,3},{0,0,3,0}}};
    for(int w=0;w<3;++w)for(int r=0;r<4;++r)check(game.setPriority(game.crew[std::size_t(w)].id,r,roles[std::size_t(w)][std::size_t(r)]));
    check(game.welcome(0,0) && game.brew());game.advance(3);check(game.serve());auto oldGuest=game.customer;
    game.immediate=false;game.advance(Simulation::diningDuration({0,-1})/1000.0);check(bool(game.guest(oldGuest)->cleanup));game.departed(oldGuest);
    game.immediate=true;check(bool(game.runtime->add(game.storage,std::array{Amount{game.ingredient(2),12}})));
    check(game.requestRestock(2) && game.welcome(1,2) && game.prepare(2));
    check(game.tasks->current(alex)->spec.key=="cafe:prepare");
    check(game.tasks->current(cleaner)->spec.key=="cafe:clean");
    check(game.tasks->current(runner)->spec.key=="cafe:restock-2");
    game.advance(.4);check(game.staffBreak(cleaner));auto cleaning=game.guest(oldGuest)->cleanup;
    check(game.tasks->task(cleaning)->remaining==600);
    check(game.staffBreak(alex) && game.member(alex)->breakPending && game.onShift(alex));
    before=game.save();check(!game.dismiss(alex) && game.save()==before);roundtrip(game);
    game.advance(1);check(game.tasks->task(cleaning)->remaining==600);check(game.staffBreak(cleaner));
    game.advance(6);check(!game.guest(oldGuest) && !game.restockWork[2] && game.ready);
    check(!game.onShift(alex) && !game.member(alex)->breakPending && game.handoverReady());
    check(game.tasks->task(game.serviceWork[2])->worker==cleaner);check(game.serve() && game.served==2);
    check(game.runtime->stock(game.storage,game.ingredient(2)).value.total==8);roundtrip(game);
    check(game.dismiss(alex) && game.staff==cleaner);roundtrip(game);
    // Duplicate roster identities/names cannot replace a valid live game.
    auto bytes=game.save(),bad=bytes;auto offset=88+game.runtime->save().size()+game.equipmentSaveBytes+8+game.guests.size()*24;
    for(const auto* pool:{&game.queue,&game.counter,&game.seats})offset+=8+pool->claims().size()*24;
    bad[offset+8]=4;check(!game.load(bad) && game.save()==bytes);
    // A real milestone-17 snapshot upgrades one person's wages and task roles.
    std::vector<std::uint8_t> legacy;auto hex=[](char c){return c<='9'?c-'0':c-'a'+10;};
    for(std::size_t n=0;n+1<sizeof(schema10Hex)-1;n+=2)legacy.push_back(std::uint8_t(hex(schema10Hex[n])*16+hex(schema10Hex[n+1])));
    Simulation migrated;auto result=migrated.restore(legacy);check(result && result.migrated && migrated.crew.size()==1 && migrated.brewing==2 && migrated.pendingSupplyCost==1200);
    migrated.advance(2);check(migrated.serve() && migrated.wallet==4300);roundtrip(migrated);
    // Aggregate pay still respects individual minute boundaries after restore.
    Simulation whole{20,10000},split{20,10000};check(whole.hire() && split.hire());whole.advance(180);for(int n=0;n<1800;++n)split.advance(.1);
    check(whole.save()==split.save());
}
