#pragma once
#include "appealing_cafe_fixture.hpp"
#include "previous_guest_envelope.hpp"
inline void cafeDemandChecks() {
    auto check=[](bool ok,std::source_location at=std::source_location::current()){if(!ok)throw std::runtime_error("Cafe demand line "+std::to_string(at.line()));};
    cafe::Simulation game{4,5000};check(game.reviewCount()==0 && game.reputation()==750 && !game.automaticGuests);
    auto appeal=game.attractiveness();check(appeal.menu==10 && appeal.experience==10 && appeal.furnishings==10 && appeal.total==30 && game.visitorLimit()==2);
    check(cafe::Simulation::visitorLimitForScore(0)==2 && cafe::Simulation::visitorLimitForScore(39)==2 && cafe::Simulation::visitorLimitForScore(99)==8);
    for(int n=0;n<8;++n)check(cafe::Simulation::visitorLimitForScore(30+n*10)==std::size_t(2+n));
    cafe::Simulation admissions;check(admissions.welcomeMenu(0) && admissions.welcomeMenu(0));auto capped=admissions.save();
    check(!admissions.welcomeMenu(1) && admissions.save()==capped);
    auto leaving=admissions.guests.front().id;admissions.leave(leaving,true);check(!admissions.visitorRoom());admissions.departed(leaving);check(admissions.welcomeMenu(1));
    cafe::Simulation exiting;exiting.immediate=false;check(exiting.welcomeMenu(0) && exiting.welcomeMenu(0));
    for(auto id:{exiting.guests[0].id,exiting.guests[1].id})exiting.leave(id,true);
    auto exitState=exiting.save();check(!exiting.brew(false) && exiting.save()==exitState);
    cafe::Simulation decor;auto bare=decor.attractiveness();
    check(decor.layout.place({20,0,5,1,1,0})==cafe::sim::LayoutError::None);
    check(decor.attractiveness().furnishings==bare.furnishings+3);
    decor.finish=1;check(decor.attractiveness().furnishings==bare.furnishings+8);
    cafe::Simulation variety;variety.campaign.enabled=true;variety.campaign.goals=0;
    check(variety.attractiveness().menu==10);variety.campaign.goals=7;variety.deliveredReviews=10;check(variety.attractiveness().menu==25);
    cafe::Simulation waiting;check(waiting.welcome(1));auto prompt=waiting.attractiveness();waiting.advance(40);
    check(waiting.attractiveness().experience<prompt.experience);
    auto savedWait=waiting.save();cafe::Simulation restoredWait;check(restoredWait.load(savedWait));
    check(restoredWait.attractiveness().total==waiting.attractiveness().total);
    cafe::Simulation reviews;reviews.deliveredReviews=1;reviews.totalSatisfaction=1000;
    check(reviews.attractiveness().experience==14);reviews.deliveredReviews=10;reviews.totalSatisfaction=10000;
    check(reviews.attractiveness().experience==50);reviews.failedReviews=10;check(reviews.attractiveness().experience==25);
    auto before=game.save();check(!game.welcome(3) && game.save()==before);
    check(game.welcome(1) && game.guests[0].budget==90000);check(game.brew());game.advance(3);check(game.serve());
    check(game.deliveredReviews==1 && game.failedReviews==0 && game.lastProfile==1 && game.lastInputs.preference==1000);
    check(game.seats.claims().empty() && game.guests[0].phase==cafe::Simulation::GuestPhase::Leaving);
    auto rated=game.save();cafe::Simulation loaded;check(loaded.load(rated) && loaded.save()==rated);
    check(!loaded.serve() && loaded.reviewCount()==1);loaded.leave(loaded.customer);check(loaded.reviewCount()==1);
    loaded.departed(loaded.customer);check(loaded.reviewCount()==1 && loaded.guests.empty());
    cafe::Simulation fresh{4,5000},old{4,5000};check(fresh.welcome(2) && old.welcome(2));check(fresh.brew() && old.brew());
    fresh.advance(3);old.advance(23);check(fresh.serve() && old.serve());check(fresh.lastScore>old.lastScore && fresh.lastInputs.product>old.lastInputs.product);
    auto stable=old.save();check(old.load(stable) && old.totalSatisfaction==std::uint64_t(old.lastScore));
    cafe::Simulation cancelled;check(cancelled.brew() && cancelled.cancel());check(cancelled.failedReviews==1 && cancelled.lastScore==0);
    cancelled.leave(cancelled.customer);check(cancelled.failedReviews==1);
    cafe::Simulation closing;check(closing.welcome(1));closing.toggleClosed();check(closing.reviewCount()==0 && closing.guests[0].rating==3);
    auto neutral=closing.save();check(closing.load(neutral));
    cafe::Simulation expiry;check(expiry.welcome(1));expiry.advance(89.999);check(expiry.reviewCount()==0);expiry.advance(.001);
    check(expiry.failedReviews==1 && expiry.queue.claims().empty());auto expired=expiry.save();check(expiry.load(expired));expiry.advance(10);check(expiry.failedReviews==1);
    cafe::Simulation traffic{4,5000};traffic.automaticGuests=true;traffic.advance(11.999);check(traffic.admitted==0 && traffic.arrivals.remaining==1);
    auto imminent=traffic.save();check(loaded.load(imminent));traffic.advance(.001);loaded.advance(.001);
    check(traffic.admitted==1 && loaded.save()==traffic.save());
    auto remaining=traffic.arrivals.remaining;traffic.toggleClosed();auto random=traffic.demandRandom.snapshot();traffic.advance(100);
    check(traffic.arrivals.remaining==remaining && traffic.demandRandom.snapshot()==random && traffic.reviewCount()==0);
    traffic.toggleClosed();traffic.automaticGuests=false;traffic.advance(100);check(traffic.arrivals.remaining==remaining);
    // Same small cafe, established 65 appeal: the five-visitor cap must affect
    // actual cadence, not just permit manually injected crowds.
    {
        cafe::Simulation popular,partitioned;
        for(auto* g:{&popular,&partitioned}){g->deliveredReviews=10;g->totalSatisfaction=6000;g->automaticGuests=true;}
        check(popular.attractiveness().total==65 && popular.visitorLimit()==5);
        check(popular.arrivalInterval(0)==15600 && popular.arrivalInterval(10000)==19600);
        check(game.arrivalInterval(0)>=6000);
        popular.advance(35);for(int n=0;n<350;++n)partitioned.advance(.1);
        check(popular.admitted>=2 && popular.visitingGuests()>=2 && popular.visitingGuests()<=popular.visitorLimit());
        check(popular.admitted==partitioned.admitted && popular.arrivals.remaining==partitioned.arrivals.remaining && popular.demandRandom.snapshot()==partitioned.demandRandom.snapshot());
        cafe::Simulation legacy;auto oldSave=withoutGardenFields(legacy);auto stamp=cafe::contentForRules(13,13);
        for(int i=0;i<8;++i){oldSave[oldSave.size()-16+i]=std::uint8_t(std::uint64_t(stamp.version)>>(i*8));oldSave[oldSave.size()-8+i]=std::uint8_t(stamp.fingerprint>>(i*8));}
        cafe::Simulation upgraded;auto result=upgraded.restore(oldSave);
        check(result && result.migrated && upgraded.arrivals.remaining==legacy.arrivals.remaining && upgraded.save()==legacy.save());
    }
    // Occupied/reserved tables plus at most two table waiters. Automatic
    // takeaway traffic can still fill its independent counter queue.
    {
        cafe::Simulation fresh;for(int n=0;n<100;++n){fresh.demandArrival();check(fresh.guests.size()<=2);check(fresh.arrivals.remaining>=37500 && fresh.arrivals.remaining<=47500);}
        cafe::Simulation small{100,20000};establishAppealingCafe(small);
        for(int n=0;n<100;++n){small.demandArrival();check(small.waitingForTable()<=2 && small.guests.size()<=9);}
        check(small.seats.claims().size()==6 && small.waitingForTable()==2 && small.queue.claims().size()==3);
        check(small.guests.size()==9 && small.failedReviews==0);
        auto snapshot=small.save();cafe::Simulation restored;check(restored.load(snapshot) && restored.save()==snapshot && restored.waitingForTable()==2);
        auto id=small.seats.claims().front().owner;small.leave(id,true);small.departed(id);
        check(small.waitingForTable()==1);
        for(int n=0;n<40;++n){small.demandArrival();check(small.waitingForTable()<=2);}
        check(small.waitingForTable()==2);
        cafe::Simulation expanded{100,20000};expanded.toggleClosed();
        check(expanded.editLayout(2,3,10,9,0));expanded.toggleClosed();expanded.demandArrival();
        check(expanded.arrivals.remaining>=22500 && expanded.arrivals.remaining<=32500);
    }
    cafe::Simulation full;for(int n=0;n<9;++n)check(full.welcome());full.automaticGuests=true;full.advance(12);
    check(full.admitted==9 && full.missed==1 && full.guests.size()==9);
    auto blocked=full.save();check(!full.welcome() && full.save()==blocked);
    cafe::Simulation whole{4,5000},split{4,5000};whole.automaticGuests=split.automaticGuests=true;
    // Compare timestep partitions within service; a period boundary explicitly
    // drops remaining frame time and requires player continuation.
    whole.advance(180);for(int i=0;i<180;++i)split.advance(1);
    check(whole.demandRandom.snapshot()==split.demandRandom.snapshot() && whole.admitted==split.admitted && whole.missed==split.missed);
    check(whole.failedReviews==split.failedReviews && whole.arrivals.remaining==split.arrivals.remaining && whole.staffedMs==split.staffedMs && whole.lastProfile==split.lastProfile && whole.lastOutcome==split.lastOutcome);
    auto bytes=whole.save();check(loaded.load(bytes));auto live=loaded.save();
    auto word=[](auto& data,std::size_t offset,std::uint64_t value){for(int i=0;i<8;++i)data[offset+i]=std::uint8_t(value>>(i*8));};
    auto start=bytes.size()-whole.demandSaveBytes()-whole.menuSaveBytes()-whole.scheduleSaveBytes-whole.journalSaveBytes-cafe::garden::saveBytes-cafe::Simulation::gardenStorySaveBytes-cafe::compatibilitySaveBytes-8;auto bad=bytes;word(bad,start,0);check(!loaded.load(bad) && loaded.save()==live);
    bad=bytes;word(bad,start+2*8,2);check(!loaded.load(bad) && loaded.save()==live);
    bad=bytes;word(bad,start+8*8,UINT64_MAX);check(!loaded.load(bad) && loaded.save()==live);
    bad=bytes;word(bad,start+19*8,3);check(!loaded.load(bad) && loaded.save()==live); // First profile.
    // Pre-menu schemas are rejected without replacing the live shift.
    auto prior=legacySave(whole);check(!loaded.load(prior) && loaded.save()==live);
}

