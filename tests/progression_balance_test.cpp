#include "balance.hpp"
#include <source_location>
#include <filesystem>
#include <fstream>
#include <iostream>
using S=cafe::Simulation;
namespace sim=cafe::sim;
void check(bool ok,std::source_location at=std::source_location::current()){if(!ok)throw std::runtime_error("Progression line "+std::to_string(at.line()));}
void roundtrip(S& g){auto bytes=g.save();S loaded;loaded.immediate=g.immediate;check(loaded.load(bytes) && loaded.save()==bytes);check(g.load(bytes));}
int main(int argc,char** argv){try{

    // The common three-table arrangement fragments the remaining floor.
    {
        S room{100,20000};room.toggleClosed();check(room.editLayout(2,3,10,9,0));
        for(int key=3;key<7;++key){const auto& item=S::buildItems[key];check(room.equipmentChange(0,key,item.x,item.z));}
        bool space=false;for(int z=0;z<20;++z)for(int x=0;x<24;++x){auto trial=room.layout;space|=trial.place({4,x,z,4,8,0})==sim::LayoutError::None;}
        check(!space);
        if(argc==2){std::filesystem::create_directories(argv[1]);auto bytes=room.save();std::ofstream f(std::filesystem::path(argv[1])/"three-fragmented.bin",std::ios::binary);f.write(reinterpret_cast<const char*>(bytes.data()),bytes.size());check(bool(f));}
        auto cash=room.wallet;auto ledger=room.ledger->sequence("cafe:furniture-buys");
        auto inventory=room.runtime->save();std::vector<sim::Placement> decor;
        for(auto p:room.layout.placements())if(p.id>4)decor.push_back(p);
        check(room.editLayout(3,0,0,0,0) && room.tableCount()==3 && room.wallet==cash);
        check(room.ledger->sequence("cafe:furniture-buys")==ledger && room.runtime->save()==inventory);
        for(auto p:decor)check(room.layout.find(p.id)==p);
        auto plan=room.fourTablePlan();check(bool(plan));auto target=*std::find_if(plan->begin(),plan->end(),[](auto p){return p.id==4;});
        auto candidate=room.layout;check(candidate.place(target)==sim::LayoutError::None);
        roundtrip(room);check(room.editLayout(2,4,target.x,target.z,target.rotation) && room.tableCount()==4 && room.wallet==cash-600);roundtrip(room);
        auto stable=room.save();room.toggleClosed();check(!room.arrangeTablesForExpansion() && room.wallet==cash-600);room.toggleClosed();check(room.save()==stable);
        // A blocked plan is rejected atomically; user decor is never removed.
        S blocked{100,20000};blocked.toggleClosed();check(blocked.equipmentChange(0,3,12,12));
        auto before=blocked.save();check(!blocked.arrangeTablesForExpansion() && blocked.save()==before);
    }

    // A long table wait does not consume the fresh service allowance.
    S g;g.immediate=false;for(int n=0;n<3;++n)check(g.welcome(0));
    auto id=g.guests.back().id;check(g.seats.claim(id)->point==S::Pool::waiting);
    g.advance(119);check(!g.failedReviews && g.guestPatience(*g.guest(id))==61000);roundtrip(g);id=g.guests.back().id;
    auto first=g.guests.front().id;g.leave(first,true);g.departed(first);
    auto seat=g.seats.claim(id);check(seat && seat->point!=S::Pool::waiting);
    g.seated(id,seat->point,seat->token);check(g.guestPatience(*g.guest(id))==120000);
    check(g.serviceWait(*g.guest(id))==0);roundtrip(g);id=g.guests.back().id;
    g.advance(60);check(!g.guest(id)->rating && g.guestPatience(*g.guest(id))==60000);roundtrip(g);id=g.guests.back().id;
    g.advance(59.999);check(!g.guest(id)->rating);g.advance(.001);check(g.guest(id)->rating==2);
    S timeout;check(timeout.welcome());timeout.advance(179.999);check(!timeout.failedReviews);timeout.advance(.001);check(timeout.failedReviews==1);roundtrip(timeout);
    // Maximum appeal cannot exceed the two-table queue or counter allowance.
    S busy;busy.deliveredReviews=100;busy.totalSatisfaction=100000;busy.admitted=100;busy.served=100; // admission-only fixture
    for(int n=0;n<100;++n){busy.demandArrival();check(busy.waitingForTable()<=2 && busy.seats.claims().size()<=4 && busy.queue.claims().size()+busy.counter.claims().size()<=3);}
    check(busy.failedReviews==0);
    // Real paid sales unlock expansion at the first same-day break, despite a
    // failed visit. Optional care cannot block profit rewards or tea.
    S campaign;check(campaign.startCampaign(123) && campaign.openDay());campaign.automaticGuests=false;campaign.automaticSupply=false;
    check(campaign.welcome(1,0,4) && campaign.prepare(0));campaign.advance(6);check(campaign.serve());
    check(campaign.credited("cafe:sales")==850 && campaign.campaign.goals==3 && campaign.unlocked(3));
    check(campaign.extraTablesReason().empty());
    campaign.departed(campaign.guests.back().id);
    for(int n=0;n<5;++n){check(campaign.welcome(1,0,4) && campaign.prepare(0));campaign.advance(6);check(campaign.serve());campaign.departed(campaign.guests.back().id);}
    check(campaign.welcome(1));campaign.leave(campaign.guests.back().id);
    for(int n=0;n<3000 && !campaign.intermission();++n){cafe::referenceDecisions(campaign);campaign.advance(.1);}
    check(campaign.intermission() && campaign.clockMinutes()==720 && campaign.layoutEditable() && campaign.failedReviews==1);
    check(campaign.editLayout(3,0,0,0,0));
    check(campaign.editLayout(2,3,12,10,0) && campaign.tableCount()==3);
    roundtrip(campaign);
    auto write=[&](const char* name){if(argc!=2)return;std::filesystem::create_directories(argv[1]);auto bytes=campaign.save();std::ofstream f(std::filesystem::path(argv[1])/name,std::ios::binary);f.write(reinterpret_cast<const char*>(bytes.data()),bytes.size());check(bool(f));};
    write("morning-build.bin");
    auto clock=campaign.schedule.elapsed,wages=campaign.staffedMs;campaign.advance(30);check(campaign.schedule.elapsed==clock && campaign.staffedMs==wages);
    check(campaign.nextPeriod());campaign.advance(120);check(campaign.intermission() && campaign.clockMinutes()==840 && campaign.layoutEditable());
    check(campaign.editLayout(2,4,18,10,0));roundtrip(campaign);write("lunch-build.bin");
    check(campaign.nextPeriod());
    for(int n=0;n<4000 && !campaign.summary();++n){cafe::referenceDecisions(campaign);campaign.advance(.1);}
    check(campaign.summary() && !(campaign.campaign.goals&4) && (campaign.campaign.goals&8));
    check(campaign.credited("cafe:goals")==1500 && campaign.tableCount()==4);roundtrip(campaign);
    auto cash=campaign.wallet;campaign.campaignTick();check(campaign.wallet==cash);
    // The clean reward may be earned later, after the independent profit goal.
    check(campaign.nextDay() && campaign.openDay());campaign.automaticGuests=false;
    check(campaign.welcome(1,0) && campaign.brew());campaign.advance(3);check(campaign.serve());
    for(int n=0;n<9000 && !campaign.summary();++n){cafe::referenceDecisions(campaign);campaign.advance(.1);}
    check(campaign.summary() && campaign.campaign.goals==15 && campaign.credited("cafe:goals")==2000);roundtrip(campaign);
    std::cout<<"Progression, table/service patience, capacity, phase building and independent rewards passed\n";
}catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}}
