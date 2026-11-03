#include "balance.hpp"
#include <fstream>
#include <iostream>
int main(int argc,char** argv) {
    try {
        cafe::Simulation game;if(!game.startCampaign(123))throw std::runtime_error("Campaign start failed");
        auto write=[&](const char* phase){if(argc!=2)return;auto bytes=game.save();std::ofstream f(std::string(argv[1])+"/campaign-"+phase+".save",std::ios::binary);f.write(reinterpret_cast<const char*>(bytes.data()),bytes.size());if(!f)throw std::runtime_error("Evidence write failed");};
        std::string out="{\"policy\":\"campaign-v1-zero-travel-100ms\",\"days\":[";
        for(int day=1;day<=3;++day) {
            if(!game.openDay())throw std::runtime_error("Open failed");bool service=false,closing=false;
            for(int tick=0;tick<9000 && !game.summary();++tick) {
                cafe::referenceDecisions(game);game.advance(.1);
                auto elapsed=game.runtime->time()-game.campaign.openedAt;
                if(day==1 && !service && elapsed>=590000){write("service");service=true;}
                if(day==1 && !closing && game.campaign.phase==cafe::Simulation::DayPhase::Closing){write("closing");closing=true;}
            }
            if(!game.summary() || game.campaign.goals!=15 || game.overheadDue() || game.wagesDue())throw std::runtime_error("Incomplete campaign day");
            auto bytes=game.save();if(!game.load(bytes) || bytes!=game.save())throw std::runtime_error("Campaign replay diverged");
            if(day>1)out+=",";out+=cafe::campaignView(game);
            if(day==1)write("summary");
            if(day<3 && !game.nextDay())throw std::runtime_error("Transition failed");
        }
        out+="],\"hash\":\""+std::to_string(cafe::sim::checkpointHash(game.save()))+"\"}";std::cout<<out<<'\n';
    } catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
