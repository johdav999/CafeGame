#pragma once
#include "balance.hpp"
#include "fixtures/schema11.hpp"
#include <source_location>
inline void cafeCampaignChecks() {
    using namespace cafe;
    auto check=[](bool ok,std::source_location at=std::source_location::current()){if(!ok)throw std::runtime_error("Cafe campaign line "+std::to_string(at.line()));};
    auto roundtrip=[&](Simulation& g,std::source_location at=std::source_location::current()){
        auto bytes=g.save();if(!g.load(bytes))throw std::runtime_error("Campaign restore at "+std::to_string(at.line()));
        if(g.save()!=bytes)throw std::runtime_error("Campaign canonical bytes at "+std::to_string(at.line()));
    };
    Simulation game;check(game.startCampaign(123));check(game.closed && game.unlockedMask()==17 && game.campaign.day==1);
    game.advance(180);check(game.staffedMs==0 && game.wallet==10000);roundtrip(game);
    check(!game.welcome() && !game.prepare(2));check(game.openDay());auto opening=game.campaign.checkpoint;
    game.automaticGuests=false;game.automaticSupply=false;
    check(!game.welcome(1,2));check(game.welcome(0,0) && game.brew());game.advance(1);roundtrip(game);
    game.advance(2);check(game.serve() && game.campaign.goals==1 && game.unlocked(1) && !game.unlocked(2));
    check(game.welcome(1,1,4));
    check(game.prepare(1));
    game.advance(6);
    check(game.ready);
    check(game.serve());
    check(game.campaign.goals==3 && game.unlocked(2));
    check(game.credited("cafe:goals")==1000);roundtrip(game);
    check(game.restartDay() && game.served==0 && game.wallet==10000 && !game.campaign.goals && game.campaign.checkpoint==opening);
    check(game.campaign.phase==Simulation::DayPhase::Preparation && game.openDay());
    // Early closing preserves queued tickets and cannot be reopened by layout controls.
    game.automaticGuests=false;game.automaticSupply=false;check(game.welcome(1,0) && game.brew());game.advance(1);
    check(game.welcome(1,0));check(game.closeDay());game.toggleClosed();check(game.closed && game.campaign.phase==Simulation::DayPhase::Closing);roundtrip(game);
    check(game.welcome()==false);game.advance(2);check(game.serve());
    for(int tick=0;tick<200 && !game.summary();++tick){referenceDecisions(game);game.advance(.1);}
    check(game.summary() && game.debited("cafe:overhead")==500 && game.campaign.goals==9);roundtrip(game);
    auto finished=game.save();game.advance(3600);game.toggleClosed();check(game.save()==finished);
    check(!game.purchaseBeans(1) && !game.hire() && !game.requestMaintenance(Simulation::Maintenance::Repair));
    check(game.nextDay() && !game.nextDay() && game.campaign.day==2);roundtrip(game);
    // Insolvent summaries explain the loss and retain an affordable recovery route.
    Simulation loss;check(loss.startCampaign(456));loss.automaticSupply=false;
    // Spend during preparation with real hiring, supplies and furniture purchases.
    check(loss.hire() && loss.hire());
    for(int ingredient:{0,2,4,1,3,0}){check(loss.purchaseIngredient(ingredient));loss.advance(8);}
    check(loss.wallet==700 && !loss.staffedMs);
    check(loss.openDay());loss.automaticGuests=false;
    for(int tick=0;tick<7000 && !loss.summary();++tick){if(loss.intermission())loss.nextPeriod();loss.advance(.1);}
    check(loss.summary() && loss.dayProfit()<0 && loss.wagesDue()>0 && loss.overheadDue()==500 && !loss.nextDay());
    roundtrip(loss);check(loss.restartDay() && loss.wallet==700 && loss.crew.size()==3 && !loss.wagesDue() && !loss.overheadDue());
    // Actual three-day deterministic play; objectives pay once across all days.
    Simulation campaign;check(campaign.startCampaign(123));std::uint64_t lastVisits=0;
    for(int day=1;day<=3;++day) {
        check(campaign.campaign.day==std::uint64_t(day) && campaign.openDay());
        bool savedService=false,savedClosing=false;
        for(int tick=0;tick<9000 && !campaign.summary();++tick) {
            referenceDecisions(campaign);campaign.advance(.1);
            if(!savedService && campaign.runtime->time()-campaign.campaign.openedAt>30000){roundtrip(campaign);savedService=true;}
            if(!savedClosing && campaign.campaign.phase==Simulation::DayPhase::Closing){roundtrip(campaign);savedClosing=true;}
        }
        check(campaign.summary() && savedService && savedClosing && campaign.dayProfit()>0 && campaign.overheadDue()==0 && campaign.wagesDue()==0);
        check(campaign.campaign.goals==15 && campaign.unlockedMask()==31 && campaign.credited("cafe:goals")==2000);
        check(campaign.debited("cafe:overhead")==day*500);roundtrip(campaign);
        std::uint64_t visits=0;for(const auto& r:campaign.campaign.regulars){visits+=r.visits;check(r.reviews<=r.visits);}
        check(visits>lastVisits);lastVisits=visits;
        auto stable=campaign.save();campaign.advance(5);check(campaign.save()==stable);
        if(day<3)check(campaign.nextDay());
    }
    // Malformed progress or nested checkpoints never replace the live campaign.
    auto bytes=campaign.save(),bad=bytes;auto start=bytes.size()-compatibilitySaveBytes-garden::saveBytes-Simulation::gardenStorySaveBytes-Simulation::journalSaveBytes-campaign.campaignSaveBytes();
    auto word=[](auto& data,std::size_t offset,std::uint64_t n){for(int b=0;b<8;++b)data[offset+b]=std::uint8_t(n>>(8*b));};
    word(bad,start+16,99);check(!campaign.load(bad) && campaign.save()==bytes);
    bad=bytes;word(bad,start+24,0);check(!campaign.load(bad) && campaign.save()==bytes);
    bad=bytes;bad[bytes.size()-compatibilitySaveBytes-garden::saveBytes-Simulation::gardenStorySaveBytes-Simulation::journalSaveBytes-8]^=1;check(!campaign.load(bad) && campaign.save()==bytes);
    // A genuine milestone-18 roster/order save becomes an unrestricted sandbox.
    std::vector<std::uint8_t> legacy;auto hex=[](char c){return c<='9'?c-'0':c-'a'+10;};
    for(std::size_t n=0;n+1<schema11Hex.size();n+=2)legacy.push_back(std::uint8_t(hex(schema11Hex[n])*16+hex(schema11Hex[n+1])));
    Simulation old;auto result=old.restore(legacy);check(result && result.migrated && !old.campaign.enabled && old.unlockedMask()==31 && old.crew.size()==2 && old.pendingSupplyCost==1200 && old.brewing==2);
    old.advance(2);check(old.serve() && old.wallet==2800);roundtrip(old);
}
