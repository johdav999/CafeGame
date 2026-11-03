#pragma once
inline void cafeEconomyChecks() {
    using namespace engine::simulator;
    auto check=[](bool ok,std::source_location at=std::source_location::current()){if(!ok)throw std::runtime_error("Cafe economy line "+std::to_string(at.line()));};
    cafe::Simulation full{4,1000000000};check(full.brew());full.advance(3);auto unchanged=full.save();
    check(!full.serve() && full.save()==unchanged && full.ready);
    cafe::Simulation game{4,5000};check(game.wallet==5000 && game.profit()==0);
    check(game.orderBeans() && game.wallet==3800 && game.pendingSupplyCost==1200);auto saved=game.save();
    check(!game.orderBeans() && game.wallet==3800);
    auto corrupt=saved;std::size_t economyLength=0;game.saveEconomy([&](std::uint64_t){economyLength+=8;});
    auto word=[](auto& bytes,std::size_t offset,std::uint64_t value){for(int i=0;i<8;++i)bytes[offset+i]=std::uint8_t(value>>(i*8));};
    word(corrupt,corrupt.size()-cafe::compatibilitySaveBytes-cafe::garden::saveBytes-cafe::Simulation::gardenStorySaveBytes-8-game.scheduleSaveBytes-game.journalSaveBytes-economyLength-(game.qualitySaveBytes+(game.layoutSaveBytes+game.demandSaveBytes()+game.menuSaveBytes()))+16,1100);check(!game.load(corrupt) && game.save()==saved);
    check(game.cancelSupply() && game.wallet==5000 && game.credited("cafe:refunds")==1200);
    check(!game.cancelSupply() && game.wallet==5000);
    check(game.load(saved) && game.wallet==3800);check(game.cancelSupply() && game.wallet==5000);
    // A failed capacity reservation cannot charge a prepared purchase.
    check(bool(game.runtime->add(game.storage,std::array{Amount{game.beans,24}})));auto before=game.save();
    check(!game.orderBeans() && game.save()==before && game.wallet==5000);
    cafe::Simulation poor{4,100};before=poor.save();check(!poor.orderBeans() && poor.save()==before);
    poor.automaticSupply=true;poor.advance(8);check(!poor.incomingSupply() && poor.wallet==100);
    check(poor.welcome(1) && poor.brew());poor.advance(3);check(poor.serve() && poor.wallet==600);
    check(poor.welcome(1) && poor.brew());poor.advance(3);check(poor.serve() && poor.wallet==1100);
    check(poor.welcome(1) && poor.brew());poor.advance(3);check(poor.serve() && poor.wallet==1600);
    poor.advance(0);check(poor.incomingSupply() && poor.wallet==400);
    cafe::Simulation staffBreak{4,5000};staffBreak.takeBreak();check(staffBreak.brew());staffBreak.advance(60);
    check(!staffBreak.ready && staffBreak.staffedMs==0 && staffBreak.wallet==5000);
    staffBreak.takeBreak();staffBreak.advance(3);check(staffBreak.ready && staffBreak.serve() && staffBreak.wallet==5500);
    cafe::Simulation wages{4,5000};wages.advance(59.999);check(wages.wallet==5000 && wages.staffedMs==59999);
    auto checkpoint=wages.save();cafe::Simulation loaded;check(loaded.load(checkpoint));loaded.advance(.001);
    check(loaded.wallet==4900 && loaded.debited("cafe:wages")==100 && loaded.wagesDue()==0);
    auto paid=loaded.save();economyLength=0;loaded.saveEconomy([&](std::uint64_t){economyLength+=8;});
    corrupt=paid;word(corrupt,corrupt.size()-cafe::compatibilitySaveBytes-cafe::garden::saveBytes-cafe::Simulation::gardenStorySaveBytes-8-game.scheduleSaveBytes-game.journalSaveBytes-economyLength-(game.qualitySaveBytes+(game.layoutSaveBytes+game.demandSaveBytes()+game.menuSaveBytes()))+8,0);check(!loaded.load(corrupt) && loaded.save()==paid);
    check(loaded.load(paid) && loaded.wallet==4900);loaded.advance(0);check(loaded.wallet==4900);
    loaded.takeBreak();loaded.advance(120);check(loaded.wallet==4900 && loaded.staffedMs==60000);
    auto onBreak=loaded.save();check(loaded.load(onBreak));loaded.takeBreak();loaded.advance(60);check(loaded.wallet==4800);
    cafe::Simulation debt{4,0};debt.advance(120);check(debt.wagesDue()==200 && debt.wallet==0 && debt.availableCash()==0);
    auto owing=debt.save();check(loaded.load(owing) && loaded.wagesDue()==200);
    check(loaded.brew());loaded.advance(3);check(loaded.serve());
    check(loaded.wallet==300 && loaded.wagesDue()==0 && loaded.debited("cafe:wages")==200);
    // Equal staffed time has equal pay across elapsed-time partitions.
    cafe::Simulation whole{4,5000},split{4,5000};whole.advance(180);for(int i=0;i<180;++i)split.advance(1);
    check(whole.wallet==split.wallet && whole.staffedMs==split.staffedMs && whole.wallet==4700);
    auto bytes=whole.save();auto bad=bytes;bad[24]^=1;before=whole.save();check(!whole.load(bad) && whole.save()==before);
    bad=bytes;bad.pop_back();check(!whole.load(bad) && whole.save()==before);
    // Changed content is rejected rather than assigning new prices to old shifts.
    auto prior=legacySave(whole);before=loaded.save();check(!loaded.load(prior) && loaded.save()==before);
}
