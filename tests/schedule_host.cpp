#include "simulation.hpp"
#include <filesystem>
#include <fstream>
#include <iostream>
int main(int argc,char** argv) {
    try {
        if(argc!=2)throw std::runtime_error("Expected fixture output directory");
        std::filesystem::create_directories(argv[1]);
        auto write=[&](const char* name,cafe::Simulation& game){auto bytes=game.save();std::ofstream file(std::filesystem::path(argv[1])/(std::string(name)+".bin"),std::ios::binary);file.write(reinterpret_cast<const char*>(bytes.data()),bytes.size());if(!file)throw std::runtime_error("Fixture write failed");};
        cafe::Simulation sandbox{100,1000000};sandbox.advance(239.9);write("morning",sandbox);
        sandbox.advance(.1);sandbox.nextPeriod();sandbox.advance(119.9);write("lunch",sandbox);
        sandbox.advance(.1);sandbox.nextPeriod();sandbox.advance(239.9);write("afternoon",sandbox);
        cafe::Simulation campaign;campaign.startCampaign(123);campaign.openDay();campaign.automaticGuests=false;campaign.automaticSupply=false;
        campaign.advance(239.9);write("campaign-morning",campaign);
        campaign.advance(.1);campaign.nextPeriod();campaign.advance(120);campaign.nextPeriod();campaign.advance(239.9);write("campaign-afternoon",campaign);
        cafe::Simulation pause{100,1000000};pause.advance(120);write("pause",pause);
        std::cout<<"Schedule fixtures ready\n";
    }catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
