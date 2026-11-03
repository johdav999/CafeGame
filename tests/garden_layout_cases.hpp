#pragma once
#include "scenarios.hpp"
#include <source_location>
inline std::vector<std::uint8_t> gardenLayoutChecks() {
    auto check=[](bool ok,std::source_location at=std::source_location::current()){
        if(!ok)throw std::runtime_error("Garden layout line "+std::to_string(at.line()));
    };
    cafe::Simulation unavailable;
    check(!cafe::startGardenWorkshop(unavailable));
    cafe::Simulation game;game.contentAccess={true,true};
    check(cafe::startGardenWorkshop(game) && game.courtyardOpen() && game.layoutEditable());
    check(game.arrangeTablesForExpansion());
    auto full=game.fourTablePlan();check(bool(full));
    for(auto p:*full)if(p.id==3 || p.id==4)check(game.editLayout(2,int(p.id),p.x,p.z,p.rotation));
    check(game.tableCount()==4);
    const auto cash=game.wallet;
    check(game.editGardenLayout(2,101,2,1,0));
    check(game.editGardenLayout(2,102,2,11,0));
    check(game.combinedTableCount()==6 && game.wallet==cash-1200);
    const auto six=game.save();
    check(!game.editGardenLayout(2,103,0,0,0) && game.save()==six);
    check(!game.editLayout(2,5,0,0,0) && game.save()==six);
    check(!game.editGardenLayout(0,101,10,1,0) && game.save()==six);
    check(!game.editGardenLayout(0,102,2,1,0) && game.save()==six);
    check(!game.editGardenLayout(0,101,0,4,0) && game.save()==six); // doorway
    for(int r=0;r<4;++r)check(game.editGardenLayout(0,101,2,1,r) && game.wallet==cash-1200);
    check(game.editGardenLayout(0,101,2,1,0));
    cafe::Simulation loaded;loaded.contentAccess={true,true};
    check(loaded.load(game.save()) && loaded.save()==game.save());
    check(loaded.gardenLayout.placements().size()==2 && loaded.validGardenConnection(loaded.layout));
    // A detached placement that covers the indoor doorway must fail, too.
    check(!loaded.equipmentChange(0,3,23,8) && loaded.save()==game.save());
    const auto saved=loaded.save();
    auto corrupt=saved;const auto start=corrupt.size()-cafe::compatibilitySaveBytes-cafe::garden::saveBytes;
    corrupt[start+32+8]=0;corrupt[start+32+16]=4; // outdoor table covers doorway
    check(!loaded.load(corrupt) && loaded.save()==saved);
    corrupt=saved;corrupt[start+96]=0; // buy counter cannot disagree with ledger
    check(!loaded.load(corrupt) && loaded.save()==saved);
    check(loaded.editGardenLayout(1,101,0,0,0) && loaded.wallet==cash-900);
    check(!loaded.editGardenLayout(1,101,0,0,0) && loaded.wallet==cash-900);
    check(loaded.load(saved) && loaded.wallet==cash-1200);
    loaded.closed=false;const auto busy=loaded.save();
    check(!loaded.editGardenLayout(1,101,0,0,0) && loaded.save()==busy);
    cafe::Simulation poor{4,0};poor.contentAccess={true,true};poor.closed=true;
    check(poor.selectGarden() && poor.openCourtyard());const auto empty=poor.save();
    check(!poor.editGardenLayout(2,101,2,1,0) && poor.save()==empty);
    // Garden metadata must survive opening, checkpoint validation and restart.
    cafe::Simulation campaign;campaign.contentAccess={true,true};
    check(campaign.startCampaign() && campaign.selectGarden() && campaign.openCourtyard());
    check(campaign.editGardenLayout(2,101,2,1,0) && campaign.openDay());
    const auto opening=campaign.save();check(campaign.load(opening) && campaign.restartDay());
    check(campaign.courtyardOpen() && campaign.gardenBuys==1 && campaign.gardenLayout.find(101).has_value());
    return six;
}
