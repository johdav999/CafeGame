#include "balance.hpp"
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <source_location>
using cafe::Simulation;
namespace sim=cafe::sim;
void check(bool ok,std::source_location at=std::source_location::current()){if(!ok)throw std::runtime_error("Garden story line "+std::to_string(at.line()));}
std::vector<std::uint8_t> read(const char* path){std::ifstream file(path,std::ios::binary);check(bool(file));return {std::istreambuf_iterator<char>(file),{}};}
void write(const char* directory,const char* name,const std::vector<std::uint8_t>& bytes){if(!directory)return;std::filesystem::create_directories(directory);std::ofstream out(std::filesystem::path(directory)/name,std::ios::binary);out.write(reinterpret_cast<const char*>(bytes.data()),std::streamsize(bytes.size()));check(bool(out));}
void roundtrip(Simulation& g,std::source_location at=std::source_location::current()){auto bytes=g.save();check(g.load(bytes)&&g.save()==bytes,at);}
// A reproducible zero-travel service policy; rendered tests use scene arrival.
void step(Simulation& g,bool manage=true){
    std::vector<std::uint64_t> ids;for(const auto& guest:g.guests)ids.push_back(guest.id.value);
    for(auto value:ids){auto it=std::find_if(g.guests.begin(),g.guests.end(),[&](const auto& x){return x.id.value==value;});if(it==g.guests.end())continue;auto id=it->id;
        if(it->phase==Simulation::GuestPhase::ToSeat){auto seat=g.seats.claim(id);if(seat&&seat->point!=Simulation::Pool::waiting)g.seated(id,seat->point,seat->token);}
        auto* guest=g.guest(id);
        if(!guest->rating&&guest->tableService&&guest->phase==Simulation::GuestPhase::Dining&&!guest->visit){if(!guest->orderTaken)g.collectOrder(id);else if(guest->prepared)g.requestServing(id);else if(!g.active())g.prepareGuest(id);}
    }
    if(manage)cafe::referenceDecisions(g);
    else {std::vector<sim::CustomerId> gone;for(const auto& guest:g.guests)if(guest.phase==Simulation::GuestPhase::Leaving)gone.push_back(guest.id);for(auto id:gone)g.departed(id);}
    g.workflowTick();for(const auto& w:g.crew)if(auto t=g.tasks->current(w.id);t&&t->state==sim::TaskState::Assigned)Simulation::require(g.tasks->start(t->id,w.id,t->token));
    for(auto id:g.productionJobs()){auto j=g.runtime->job(id).value;if(j.state==sim::JobState::Assigned)Simulation::require(g.runtime->arrive(id,j.assignment));}
    g.advance(.1);
}
void drained(Simulation& g){for(int n=0;n<2000 && (!g.guests.empty()||g.active()||!g.tasks->tasks().empty()||g.incomingSupply());++n)step(g);check(g.guests.empty()&&!g.active()&&g.tasks->tasks().empty()&&!g.incomingSupply());}
void close(Simulation& g){check(g.closeDay());for(int n=0;n<2000&&!g.summary();++n)step(g);check(g.summary());roundtrip(g);}
void ticket(Simulation& g,int first,int second=-1,int profile=1,int seating=-1){auto target=g.served+1;check(g.welcome(profile,first,second,false,seating));for(int n=0;n<1800&&g.served<target;++n)step(g);check(g.served==target);drained(g);}
void supply(Simulation& g,int n,sim::Quantity target){for(int pass=0;pass<20 && g.runtime->stock(g.inventory,g.ingredient(n)).value.available()<target;++pass){
    if(g.storedIngredient(n).available())g.restockIngredient(n);else if(!g.incomingSupply())check(g.purchaseIngredient(n));
    for(int i=0;i<100&&(g.incomingSupply()||g.restockWork[std::size_t(n)]);++i)step(g,false);
}check(g.runtime->stock(g.inventory,g.ingredient(n)).value.available()>=target);}
void prepareParty(Simulation& g){
    drained(g);for(auto [n,count]:std::array<std::pair<int,int>,5>{{{0,6},{1,6},{5,6},{6,3},{7,3}}})supply(g,n,count);
    if(g.machineCondition.snapshot().integrity<600){check(g.requestMaintenance(Simulation::Maintenance::Repair));drained(g);}
    if(g.machineCondition.snapshot().cleanliness<600){check(g.requestMaintenance(Simulation::Maintenance::Clean));drained(g);}
    if(g.crew.size()<2)check(g.hire());check(g.gardenPartyReason().empty());check(g.prepareGardenParty());roundtrip(g);
    const auto worker=g.crew.back().id;check(g.staffBreak(worker));const auto before=g.save();
    check(!g.openDay()&&g.save()==before&&cafe::gardenStoryView(g).find("Resume two staff")!=std::string::npos);
    check(g.staffBreak(worker));roundtrip(g);
}
int main(int argc,char** argv){try{
    // Replay an already drained browser party through its ordinary idle clock.
    // This never authors a late-game state or bypasses a service objective.
    if(argc==4&&std::string_view(argv[1])=="--finish-idle-party"){
        Simulation played;played.contentAccess={true,true};check(played.load(read(argv[2])));
        check(played.gardenStory.party==Simulation::GardenParty::Running&&played.guests.empty()&&played.tasks->tasks().empty()&&!played.active()&&!played.incomingSupply()&&!played.automaticGuests&&!played.automaticSupply);
        for(int n=0;n<9000&&!played.summary();++n){if(played.intermission())check(played.nextPeriod());played.advance(.1);}
        check(played.summary()&&played.gardenStory.party==Simulation::GardenParty::Complete);
        auto bytes=played.save();std::ofstream out(argv[3],std::ios::binary);out.write(reinterpret_cast<const char*>(bytes.data()),std::streamsize(bytes.size()));check(bool(out));
        std::cout<<"{\"playedPartyHash\":\""<<sim::checkpointHash(bytes)<<"\",\"cash\":"<<played.wallet<<"}\n";return 0;
    }
    const char* output=argc==2?argv[1]:nullptr;
    // A real G4 campaign carries paid service, equipment and opening bytes.
    Simulation g4;g4.contentAccess={true,true};auto result=g4.restore(read(GARDEN_G4_FIXTURE));check(result&&result.migrated&&result.sourceSchema==23&&!g4.gardenStory.started);
    check(g4.credited("cafe:sales")==5100&&g4.coldStation&&g4.campaign.goals&3);roundtrip(g4);check(g4.restartDay());
    auto money=g4.wallet;auto baseHistory=g4.campaign.regulars[0].visits;check(g4.startGardenRestoration());check(g4.wallet==money+1000&&g4.campaign.regulars[0].visits==baseHistory&&g4.gardenStory.chapters==1);roundtrip(g4);
    auto before=g4.save();check(!g4.startGardenRestoration()&&g4.save()==before);Simulation unavailable;check(unavailable.restore(before).error==cafe::LoadError::ExpansionUnavailable);
    // Complete the story from an actual migrated base campaign, earning every
    // purchase through normal tickets, supplies, wages and chapter receipts.
    Simulation game;game.contentAccess={true,true};result=game.restore(read(GARDEN_BASE_FIXTURE));check(result&&result.migrated&&!game.gardenState.selected);check(game.restartDay());game.immediate=true;
    check(!game.startGardenRestoration()&&!game.setFinish(3));check(game.openDay());game.automaticGuests=false;game.automaticSupply=false;
    for(int n=0;n<6;++n)ticket(game,0,4);
    // Preserve actual base named-regular history as well as goals and cash.
    for(int n=0;n<8 && std::none_of(game.campaign.regulars.begin(),game.campaign.regulars.end(),[](const auto& r){return r.visits>0;});++n){game.demandArrival();for(int t=0;t<1200&&!game.guests.empty();++t)step(game);drained(game);}
    close(game);check(game.nextDay());auto day=game.campaign.day,goals=game.campaign.goals;const auto originalRegulars=game.campaign.regulars;money=game.wallet;
    game.immediate=false;write(output,"eligible-base.save",game.save());game.immediate=true;check(game.startGardenRestoration()&&game.campaign.day==day&&game.campaign.goals==goals&&game.wallet==money);
    for(std::size_t n=0;n<3;++n)check(game.campaign.regulars[n].visits==originalRegulars[n].visits&&game.campaign.regulars[n].reviews==originalRegulars[n].reviews);
    check(game.openCourtyard());game.gardenStoryTick();check(game.gardenStory.chapters==1&&game.wallet==money+1000&&!game.unlocked(7));roundtrip(game);
    check(game.editGardenLayout(2,101,2,1,0));check(game.openDay());game.automaticGuests=false;game.automaticSupply=false;ticket(game,0,-1,0,1);
    check(game.gardenStory.chapters==3&&game.credited("garden:chapters")==2000&&game.unlocked(7));close(game);check(game.nextDay());drained(game);
    check(game.equipmentChange(0,7,14,0,0));for(int n=5;n<8;++n)supply(game,n,4);check(game.openDay());game.automaticGuests=false;
    for(int p=5;p<8;++p)ticket(game,p);check(game.gardenStory.chapters==7);roundtrip(game);
    for(int n=0;n<3;++n){check(game.inviteGardenRegular(n));roundtrip(game);for(int t=0;t<1800 && !(game.gardenStory.metMask&(1u<<n));++t)step(game);check(game.gardenStory.metMask&(1u<<n));drained(game);before=game.save();check(!game.inviteGardenRegular(n)&&game.save()==before);}
    check(game.gardenStory.chapters==15&&game.ledger->sequence("garden:chapters")==4);close(game);check(game.nextDay());check(game.setFinish(3));roundtrip(game);
    prepareParty(game);write(output,"party-prepared.save",game.save());check(game.openDay());game.automaticGuests=false;check(game.gardenStory.attempts==1);roundtrip(game);
    write(output,"party-opening.save",game.save());
    ticket(game,6);close(game);check(game.gardenStory.party==Simulation::GardenParty::Failed&&game.gardenStory.chapters==15);write(output,"party-failed.save",game.save());
    // Restart restores the exact prepared party, resources and attempt counter.
    check(game.restartDay()&&game.gardenStory.party==Simulation::GardenParty::Prepared&&game.gardenStory.attempts==0);roundtrip(game);
    check(game.openDay());game.automaticGuests=false;check(game.gardenStory.attempts==1);
    for(int n=0;n<9000&&!game.summary();++n)step(game);
    check(game.summary()&&game.gardenStory.party==Simulation::GardenParty::Failed&&game.gardenStory.fullParty&&game.gardenStory.partyServed==0);roundtrip(game);write(output,"party-failed-full.save",game.save());check(game.nextDay());
    prepareParty(game);check(game.openDay());game.automaticGuests=false;const auto opening=game.save();
    for(int n=0;n<6;++n)ticket(game,6);check(game.gardenStory.party==Simulation::GardenParty::Running);roundtrip(game);
    // A cancelled extra visit must not turn the optional flawless-shift goal
    // into a hidden party requirement. Only delivered visits set its average.
    check(game.welcome(1,6)&&game.prepare(6));game.advance(.1);check(game.cancel());drained(game);check(game.dayTotals()[9]==1);
    // Run the remaining NORMAL clock, including its explicit period breaks.
    bool late=false;for(int n=0;n<9000&&!game.summary();++n){if(!late&&game.schedule.elapsed>=598000){write(output,"party-late.save",game.save());late=true;}step(game);}
    check(game.summary()&&game.gardenStory.party==Simulation::GardenParty::Complete&&game.gardenStory.chapters==31&&game.gardenStory.attempts==2);
    check(game.credited("garden:chapters")==5000&&game.ledger->sequence("garden:chapters")==5&&game.gardenStory.partyScore>=650);roundtrip(game);
    const auto complete=game.save();write(output,"party-complete.save",complete);game.advance(100);check(game.save()==complete);game.gardenStoryTick();check(game.save()==complete);
    // Joint loader rejects corrupt progress without replacing live state.
    auto bad=complete;const auto storyAt=bad.size()-16-cafe::garden::saveBytes-Simulation::gardenStorySaveBytes;bad[storyAt+8]=30;check(!game.load(bad)&&game.save()==complete);
    check(game.restartDay()&&game.gardenStory.chapters==15&&game.credited("garden:chapters")==4000);check(game.openDay());game.automaticGuests=false;check(game.save()==opening);
    check(game.load(complete)&&game.nextDay()&&game.courtyardOpen()&&game.unlocked(5)&&game.gardenStory.chapters==31);check(!game.prepareGardenParty());roundtrip(game);
    std::cout<<"{\"policy\":\"garden-restoration-zero-travel-100ms\",\"day\":"<<game.campaign.day<<",\"chapters\":31,\"rewards\":5000,\"partyServed\":"<<game.gardenStory.partyServed<<",\"partyScore\":"<<game.gardenStory.partyScore<<",\"cash\":"<<game.wallet
        <<",\"openingCashMinor\":10000,\"salesMinor\":"<<game.credited("cafe:sales")<<",\"suppliesMinor\":"<<game.debited("cafe:purchases")-game.credited("cafe:refunds")<<",\"wagesMinor\":"<<game.debited("cafe:wages")
        <<",\"repairsMinor\":"<<game.debited("cafe:maintenance")<<",\"equipmentMinor\":"<<game.debited("cafe:upgrades")<<",\"tablesMinor\":"<<game.debited("garden:table-buys")<<",\"hiringMinor\":"<<game.debited("cafe:hires")<<",\"overheadMinor\":"<<game.debited("cafe:overhead")
        <<",\"baseRewardsMinor\":"<<game.credited("cafe:goals")<<",\"journalRewardsMinor\":"<<game.credited("cafe:daily")+game.credited("cafe:achievements")<<",\"openingHash\":\""<<sim::checkpointHash(opening)<<"\",\"completeHash\":\""<<sim::checkpointHash(complete)<<"\"}\n";
}catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}}
