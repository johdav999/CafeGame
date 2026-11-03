#include "simulation.hpp"
#include <iostream>
#include <source_location>
#include <filesystem>
#include <fstream>
#include "cafe_dining_cases.hpp"
#include "appealing_cafe_fixture.hpp"
using cafe::Simulation;
namespace sim=cafe::sim;
void check(bool ok,std::source_location at=std::source_location::current()) {
    if(!ok)throw std::runtime_error("Table service line "+std::to_string(at.line()));
}
// Navigation completion adapter: browser evidence separately exercises walking.
void tick(Simulation& game,double seconds) {
    for(int n=0;n<int(seconds*100);++n) {
        game.workflowTick();
        for(const auto& worker:game.crew)if(auto t=game.tasks->current(worker.id)) {
            if(t->state==sim::TaskState::Assigned)Simulation::require(game.tasks->start(t->id,worker.id,t->token));
        }
        for(auto id:game.productionJobs()) {
            auto j=game.runtime->job(id).value;
            if(j.state==sim::JobState::Assigned)Simulation::require(game.runtime->arrive(id,j.assignment));
        }
        game.advance(.01);
    }
}
void roundtrip(Simulation& game) {
    static int checkpoint=0;++checkpoint;
    auto bytes=game.save();Simulation restored;restored.immediate=game.immediate;
    if(!restored.load(bytes))throw std::runtime_error("Table service restore checkpoint "+std::to_string(checkpoint));
    check(restored.save()==bytes);check(game.load(bytes));
}
int main(int argc,char** argv) {try {
    cafeDiningChecks();
    Simulation game{100,5000};game.immediate=false;
    check(game.welcome(0,0));auto first=game.guests.back().id;
    check(game.welcome(2,3,4));auto second=game.guests.back().id;
    check(game.queue.claims().empty());
    check(game.guests[0].phase==Simulation::GuestPhase::ToSeat);
    roundtrip(game);first=game.guests[0].id;second=game.guests[1].id;
    for(auto id:{first,second}){auto c=game.seats.claim(id);check(c && c->point!=Simulation::Pool::waiting);game.seated(id,c->point,c->token);}
    check(!game.brew(false));check(game.collectOrder(second));check(!game.collectOrder(second));
    roundtrip(game);first=game.guests[0].id;second=game.guests[1].id;
    tick(game,1);check(game.guest(second)->orderTaken);check(!game.active());
    check(game.collectOrder(first));tick(game,1);check(game.guest(first)->orderTaken);
    roundtrip(game);first=game.guests[0].id;second=game.guests[1].id;
    // A later arrival can be prepared first, despite an earlier waiting guest.
    check(game.prepareGuest(second));tick(game,12);check(bool(game.guest(second)->prepared));check(!game.active());
    check(game.prepareGuest(first));tick(game,6);check(bool(game.guest(first)->prepared));
    roundtrip(game);first=game.guests[0].id;second=game.guests[1].id;
    check(game.requestServing(first));check(!game.requestServing(first));roundtrip(game);
    first=game.guests[0].id;second=game.guests[1].id;tick(game,1);
    check(game.served==1 && game.guest(first)->rating==1 && game.guest(second)->prepared);
    check(game.requestServing(second));tick(game,1);check(game.served==2 && game.wallet==6250);
    roundtrip(game);
    if(argc==2) {
        std::filesystem::create_directories(argv[1]);auto bytes=game.save();
        std::ofstream file(std::filesystem::path(argv[1])/"dining.bin",std::ios::binary);file.write(reinterpret_cast<const char*>(bytes.data()),bytes.size());check(bool(file));
        Simulation shortage{1,10000};shortage.immediate=false;
        check(shortage.welcome(0,0,2));auto guest=shortage.guests.front().id;auto seat=shortage.seats.claim(guest);check(bool(seat));
        shortage.seated(guest,seat->point,seat->token);check(shortage.collectOrder(guest));tick(shortage,1);
        for(int ingredient:{2,4}) {
            auto amount=shortage.runtime->stock(shortage.inventory,shortage.ingredient(ingredient)).value.available();
            check(bool(shortage.runtime->remove(shortage.inventory,std::array{sim::Amount{shortage.ingredient(ingredient),amount}})));
        }
        check(shortage.ticketShortages({0,2})==std::vector<std::size_t>({0,2}));roundtrip(shortage);
        auto supplyBytes=shortage.save();std::ofstream supplyFile(std::filesystem::path(argv[1])/"shortages.bin",std::ios::binary);
        supplyFile.write(reinterpret_cast<const char*>(supplyBytes.data()),supplyBytes.size());check(bool(supplyFile));
        // Arrival balancing changes the content stamp, not the binary schema.
        auto previousBalance=withoutGardenFields(shortage);auto previousStamp=cafe::contentForRules(11,11);
        auto putWord=[&](std::size_t offset,std::uint64_t value){for(int n=0;n<8;++n)previousBalance[offset+n]=std::uint8_t(value>>(n*8));};
        putWord(previousBalance.size()-16,previousStamp.version);putWord(previousBalance.size()-8,previousStamp.fingerprint);
        Simulation upgraded;auto upgrade=upgraded.restore(previousBalance);check(upgrade && upgrade.migrated && upgraded.save()==supplyBytes);
        std::ofstream previousFile(std::filesystem::path(argv[1])/"previous-balance.bin",std::ios::binary);
        previousFile.write(reinterpret_cast<const char*>(previousBalance.data()),previousBalance.size());check(bool(previousFile));
        Simulation traffic{100,20000};establishAppealingCafe(traffic);traffic.immediate=false;traffic.automaticGuests=true;
        check(traffic.welcome(1));check(traffic.welcome(0));check(traffic.welcome(2));
        for(int n=0;n<100;++n){traffic.demandArrival();check(traffic.waitingForTable()<=2);}
        check(traffic.waitingForTable()==2 && traffic.queue.claims().size()==3 && traffic.guests.size()==9);roundtrip(traffic);
        auto trafficBytes=traffic.save();std::ofstream trafficFile(std::filesystem::path(argv[1])/"bounded-traffic.bin",std::ios::binary);
        trafficFile.write(reinterpret_cast<const char*>(trafficBytes.data()),trafficBytes.size());check(bool(trafficFile));
        Simulation previousVisitors{100,20000};previousVisitors.immediate=false;previousVisitors.automaticGuests=true;
        for(int n=0;n<4;++n)check(previousVisitors.welcome(0));for(int n=0;n<3;++n)check(previousVisitors.welcome(1));
        auto oldVisitors=withoutGardenFields(previousVisitors);auto oldStamp=cafe::contentForRules(12,12);
        for(int n=0;n<8;++n){oldVisitors[oldVisitors.size()-16+n]=std::uint8_t(std::uint64_t(oldStamp.version)>>(n*8));oldVisitors[oldVisitors.size()-8+n]=std::uint8_t(oldStamp.fingerprint>>(n*8));}
        Simulation migratedVisitors;auto migratedResult=migratedVisitors.restore(oldVisitors);check(migratedResult && migratedResult.migrated && migratedVisitors.visitingGuests()==7 && migratedVisitors.visitorLimit()==2);
        migratedVisitors.demandArrival();check(migratedVisitors.guests.size()==7);
        std::ofstream oldVisitorFile(std::filesystem::path(argv[1])/"previous-visitors.bin",std::ios::binary);oldVisitorFile.write(reinterpret_cast<const char*>(oldVisitors.data()),oldVisitors.size());check(bool(oldVisitorFile));
    }
    // An unserved seated guest keeps their service patience, not the visit timer.
    Simulation waiting;waiting.immediate=false;check(waiting.welcome());auto id=waiting.guests[0].id;auto c=waiting.seats.claim(id);waiting.seated(id,c->point,c->token);
    waiting.advance(9);check(waiting.guests[0].phase==Simulation::GuestPhase::Dining && !waiting.guests[0].rating);
    waiting.advance(111);check(waiting.guests[0].phase==Simulation::GuestPhase::Leaving && !waiting.seats.claim(id));
    Simulation full;full.immediate=false;
    for(int n=0;n<5;++n)check(full.welcome());
    auto last=full.guests.back().id;check(full.seats.claim(last)->point==Simulation::Pool::waiting);
    full.advance(180);check(full.guest(last)->phase==Simulation::GuestPhase::Leaving && !full.seats.claim(last));
    // Abandoning a prepared order cancels its delivery and releases its claim.
    Simulation expired{100};expired.immediate=false;check(expired.welcome());id=expired.guests[0].id;c=expired.seats.claim(id);expired.seated(id,c->point,c->token);
    check(expired.collectOrder(id));tick(expired,1);check(expired.prepareGuest(id));tick(expired,6);check(bool(expired.guest(id)->prepared));
    check(expired.requestServing(id));expired.advance(120);check(!expired.guest(id)->prepared && !expired.guest(id)->visit && expired.served==0);
    roundtrip(expired);
    std::cout<<"Table seating, patience, stacked orders, selected preparation, reverse delivery and persistence passed\n";
    return 0;
}catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}}
