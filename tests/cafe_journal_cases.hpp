#pragma once
#include "balance.hpp"
#include "previous_guest_envelope.hpp"
#include <source_location>
inline void cafeJournalChecks() {
    using namespace cafe;
    auto check=[](bool ok,std::source_location at=std::source_location::current()){if(!ok)throw std::runtime_error("Cafe journal line "+std::to_string(at.line()));};
    auto roundtrip=[&](Simulation& game,std::source_location at=std::source_location::current()){
        auto bytes=game.save();
        if(!game.load(bytes))throw std::runtime_error("Journal restore at "+std::to_string(at.line()));
        if(game.save()!=bytes)throw std::runtime_error("Journal canonical bytes at "+std::to_string(at.line()));
    };
    Simulation game;check(game.startCampaign(123));
    check(game.journal.claims==0 && game.journal.achievements==0 && game.openDay());
    // Progress survives a partial save, and restarting restores the entire book.
    for(int tick=0;tick<600;++tick){referenceDecisions(game);game.advance(.1);}
    check(game.journal.counts[10]>0 && game.journal.counts[10]==std::uint64_t(game.served));roundtrip(game);
    check(game.restartDay() && !game.journal.counts[10] && !game.journal.claims && !game.journal.achievements);
    check(game.openDay());
    std::uint64_t previousClaims=0,previousAchievements=0;
    for(int day=1;day<=3;++day) {
        for(int tick=0;tick<10000 && !game.summary();++tick){referenceDecisions(game);game.advance(.1);}
        check(game.summary() && game.journal.settled==std::uint64_t(day) && game.journal.days==std::uint64_t(day));
        check(game.journal.counts[10]==std::uint64_t(game.served) && game.journal.counts[9]==game.campaign.mixed);
        const auto dailyCount=std::uint64_t(std::popcount(game.journal.daily));
        check(game.journal.claims==previousClaims+dailyCount);
        check((game.journal.achievements&previousAchievements)==previousAchievements);
        check(game.journal.newAchievements==(game.journal.achievements^previousAchievements));
        check(game.credited("cafe:daily")==std::int64_t(game.journal.claims)*Simulation::dailyReward);
        check(game.credited("cafe:achievements")==std::popcount(game.journal.achievements)*Simulation::achievementReward);
        if(day==1)check((game.journal.daily&5)==5 && (game.journal.achievements&1));
        auto bytes=game.save();roundtrip(game);game.advance(100);game.campaignTick();check(game.save()==bytes);
        // Damaged masks, reward counts and counters leave the current cafe intact.
        const auto offset=bytes.size()-compatibilitySaveBytes-garden::saveBytes-Simulation::gardenStorySaveBytes-Simulation::journalSaveBytes;
        auto word=[](auto& data,std::size_t at,std::uint64_t n){for(int b=0;b<8;++b)data[at+b]=std::uint8_t(n>>(8*b));};
        for(auto [field,value]:std::array<std::pair<int,std::uint64_t>,5>{{{4,9999},{5,1ULL<<30},{7,8},{9,9999999},{20,9999999}}}) {
            auto bad=bytes;word(bad,offset+std::size_t(field)*8,value);check(!game.load(bad) && game.save()==bytes);
        }
        previousClaims=game.journal.claims;previousAchievements=game.journal.achievements;
        if(day<3){check(game.nextDay());check(!game.journal.daily && !game.journal.newAchievements && game.journal.baseline==game.journal.counts);roundtrip(game);check(game.openDay());}
    }
    // Early/empty closes never earn care goals or full-shift milestones.
    Simulation empty;check(empty.startCampaign(321) && empty.openDay() && empty.closeDay());
    for(int tick=0;tick<100 && !empty.summary();++tick)empty.advance(.1);
    check(empty.summary() && !empty.journal.daily && !empty.journal.achievements && !empty.journal.days);roundtrip(empty);
    // Explicit migration from the previous schedule format; no historical rewards.
    Simulation previous;check(previous.startCampaign(123));
    auto old=withoutGardenFields(previous);const auto at=old.size()-compatibilitySaveBytes-Simulation::journalSaveBytes;
    old.erase(old.begin()+at,old.begin()+at+Simulation::journalSaveBytes);
    auto word=[](auto& data,std::size_t offset,std::uint64_t value){for(int b=0;b<8;++b)data[offset+b]=std::uint8_t(value>>(8*b));};
    auto stamp=contentForRules(8,8);word(old,8,16);word(old,old.size()-16,stamp.version);word(old,old.size()-8,stamp.fingerprint);
    Simulation migrated;auto result=migrated.restore(old);check(result && result.migrated && migrated.journal.eligible && !migrated.journal.claims);roundtrip(migrated);
    check(migrated.openDay());
    // Migration during service normalizes its opening checkpoint, too.
    auto current=withoutGardenFields(migrated);const auto journalAt=current.size()-compatibilitySaveBytes-Simulation::journalSaveBytes;
    current.erase(current.begin()+journalAt,current.begin()+journalAt+Simulation::journalSaveBytes);
    word(current,8,16);word(current,current.size()-16,stamp.version);word(current,current.size()-8,stamp.fingerprint);
    check(migrated.restore(current).migrated && !migrated.journal.eligible);roundtrip(migrated);
    check(migrated.restartDay() && !migrated.journal.eligible);roundtrip(migrated);
}
