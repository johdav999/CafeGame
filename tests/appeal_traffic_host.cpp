#include "simulation.hpp"
#include <filesystem>
#include <fstream>
#include <iostream>
int main(int argc,char** argv) {
    if(argc!=2)return 2;
    cafe::Simulation game{100,20000};
    for(int n=0;n<6;++n){
        if(!game.welcome(0,4) || !game.prepare(4))return 3;
        game.advance(.5);if(!game.serve())return 4;
        auto id=game.guests.back().id;game.leave(id,true);game.departed(id);
    }
    if(game.attractiveness().total!=63 || game.tableCount()!=2)return 5;
    game.automaticGuests=true;
    auto data=game.save();cafe::Simulation restored;
    if(!restored.load(data) || restored.save()!=data)return 6;
    std::filesystem::create_directories(argv[1]);
    std::ofstream out(std::filesystem::path(argv[1])/"appeal-63.bin",std::ios::binary);
    out.write(reinterpret_cast<const char*>(data.data()),std::streamsize(data.size()));
    std::cout<<"63 appeal, two tables, no guests; automatic arrivals enabled\n";
    return out?0:7;
}
