#pragma once
#include "balance.hpp"
#include <source_location>

inline void cafeTableJournalChecks() {
    using S=cafe::Simulation;
    namespace sim=cafe::sim;
    auto check=[](bool ok,std::source_location at=std::source_location::current()) {
        if(!ok)throw std::runtime_error("Table journal line "+std::to_string(at.line()));
    };
    S game;game.immediate=false;
    check(game.startCampaign(123) && game.hire() && game.openDay());
    const auto openingCash=game.campaign.checkpoint;
    auto roundtrip=[&](std::source_location at=std::source_location::current()) {
        auto bytes=game.save();
        if(!game.load(bytes) || game.save()!=bytes)throw std::runtime_error("Table journal restore at "+std::to_string(at.line()));
    };
    // Complete navigation requests explicitly, while keeping the real seated
    // order-taking, production, delivery and cleanup workflows enabled.
    auto step=[&] {
        std::vector<sim::CustomerId> departures;
        for(const auto& g:game.guests)if(g.phase==S::GuestPhase::Leaving)departures.push_back(g.id);
        for(auto id:departures)game.departed(id);
        game.workflowTick();
        for(const auto& worker:game.crew)if(auto task=game.tasks->current(worker.id)) {
            if(task->state==sim::TaskState::Assigned)S::require(game.tasks->start(task->id,worker.id,task->token));
        }
        for(auto id:game.productionJobs()) {
            auto job=game.runtime->job(id).value;
            if(job.state==sim::JobState::Assigned)S::require(game.runtime->arrive(id,job.assignment));
        }
        game.advance(.01);
    };
    auto until=[&](auto ready,std::source_location at=std::source_location::current()) {
        for(int n=0;n<20000 && !ready();++n)step();
        if(!ready())throw std::runtime_error("Table journal timeout at "+std::to_string(at.line()));
    };
    auto guest=[&](std::uint64_t value){return game.guest({value,game.runtime->epoch()});};
    auto journalCounts=[&]{return game.journal.counts;};
    auto runShift=[&] {
        game.automaticGuests=false;game.automaticSupply=false;
        check(game.welcome(0,0,4));const auto first=game.guests.back().id.value;
        check(game.welcome(2,0,4));const auto second=game.guests.back().id.value;
        // Author named visits with the same identity/history fields as seeded
        // regular admissions; their orders use the initial unlocked recipes.
        for(auto [value,regular]:std::array<std::pair<std::uint64_t,int>,2>{{{first,0},{second,2}}}) {
            auto* g=guest(value);g->regular=regular;
            auto& history=game.campaign.regulars[std::size_t(regular)];++history.visits;history.lastDay=game.campaign.day;
            auto seat=game.seats.claim(g->id).value();game.seated(g->id,seat.point,seat.token);
        }
        check(game.queue.claims().empty());roundtrip();
        for(auto value:{first,second}) {
            check(game.collectOrder(guest(value)->id));
            until([&]{return guest(value)->orderTaken;});
        }
        check(journalCounts()==std::array<std::uint64_t,11>{});
        // Prepare the later arrival first, and keep both unpaid tickets ready.
        for(auto value:{second,first}) {
            check(game.prepareGuest(guest(value)->id));
            until([&]{return bool(guest(value)->prepared);});roundtrip();
        }
        check(game.served==0 && !game.credited("cafe:sales") && !game.journal.counts[10]);
        check(!game.credited("cafe:daily") && !game.credited("cafe:achievements"));
        for(auto value:{first,second}) {
            check(game.requestServing(guest(value)->id));
            check(!game.requestServing(guest(value)->id));roundtrip();
            until([&]{return guest(value)->rating==1;});
            check(guest(value)->score>=800);
            const auto counts=journalCounts();const auto cash=game.wallet;
            check(!game.requestServing(guest(value)->id) && !game.deliverPrepared(*guest(value)));
            game.recordReview(*guest(value),1,1000);
            check(journalCounts()==counts && game.wallet==cash);roundtrip();
        }
        check(game.journal.counts[10]==2 && game.journal.counts[9]==2);
        check(game.journal.counts[0]==2 && game.journal.counts[4]==2);
        check(game.journal.counts[5]==2 && game.journal.counts[6]==1 && game.journal.counts[8]==1);
        // Counter service contributes to the same journal without needing a seat.
        check(game.welcome(1,4) && game.prepare(4,false));
        until([&]{return game.ready && game.handoverReady();});check(game.serve(false));
        check(game.journal.counts[10]==3 && game.journal.counts[4]==3 && game.journal.counts[5]==3);
        until([&]{return game.guests.empty();});
        // Cancelling an already prepared table ticket earns neither a paid
        // visit nor progress, and remains rejected after restoring the save.
        check(game.welcome(0,0));auto rejected=game.guests.back().id.value;
        auto seat=game.seats.claim(guest(rejected)->id).value();game.seated(guest(rejected)->id,seat.point,seat.token);
        check(game.collectOrder(guest(rejected)->id));until([&]{return guest(rejected)->orderTaken;});
        check(game.prepareGuest(guest(rejected)->id));until([&]{return bool(guest(rejected)->prepared);});
        roundtrip();const auto counts=journalCounts();const auto sales=game.credited("cafe:sales");
        game.leave(guest(rejected)->id);
        check(journalCounts()==counts && game.credited("cafe:sales")==sales && game.failedReviews==1);
        check(!game.requestServing(guest(rejected)->id));roundtrip();
        // Projection is read-only, including repeated GUI inspections.
        const auto before=game.save();check(cafe::journalView(game)==cafe::journalView(game) && game.save()==before);
        check(game.closeDay());roundtrip();until([&]{return game.summary();});roundtrip();
        check(game.served==3 && game.journal.counts[10]==3);
        check(game.journal.daily==3 && game.credited("cafe:daily")==400);
        check(game.journal.newAchievements==((std::uint64_t(1)<<14)|(std::uint64_t(1)<<9)));
        check(game.journal.achievements==game.journal.newAchievements && game.credited("cafe:achievements")==1000);
        check(!game.journal.days && !game.journal.wasteFree && !game.journal.profitable);
        auto finished=game.save();game.advance(3600);game.campaignTick();roundtrip();check(game.save()==finished);
    };
    runShift();const auto earned=game.save();
    check(game.restartDay() && game.campaign.checkpoint==openingCash);
    check(game.wallet==8500 && game.crew.size()==2 && game.served==0);
    check(!game.journal.achievements && !game.journal.daily && !game.journal.claims);
    check(journalCounts()==std::array<std::uint64_t,11>{} && !game.credited("cafe:daily") && !game.credited("cafe:achievements"));
    check(game.openDay());runShift();check(game.save()==earned);
    check(game.nextDay() && game.journal.achievements==((std::uint64_t(1)<<14)|(std::uint64_t(1)<<9)));
    check(!game.journal.newAchievements && !game.journal.daily && game.journal.baseline==game.journal.counts);
    roundtrip();
}
