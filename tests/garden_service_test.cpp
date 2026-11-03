#include "scenarios.hpp"
#include "diagnostics.hpp"
#include "appealing_cafe_fixture.hpp"
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <source_location>
using cafe::Simulation;
namespace sim=cafe::sim;
void check(bool ok,std::source_location at=std::source_location::current()) {
    if(!ok)throw std::runtime_error("Garden service line "+std::to_string(at.line()));
}
void roundtrip(Simulation& game) {
    auto bytes=game.save();check(game.load(bytes));check(game.save()==bytes);
}
void write(const char* directory,const char* name,const std::vector<std::uint8_t>& bytes) {
    if(!directory)return;std::filesystem::create_directories(directory);
    std::ofstream file(std::filesystem::path(directory)/name,std::ios::binary);
    file.write(reinterpret_cast<const char*>(bytes.data()),std::streamsize(bytes.size()));check(bool(file));
}
void populate(Simulation& game) {
    check(game.welcome(0,0,-1,false,0));check(game.welcome(2,4,-1,false,1));
    check(game.welcome(0,0,-1,false,0));check(game.welcome(2,4,-1,false,1));
}
int main(int argc,char** argv) {try {
    const char* output=argc==2?argv[1]:nullptr;
    // Genuine G2 save: outdoor furniture exists, both active claims are indoors.
    std::ifstream file(GARDEN_G2_FIXTURE,std::ios::binary);check(bool(file));
    std::vector<std::uint8_t> old{std::istreambuf_iterator<char>(file),{}};
    Simulation migrated;migrated.contentAccess={true,true};migrated.immediate=false;
    auto result=migrated.restore(old);check(result && result.migrated && result.sourceSchema==21);
    check(migrated.serviceTableCount()==4 && migrated.guests.size()==2 && migrated.tableMask()==51);
    check(migrated.seats.claim(migrated.guests[0].id)->point==0 && migrated.seats.claim(migrated.guests[1].id)->point==1);
    check(migrated.guests[0].seatingPreference==0 && migrated.guests[0].visit && migrated.guests[0].remaining==120000);
    roundtrip(migrated);auto preserved=migrated.save();
    Simulation unavailable;check(unavailable.restore(preserved).error==cafe::LoadError::ExpansionUnavailable);

    Simulation seating;seating.contentAccess={true,true};check(cafe::startGardenWorkshop(seating));
    check(seating.editGardenLayout(2,101,2,1,0) && seating.editGardenLayout(2,102,2,11,0));
    seating.closed=false;seating.immediate=false;
    check(seating.welcome(0,0,-1,false,1));auto first=seating.guests[0].id;auto token=seating.seats.claim(first)->token;
    check(seating.seats.claim(first)->point==4);
    check(seating.welcome(0,0,-1,false,0) && seating.seats.claim(seating.guests[1].id)->point==0);
    check(seating.welcome(2,0) && seating.seats.claim(seating.guests[2].id)->point==5);
    check(seating.welcome(2,0) && seating.seats.claim(seating.guests[3].id)->point==1); // fallback
    check(seating.seats.claim(first)->token==token); // no invalidation of other arrivals
    check(seating.welcome(0) && seating.welcome(2));
    auto older=seating.guests[4].id,later=seating.guests[5].id;
    check(seating.seats.claim(older)->point==Simulation::Pool::waiting);
    seating.leave(first,true);check(seating.seats.claim(older)->point==4);
    check(seating.seats.claim(later)->point==Simulation::Pool::waiting);roundtrip(seating);
    auto bad=seating.save(),before=bad;
    // Invalid preference cannot replace the live session.
    std::size_t preferenceAt=88+seating.runtime->save().size()+Simulation::equipmentSaveBytes+8+3*8+4*8;
    bad[preferenceAt]=2;check(!seating.load(bad) && seating.save()==before);

    Simulation cap{100,20000};establishAppealingCafe(cap);cap.toggleClosed();cap.contentAccess={true,true};
    check(cap.selectGarden() && cap.openCourtyard());
    check(cap.editGardenLayout(2,101,2,1,0) && cap.editGardenLayout(2,102,2,11,0));
    cap.toggleClosed();cap.immediate=false;
    for(int i=0;i<200;++i){cap.demandArrival();check(cap.guests.size()<=9 && cap.waitingForTable()<=2 && cap.queue.claims().size()<=3);}
    check(cap.serviceTableCount()==6 && cap.guests.size()==9);roundtrip(cap);
    write(output,"bounded.save",cap.save());

    Simulation game;game.contentAccess={true,true};game.immediate=false;
    check(game.startCampaign(123));game.automaticGuests=false;
    check(game.selectGarden() && game.openCourtyard());
    check(game.editGardenLayout(2,101,2,1,0) && game.editGardenLayout(2,102,2,11,0));
    check(game.hire() && game.hire() && game.crew.size()==3 && game.openDay());game.automaticGuests=false;game.advance(61);populate(game);
    const auto opening=game.save();write(output,"opening.save",opening);
    auto initial=game.save();check(!game.editGardenLayout(1,101,0,0,0) && game.save()==initial);
    bool taking=false,delivery=false,ready=false,dining=false,cleaning=false,broke=false,resumed=false;
    int concurrent=0;
    for(int tick=0;tick<2400 && !game.summary();++tick) {
        for(const auto& guest:game.guests) {
            if(guest.visit && game.tableDestination(guest).starts_with("Outdoor")) {
                auto task=game.tasks->task(guest.visit);
                if(task->state==sim::TaskState::Assigned) {
                    if(task->spec.key=="cafe:take-order" && !taking){taking=true;roundtrip(game);break;}
                    if(task->spec.key=="cafe:deliver" && !delivery){delivery=true;roundtrip(game);break;}
                }
            }
            if(guest.prepared && !ready){ready=true;roundtrip(game);break;}
            if(guest.rating==1 && guest.phase==Simulation::GuestPhase::Dining && !dining){dining=true;roundtrip(game);break;}
            if(guest.cleanup && game.tableDestination(guest).starts_with("Outdoor") && !cleaning){cleaning=true;roundtrip(game);break;}
        }
        if(delivery && !broke){check(game.staffBreak(game.crew.back().id));broke=true;}
        if(broke && !resumed && tick%10==0 && !game.onShift(game.crew.back().id)){check(game.staffBreak(game.crew.back().id));resumed=true;}
        std::vector<sim::CustomerId> departures;
        for(const auto& guest:game.guests) {
            if(guest.phase==Simulation::GuestPhase::Leaving)departures.push_back(guest.id);
            if(guest.phase==Simulation::GuestPhase::ToSeat){auto claim=game.seats.claim(guest.id);if(claim && claim->point!=Simulation::Pool::waiting)game.seated(guest.id,claim->point,claim->token);}
        }
        for(auto id:departures)game.departed(id);
        for(const auto& guest:game.guests)if(!guest.rating && guest.phase==Simulation::GuestPhase::Dining) {
            if(!guest.orderTaken && !guest.visit)game.collectOrder(guest.id);
            else if(guest.prepared && !guest.visit)game.requestServing(guest.id);
            else if(guest.orderTaken && !guest.prepared && !guest.visit && !game.active())game.prepareGuest(guest.id);
        }
        game.workflowTick();
        for(const auto& guest:game.guests)if(guest.visit && game.tableDestination(guest).starts_with("Outdoor")) {
            auto task=game.tasks->task(guest.visit);
            if(task->state==sim::TaskState::Assigned && ((!taking && task->spec.key=="cafe:take-order") || (!delivery && task->spec.key=="cafe:deliver"))) {
                if(task->spec.key=="cafe:take-order")taking=true;else delivery=true;
                roundtrip(game);break;
            }
        }
        int working=0;
        for(const auto& worker:game.crew)if(auto task=game.tasks->current(worker.id)) {
            ++working;
            if(task->state==sim::TaskState::Assigned)Simulation::require(game.tasks->start(task->id,worker.id,task->token));
        }
        concurrent=std::max(concurrent,working);
        for(auto id:game.productionJobs()){auto job=game.runtime->job(id).value;if(job.state==sim::JobState::Assigned)Simulation::require(game.runtime->arrive(id,job.assignment));}
        if(game.served==4 && game.campaign.phase==Simulation::DayPhase::Open)check(game.closeDay());
        game.advance(.1);
    }
    if(!(taking && delivery && ready && dining && cleaning && broke && resumed && concurrent==3))
        std::cerr<<"Stages "<<taking<<delivery<<ready<<dining<<cleaning<<broke<<resumed<<" staff "<<concurrent<<" served "<<game.served<<" summary "<<game.summary()<<'\n';
    check(taking && delivery && ready && dining && cleaning && broke && resumed && concurrent==3);
    check(game.summary() && game.guests.empty() && game.tasks->tasks().empty() && game.seats.claims().empty());
    check(game.served==4 && game.lastPaid==4 && game.credited("cafe:sales")==1700 && game.ledger->sequence("cafe:sales")==4);
    check(game.debited("cafe:wages")>=300 && game.debited("cafe:wages")==game.expectedWages() && game.debited("cafe:overhead")==500);
    roundtrip(game);const auto summary=game.save();game.advance(5);check(game.save()==summary);
    check(game.restartDay() && game.courtyardOpen() && game.crew.size()==3 && game.guests.empty() && game.served==0);
    check(game.openDay());game.automaticGuests=false;game.advance(61);populate(game);check(game.save()==opening);
    std::cout<<"{\"policy\":\"garden-service-zero-travel-100ms\",\"served\":4,\"concurrentStaff\":"<<concurrent
             <<",\"openingHash\":\""<<sim::checkpointHash(opening)<<"\",\"summaryHash\":\""<<sim::checkpointHash(summary)<<"\"}\n";
}catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}}
