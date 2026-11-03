#pragma once
#include "balance.hpp"
#include "previous_guest_envelope.hpp"
#include "fixtures/schema12.hpp"
#include "fixtures/schema13.hpp"
#include <source_location>
inline void cafeEquipmentChecks() {
    using namespace cafe;
    auto check=[](bool ok,std::source_location at=std::source_location::current()){if(!ok)throw std::runtime_error("Cafe equipment line "+std::to_string(at.line()));};
    auto roundtrip=[](Simulation& g,std::source_location at=std::source_location::current()){auto bytes=g.save();if(!g.load(bytes) || g.save()!=bytes)throw std::runtime_error("Equipment restore at "+std::to_string(at.line()));};
    Simulation poor{4,0};poor.toggleClosed();auto bytes=poor.save();check(!poor.equipmentChange(0,0) && poor.save()==bytes);
    // Reputation follows installed decor, including restores, without farming moves/resales.
    Simulation decor{4,10000};decor.toggleClosed();check(decor.reputation()==750);
    for(int key=3;key<7;++key){const auto& item=Simulation::buildItems[key];check(decor.equipmentChange(0,key,item.x,item.z));}
    check(decor.furnishingReputation()==30 && decor.reputation()==780);roundtrip(decor);
    bytes=decor.save();check(!decor.equipmentChange(0,3,0,5) && decor.save()==bytes && decor.reputation()==780);
    check(decor.equipmentChange(1,3,0,5) && decor.reputation()==780);
    check(decor.setPlantStyle(20,3,1) && decor.reputation()==780);
    check(decor.equipmentChange(2,3) && decor.reputation()==770);
    check(decor.equipmentChange(0,3,0,5) && decor.reputation()==780);roundtrip(decor);
    // A known content-5 save retains layout and acquires the derived bonus once.
    auto previousEquipment=[](const Simulation& game){
        auto data=withoutGardenFields(game);
        auto journalOffset=data.size()-compatibilitySaveBytes-Simulation::journalSaveBytes;
        data.erase(data.begin()+journalOffset,data.begin()+journalOffset+Simulation::journalSaveBytes);
        auto scheduleOffset=data.size()-compatibilitySaveBytes-game.campaignSaveBytes()-Simulation::scheduleSaveBytes;
        data.erase(data.begin()+scheduleOffset,data.begin()+scheduleOffset+Simulation::scheduleSaveBytes);
        data[8]=15;return data;
    };
    bytes=previousEquipment(decor);auto putWord=[&](std::size_t offset,std::uint64_t value){for(int i=0;i<8;++i)bytes[offset+i]=std::uint8_t(value>>(i*8));};
    putWord(bytes.size()-16,equipmentContent.version);putWord(bytes.size()-8,equipmentContent.fingerprint);
    Simulation restoredDecor;auto restoredBonus=restoredDecor.restore(bytes);
    check(restoredBonus && restoredBonus.migrated && restoredDecor.reputation()==780);roundtrip(restoredDecor);
    decor.deliveredReviews=1;decor.totalSatisfaction=990;check(decor.reputation()==1000);
    decor.totalSatisfaction=400;check(decor.reputation()==430);
    Simulation locked;check(locked.startCampaign());bytes=locked.save();check(!locked.equipmentChange(0,0) && locked.save()==bytes && !locked.editLayout(2,3,12,10,0));
    Simulation shop{4,100000};shop.toggleClosed();bytes=shop.save();check(!shop.equipmentChange(0,1,16,9) && shop.save()==bytes);
    check(!shop.equipmentChange(0,2,10,2,2) && shop.save()==bytes); // Preserve kettle access behind the counter.
    check(shop.editLayout(0,1,0,10,0) && shop.editLayout(0,2,6,10,0));
    check(shop.editLayout(2,3,12,10,0) && shop.editLayout(2,4,18,10,0) && shop.tableCount()==4);
    check(!shop.editLayout(2,5,0,0,0));
    for(int n=0;n<7;++n){const auto& item=Simulation::buildItems[std::size_t(n)];check(shop.equipmentChange(0,n,item.x,item.z));roundtrip(shop);}
    check(shop.runtime->metrics().stations==5 && shop.extraStorage && shop.storedBeans().capacity==48);
    check(shop.setFinish(2));roundtrip(shop);check(shop.finish==2);
    const auto plantCash=shop.wallet;
    for(int plant=0;plant<4;++plant)for(int pot=0;pot<3;++pot) {
        check(shop.setPlantStyle(20,plant,pot));roundtrip(shop);
        check(shop.plantStyles[0]==plant && shop.potStyles[0]==pot && shop.wallet==plantCash);
    }
    bytes=shop.save();check(!shop.setPlantStyle(19,0,0) && !shop.setPlantStyle(20,4,0) && !shop.setPlantStyle(20,0,3) && shop.save()==bytes);
    auto invalidStyle=bytes;invalidStyle[88+shop.runtime->save().size()+25*8]=4;
    check(!shop.load(invalidStyle) && shop.save()==bytes);
    // Schema 14 has the same game rules and no style words; defaults are explicit.
    auto version14=previousEquipment(shop);const auto styleOffset=88+shop.runtime->save().size()+25*8;
    const auto oldStamp=contentForRules(6,6);
    for(int i=0;i<8;++i){version14[version14.size()-16+i]=std::uint8_t(std::uint64_t(oldStamp.version)>>(i*8));version14[version14.size()-8+i]=std::uint8_t(oldStamp.fingerprint>>(i*8));}
    version14.erase(version14.begin()+styleOffset,version14.begin()+styleOffset+4*8);version14[8]=14;
    Simulation migratedPlants;auto plantMigration=migratedPlants.restore(version14);
    check(plantMigration && plantMigration.migrated && migratedPlants.plantStyles==std::array<int,2>{0,1} && migratedPlants.potStyles==std::array<int,2>{2,0});
    roundtrip(migratedPlants);
    Simulation openPlants;
    if(openPlants.closed || openPlants.layoutEditable() || openPlants.setPlantStyle(20,2,1))throw std::runtime_error("Plant edit gate: closed="+std::to_string(openPlants.closed));
    check(shop.wallet==88300 && shop.debited("cafe:upgrades")==10500 && shop.credited("cafe:resale")==0);
    for(int n=0;n<3;++n){check(shop.purchaseBeans(12));shop.advance(8);roundtrip(shop);}
    check(shop.storedBeans().total==36 && shop.runtime->stock(shop.annex,shop.beans).value.total==12);
    bytes=shop.save();check(!shop.equipmentChange(2,2) && shop.save()==bytes);
    // Exclusive source selection survives a partial physical stock run.
    for(int n=0;n<6;++n)check(shop.restock());check(shop.runtime->stock(shop.storage,shop.beans).value.total==0);
    shop.immediate=false;check(shop.requestRestock(0) && shop.restockAnnex[0]);shop.workflowTick();
    auto task=shop.tasks->task(shop.restockWork[0]).value();check(bool(shop.tasks->start(task.id,task.worker,task.token)));shop.advance(.5);roundtrip(shop);
    shop.advance(1);check(!shop.restockWork[0] && !shop.restockAnnex[0]);shop.immediate=true;
    check(shop.restock() && shop.restock());check(shop.runtime->stock(shop.annex,shop.beans).value.total==0);
    check(shop.equipmentChange(2,2) && !shop.extraStorage && shop.storedBeans().capacity==24);roundtrip(shop);
    // Every table can be occupied in the same session; cosmetics do not create seats.
    shop.toggleClosed();
    for(int n=0;n<4;++n){check(shop.welcome(0,4) && shop.prepare(4));shop.advance(.5);check(shop.serve());}
    check(shop.seats.claims().size()==4);for(const auto& claim:shop.seats.claims())check(claim.occupied && claim.point<4);roundtrip(shop);
    Simulation waiting{24,10000};
    for(int n=0;n<2;++n){check(waiting.welcome(0,4) && waiting.prepare(4));waiting.advance(.5);check(waiting.serve());}
    check(waiting.welcome(0,4) && waiting.welcome(0,4) && !waiting.prepare(4));
    check(waiting.seats.claims().size()==4 && waiting.guests[2].phase==Simulation::GuestPhase::ToSeat);roundtrip(waiting);
    check(std::count_if(waiting.seats.claims().begin(),waiting.seats.claims().end(),[](auto c){return c.point==Simulation::Pool::waiting;})==2);
    Simulation fast{24,10000};fast.toggleClosed();check(fast.equipmentChange(0,0));fast.toggleClosed();check(fast.welcome(1,0) && fast.brew());
    fast.advance(1.799);check(!fast.ready);fast.advance(.001);check(fast.ready && fast.machineCondition.snapshot().integrity==850 && fast.machineCondition.snapshot().cleanliness==800);
    check(fast.serve());fast.departed(fast.customer);fast.toggleClosed();check(fast.requestMaintenance(Simulation::Maintenance::Repair) && fast.maintenanceCost==750);fast.advance(1);roundtrip(fast);fast.advance(3);roundtrip(fast);
    check(fast.equipmentChange(2,0) && !fast.fastMachine && fast.repairPrice()==500);roundtrip(fast);
    // Two employees reserve different workers/stations for simultaneous shots.
    Simulation team{24,100000};team.toggleClosed();check(team.equipmentChange(0,1,10,0) && team.hire());team.toggleClosed();
    check(team.welcome(1,0,2) && team.prepare(0));auto jobs=team.productionJobs();int running=0;
    for(auto id:jobs)running+=team.runtime->job(id).value.state==sim::JobState::Running;check(running==2);
    auto first=team.runtime->job(jobs[0]).value,shot=team.runtime->job(team.items[1].shot).value;check(first.worker!=shot.worker && first.station!=shot.station);
    team.advance(1);check(team.staffBreak(shot.worker));roundtrip(team);team.advance(4);
    check(team.ready && team.handoverReady() && team.runtime->time()==5000 && !team.onShift(team.crew[1].id));check(team.serve());roundtrip(team);
    Simulation solo{24,100000};solo.toggleClosed();check(solo.equipmentChange(0,1,10,0));solo.toggleClosed();check(solo.welcome(1,0,2) && solo.prepare(0));solo.advance(8);check(solo.ready && solo.serve());roundtrip(solo);
    // Invalid ownership, capabilities or aggregate costs preserve the live state.
    bytes=shop.save();auto bad=bytes;auto offset=88+shop.runtime->save().size();bad[offset]=2;check(!shop.load(bad) && shop.save()==bytes);
    bad=bytes;bad[offset+8]=1;check(!shop.load(bad) && shop.save()==bytes);
    // A genuine campaign-19 closing save, with its nested old checkpoint, upgrades.
    std::vector<std::uint8_t> legacy;auto hex=[](char c){return c<='9'?c-'0':c-'a'+10;};for(std::size_t n=0;n+1<schema12Hex.size();n+=2)legacy.push_back(std::uint8_t(hex(schema12Hex[n])*16+hex(schema12Hex[n+1])));
    Simulation campaign;auto result=campaign.restore(legacy);check(result && result.migrated && result.sourceSchema==12 && campaign.campaign.enabled && !campaign.fastMachine);roundtrip(campaign);
    for(int n=0;n<1200 && !campaign.summary();++n){referenceDecisions(campaign);campaign.advance(.1);}
    check(campaign.summary() && campaign.campaign.goals==15 && campaign.debited("cafe:overhead")==500);
    check(campaign.nextDay() && campaign.equipmentChange(0,0));roundtrip(campaign);
    check(campaign.openDay());check(campaign.restartDay() && campaign.fastMachine && campaign.campaign.day==2);roundtrip(campaign);
    legacy.clear();for(std::size_t n=0;n+1<schema13Hex.size();n+=2)legacy.push_back(std::uint8_t(hex(schema13Hex[n])*16+hex(schema13Hex[n+1])));
    result=waiting.restore(legacy);check(result && result.migrated && result.sourceSchema==13 && waiting.wallet==6500);
    check(waiting.seats.claims().size()==3 && waiting.seats.claims()[2].point==Simulation::Pool::waiting);roundtrip(waiting);
    bytes=waiting.save();bad=bytes;offset=88+waiting.runtime->save().size()+24*8;bad[offset]=15;
    check(!waiting.load(bad) && waiting.save()==bytes);
}
