#include "balance.hpp"
#include <iostream>
int main() {
    try {
        cafe::Simulation g;if(!cafe::startScenario(g,cafe::scenarios[4]))throw std::runtime_error("Workshop failed");
        if(!g.editLayout(0,1,0,10,0) || !g.editLayout(0,2,6,10,0) || !g.editLayout(2,3,12,10,0) || !g.editLayout(2,4,18,10,0))throw std::runtime_error("Four tables failed");
        for(int n=0;n<7;++n){const auto& item=cafe::Simulation::buildItems[std::size_t(n)];if(!g.equipmentChange(0,n,item.x,item.z))throw std::runtime_error("Installation failed");}
        if(!g.hire() || !g.hire())throw std::runtime_error("Hiring failed");g.toggleClosed();g.automaticGuests=true;g.automaticSupply=true;
        std::size_t peakBytes=0;
        for(int tick=0;tick<6000;++tick) {
            cafe::referenceDecisions(g);g.advance(.1);
            if(tick%997==0){auto bytes=g.save();peakBytes=std::max(peakBytes,bytes.size());if(!g.load(bytes) || g.save()!=bytes)throw std::runtime_error("Upgraded replay diverged");}
            auto m=g.runtime->metrics();if(m.jobs>8 || m.customers>8 || m.orders>8 || g.tasks->tasks().size()>32 || peakBytes>131072)throw std::runtime_error("Retained state bound exceeded");
        }
        if(g.served<10 || g.tableCount()!=4 || !g.fastMachine || !g.extraStation || g.storedBeans().capacity!=48)throw std::runtime_error("Upgraded service failed");
        auto out=cafe::shiftReport(g);out.pop_back();out+=",\"policy\":\"equipment-v1-zero-travel-100ms\",\"peakSaveBytes\":"+std::to_string(peakBytes)+",\"hash\":\""+std::to_string(cafe::sim::checkpointHash(g.save()))+"\"}";std::cout<<out<<'\n';
    } catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
