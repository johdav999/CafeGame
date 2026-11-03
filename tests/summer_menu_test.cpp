#include "scenarios.hpp"
#include "diagnostics.hpp"
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <source_location>
using cafe::Simulation;
namespace sim=cafe::sim;
void check(bool ok,std::source_location at=std::source_location::current()) {
    if(!ok)throw std::runtime_error("Summer menu line "+std::to_string(at.line()));
}
void roundtrip(Simulation& g,std::source_location at=std::source_location::current()) {auto bytes=g.save();check(g.load(bytes) && g.save()==bytes,at);}
void workshop(Simulation& g) {g.contentAccess={true,true};check(cafe::startGardenWorkshop(g));}
void write(const char* directory,const char* name,const std::vector<std::uint8_t>& bytes) {
    if(!directory)return;std::filesystem::create_directories(directory);
    std::ofstream out(std::filesystem::path(directory)/name,std::ios::binary);
    out.write(reinterpret_cast<const char*>(bytes.data()),std::streamsize(bytes.size()));check(bool(out));
}
int main(int argc,char** argv) {try {
    const char* output=argc==2?argv[1]:nullptr;
    // Additive public APIs reject atomically and preserve a running job/holds.
    Simulation extension{20,5000};check(extension.welcome(1,2) && extension.prepare(2));extension.advance(1);
    auto snapshot=extension.runtime->save();auto job=extension.runtime->job(extension.items[0].shot).value;
    check(!extension.runtime->extendResources(std::array{sim::ResourceId{"garden:ice"},extension.beans}));
    check(!extension.runtime->extendInventory(extension.inventory,std::array{sim::Amount{extension.beans,10}}));
    check(!extension.runtime->extendWorker(extension.staff,std::array{std::string{"cafe:brew"}}));
    check(extension.runtime->save()==snapshot);
    auto foreign=extension.staff;foreign.epoch++;check(!extension.runtime->extendWorker(foreign,std::array{std::string{"garden:cold"}}));
    auto foreignInventory=extension.inventory;foreignInventory.epoch++;
    check(!extension.runtime->extendInventory(foreignInventory,std::array{sim::Amount{extension.coffee,10}}));
    extension.enableSummerCatalog();
    const auto retained=extension.runtime->job(job.id).value;
    check(retained.deadline==job.deadline && retained.assignment==job.assignment && retained.worker==job.worker && retained.state==job.state);
    check(extension.runtime->stock(extension.inventory,extension.ingredient(5)).value.total==0);
    auto extended=extension.runtime->save();Simulation catalog;catalog.enableSummerCatalog();
    check(bool(catalog.runtime->restore(extended)) && catalog.runtime->save()==extended);

    // Real schema-22 active guests, wages, seats and opening checkpoints survive.
    std::ifstream oldFile(GARDEN_G3_FIXTURE,std::ios::binary);check(bool(oldFile));
    const std::vector<std::uint8_t> old{std::istreambuf_iterator<char>(oldFile),{}};
    Simulation migrated;migrated.contentAccess={true,true};auto result=migrated.restore(old);
    check(result && result.migrated && result.sourceSchema==22 && migrated.summerCatalog);
    check(migrated.guests.size()==4 && migrated.crew.size()==3 && migrated.debited("cafe:wages")==300);
    check(!migrated.coldStation && migrated.stock==24 && migrated.tableMask()==51);
    for(std::size_t n=5;n<8;++n)check(migrated.storedIngredient(n).total==0 && migrated.runtime->stock(migrated.inventory,migrated.ingredient(n)).value.total==0);
    roundtrip(migrated);check(migrated.restartDay() && migrated.summerCatalog && migrated.guests.empty());

    Simulation base;check(!base.welcome(1,5) && !base.prepare(5) && base.ingredientCount()==5 && base.unlockedMask()==31);
    Simulation gate;gate.contentAccess={true,true};check(gate.startCampaign(123) && gate.selectGarden() && gate.openCourtyard());
    check(!gate.welcome(1,7) && gate.recipeReason(7).find("mixed order")!=std::string::npos);
    check(!gate.equipmentChange(0,7,14,0,0));

    // Exclusive station, placement rollback, cost/refund and recipe gates.
    Simulation equipment;workshop(equipment);check(equipment.wallet==96000 && equipment.coldStation);
    auto before=equipment.save();check(!equipment.equipmentChange(1,7,0,0,0) && equipment.save()==before);
    check(equipment.equipmentChange(1,7,14,0,1));roundtrip(equipment);
    check(equipment.equipmentChange(2,7) && equipment.wallet==98000 && !equipment.coldStation);
    check(!equipment.welcome(1,5) && !equipment.welcome(1,6) && equipment.recipeReason(7).empty());
    check(equipment.equipmentChange(0,1,10,0,0)); // Shared prep never supplies cold capability.
    check(!equipment.welcome(1,5));
    check(equipment.equipmentChange(0,7,14,0,0) && equipment.unlockedMask()==255);roundtrip(equipment);

    std::uint64_t completedHash=0;
    for(int p=5;p<8;++p) {
        Simulation g;workshop(g);g.toggleClosed();check(g.welcome(1,p));
        const auto inputs=g.ticketInputs({p,-1});check(g.prepare(p));
        g.advance(.25);roundtrip(g);g.advance(10);check(g.ready);roundtrip(g);
        for(const auto& a:inputs)check(g.runtime->stock(g.inventory,a.resource).value.total==(a.resource==g.beans?100:12)-a.quantity);
        check(g.machineCondition.snapshot().uses==std::uint64_t(p==5));
        check(g.serve() && g.served==1 && g.credited("cafe:sales")==cafe::definitions::menu[std::size_t(p)].price);
        auto paid=g.save();check(!g.serve() && g.save()==paid);roundtrip(g);completedHash^=sim::checkpointHash(g.save());
    }
    Simulation mixed;workshop(mixed);mixed.toggleClosed();check(mixed.welcome(1,5,7) && mixed.prepare(5));
    write(output,"mixed-start.save",mixed.save());mixed.advance(3.5);roundtrip(mixed);write(output,"mixed-cold.save",mixed.save());
    check(mixed.items[0].shot && mixed.runtime->job(mixed.items[0].shot).value.state==sim::JobState::Completed);
    check(mixed.credited("cafe:sales")==0 && !mixed.serve());
    mixed.advance(5);check(mixed.ready && mixed.serve() && mixed.credited("cafe:sales")==1300 && mixed.ledger->sequence("cafe:sales")==1);roundtrip(mixed);
    Simulation pair;workshop(pair);check(pair.hire() && pair.equipmentChange(0,1,10,0,0));pair.toggleClosed();check(pair.welcome(1,5,6) && pair.prepare(5));
    bool coldSeen=false;
    for(int n=0;n<120 && !pair.ready;++n){int cold=0;for(auto id:pair.productionJobs()){auto j=pair.runtime->job(id).value;if(j.station==pair.coldStation && (j.state==sim::JobState::Assigned || j.state==sim::JobState::Running))++cold;}check(cold<=1);coldSeen|=cold==1;pair.advance(.1);}
    check(coldSeen && pair.ready && pair.serve() && pair.credited("cafe:sales")==1400);roundtrip(pair);
    Simulation coffee;workshop(coffee);coffee.toggleClosed();check(coffee.welcome(1,2,5) && coffee.prepare(2));coffee.advance(15);
    check(coffee.ready && coffee.machineCondition.snapshot().uses==2 && coffee.stock==98);roundtrip(coffee);check(coffee.serve());
    Simulation table;table.immediate=false;workshop(table);check(table.editGardenLayout(2,101,2,1,0));table.toggleClosed();
    check(table.welcome(2,5,7,false,1));bool trayRestored=false,deliveryRestored=false;
    for(int tick=0;tick<1200 && table.served==0;++tick){
        auto id=table.guests.front().id;auto* guest=table.guest(id);
        if(guest->phase==Simulation::GuestPhase::ToSeat){auto seat=table.seats.claim(id);table.seated(id,seat->point,seat->token);}
        if(!guest->visit && !guest->rating){if(!guest->orderTaken)table.collectOrder(id);else if(guest->prepared){if(!trayRestored){roundtrip(table);id=table.guests.front().id;trayRestored=true;}table.requestServing(id);}else if(!table.active())table.prepareGuest(id);}
        table.workflowTick();
        if(table.guest(id)->visit && table.tasks->task(table.guest(id)->visit)->spec.key=="cafe:deliver" && !deliveryRestored){roundtrip(table);deliveryRestored=true;}
        for(const auto& worker:table.crew)if(auto task=table.tasks->current(worker.id);task && task->state==sim::TaskState::Assigned)Simulation::require(table.tasks->start(task->id,worker.id,task->token));
        for(auto jobId:table.productionJobs()){auto job=table.runtime->job(jobId).value;if(job.state==sim::JobState::Assigned)Simulation::require(table.runtime->arrive(jobId,job.assignment));}
        table.advance(.1);
    }
    check(trayRestored && deliveryRestored && table.served==1 && table.credited("cafe:sales")==1300 && table.guests.front().rating==1);roundtrip(table);

    // Every delivered resource uses normal reserved capacity, refunds and restocking.
    for(int n=5;n<8;++n) {
        Simulation g;workshop(g);const auto cash=g.wallet;check(g.purchaseIngredient(n));roundtrip(g);
        check(g.wallet==cash-cafe::definitions::ingredients[std::size_t(n)].price*12);
        check(g.storedIngredient(n).reservedCapacity==12 && g.cancelSupply() && g.wallet==cash);
        check(g.purchaseIngredient(n));g.advance(8);check(g.storedIngredient(n).total==12);roundtrip(g);
        check(g.restockIngredient(n) && g.storedIngredient(n).total==8 && g.runtime->stock(g.inventory,g.ingredient(n)).value.total==16);roundtrip(g);
    }
    Simulation shortage;workshop(shortage);shortage.toggleClosed();
    Simulation::require(shortage.runtime->remove(shortage.inventory,std::array{sim::Amount{shortage.ingredient(5),12}}));
    check(shortage.welcome(1,5,7));before=shortage.save();check(!shortage.prepare(5) && shortage.save()==before && shortage.menuMessage.find("Ice")!=std::string::npos);
    write(output,"shortage.save",shortage.save());
    Simulation expired;workshop(expired);expired.toggleClosed();check(expired.welcome(1,5,7) && expired.prepare(5));expired.advance(8);
    check(expired.ready);roundtrip(expired);expired.advance(60);check(!expired.active() && expired.served==0 && expired.wasted==2);
    auto wasted=expired.wasted;expired.advance(1);check(expired.wasted==wasted);roundtrip(expired);
    Simulation interrupted;workshop(interrupted);interrupted.toggleClosed();check(interrupted.welcome(1,5,7) && interrupted.prepare(5));interrupted.advance(.5);
    interrupted.takeBreak();roundtrip(interrupted);interrupted.advance(10);check(interrupted.ready && !interrupted.onShift() && !interrupted.handoverReady());
    interrupted.takeBreak();interrupted.advance(10);check(interrupted.ready);interrupted.toggleClosed();check(interrupted.serve());roundtrip(interrupted);
    Simulation ready;workshop(ready);write(output,"workshop.save",ready.save());
    check(cafe::shiftReport(ready).find("\"iceReady\":12")!=std::string::npos && cafe::shiftReport(ready).find("\"cakeStockStored\":0")!=std::string::npos);
    // Demand includes summer recipes only while their equipment is installed.
    ready.toggleClosed();check(ready.welcomeMenu(1) && ready.welcomeMenu(1));check(ready.guests.back().items[0]>=5);roundtrip(ready);
    // Earn the unlocks and equipment through normal campaign receipts. Opening
    // checkpoints roll back summer stock, reviews and payment together.
    Simulation campaign;campaign.contentAccess={true,true};check(campaign.startCampaign(123) && campaign.selectGarden() && campaign.openCourtyard() && campaign.openDay());campaign.automaticGuests=false;
    for(int n=0;n<6;++n){check(campaign.welcome(1,0,4) && campaign.prepare(0));campaign.advance(10);check(campaign.ready && campaign.serve());campaign.departed(campaign.guests.back().id);}
    check((campaign.campaign.goals&3)==3 && campaign.credited("cafe:sales")==5100 && campaign.unlocked(7) && !campaign.unlocked(5));
    check(campaign.closeDay());campaign.advance(10);check(campaign.summary() && campaign.nextDay());
    check(campaign.equipmentChange(0,7,14,0,0));
    for(int n=5;n<8;++n){check(campaign.purchaseIngredient(n));campaign.advance(8);check(campaign.restockIngredient(n));}
    check(campaign.requestMaintenance(Simulation::Maintenance::Repair));campaign.advance(4);
    check(campaign.openDay());campaign.automaticGuests=false;const auto opening=campaign.save();write(output,"campaign-opening.save",opening);
    auto count=campaign.journal.counts;
    check(campaign.welcome(1,5,7) && campaign.prepare(5));campaign.advance(10);check(campaign.ready && campaign.serve());
    check(campaign.journal.counts[6]==count[6] && campaign.journal.counts[7]==count[7] && campaign.journal.counts[10]==count[10]+1);
    check(campaign.credited("cafe:sales")==6400);roundtrip(campaign);campaign.departed(campaign.guests.back().id);
    check(campaign.closeDay());campaign.advance(10);check(campaign.summary());roundtrip(campaign);
    check(campaign.restartDay() && campaign.coldStation && campaign.credited("cafe:sales")==5100 && campaign.openDay());campaign.automaticGuests=false;check(campaign.save()==opening);
    std::cout<<"{\"summerMenu\":true,\"completedHash\":\""<<completedHash<<"\",\"mixedHash\":\""<<sim::checkpointHash(mixed.save())<<"\"}\n";
}catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}}
