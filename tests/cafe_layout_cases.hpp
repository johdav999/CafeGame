#pragma once
inline void cafeLayoutChecks() {
    auto check=[](bool ok,std::source_location at=std::source_location::current()){if(!ok)throw std::runtime_error("Cafe layout line "+std::to_string(at.line()));};
    cafe::Simulation game{4,5000};auto original=game.save();
    check(!game.editLayout(0,1,4,10,0) && game.save()==original);
    game.toggleClosed();check(game.layoutEditable() && !game.brew() && !game.welcome());
    auto unchanged=game.save();check(!game.editLayout(0,1,16,9,0) && game.save()==unchanged);
    check(!game.editLayout(0,1,22,19,0) && game.save()==unchanged);
    check(game.editLayout(0,1,3,10,0) && game.layout.find(1)->x==3);
    check(game.editLayout(0,1,2,10,1));auto moved=game.save();cafe::Simulation loaded;
    check(loaded.load(moved) && loaded.save()==moved && loaded.closed && loaded.layout.find(1)->rotation==1);
    check(loaded.editLayout(1,1,0,0,0) && loaded.wallet==5300);auto sold=loaded.save();
    check(!loaded.editLayout(1,1,0,0,0) && loaded.save()==sold && loaded.wallet==5300);
    check(loaded.load(sold) && loaded.wallet==5300 && !loaded.layout.find(1));
    check(loaded.editLayout(2,1,4,9,0) && loaded.wallet==4700);
    check(!loaded.editLayout(2,1,4,9,0) && loaded.wallet==4700);
    loaded.toggleClosed();check(loaded.brew());loaded.advance(3);check(loaded.serve());
    auto seat=loaded.seats.claim(loaded.customer);check(seat && seat->point==0);
    loaded.toggleClosed();check(!loaded.layoutEditable());loaded.advance(cafe::Simulation::diningDuration({0,-1})/1000.0);loaded.departed(loaded.customer);check(loaded.layoutEditable());
    check(loaded.editLayout(1,1,0,0,0));loaded.toggleClosed();check(loaded.brew());loaded.advance(3);check(loaded.serve());
    seat=loaded.seats.claim(loaded.customer);check(seat && seat->point==1);auto oneSeat=loaded.save();check(loaded.load(oneSeat));
    auto absent=oneSeat;auto layoutEnd=oneSeat.size()-loaded.demandSaveBytes()-loaded.menuSaveBytes()-loaded.scheduleSaveBytes-loaded.journalSaveBytes-cafe::garden::saveBytes-cafe::Simulation::gardenStorySaveBytes-cafe::compatibilitySaveBytes-8;auto table2=layoutEnd-loaded.layoutSaveBytes+40;for(std::size_t i=table2;i<table2+32;++i)absent[i]=0;
    auto preserved=loaded.save();check(!loaded.load(absent) && loaded.save()==preserved);
    auto broken=oneSeat;broken[layoutEnd-8]=3;auto live=loaded.save();check(!loaded.load(broken) && loaded.save()==live);
    loaded.toggleClosed();loaded.advance(cafe::Simulation::diningDuration({0,-1})/1000.0);loaded.departed(loaded.customer);check(loaded.layoutEditable());
    check(loaded.editLayout(1,2,0,0,0));auto empty=loaded.save();check(loaded.load(empty) && loaded.layout.placements().empty());
    loaded.toggleClosed();check(loaded.welcome(1) && loaded.brew());loaded.advance(3);check(loaded.serve() && loaded.seats.claims().empty());
    cafe::Simulation poor{4,0};poor.toggleClosed();check(poor.editLayout(1,1,0,0,0));auto before=poor.save();
    check(!poor.editLayout(2,1,4,9,0) && poor.save()==before && poor.wallet==300);
    cafe::Simulation rich{4,1000000000};rich.toggleClosed();auto richBefore=rich.save();
    check(!rich.editLayout(1,1,0,0,0) && rich.save()==richBefore && rich.layout.placements().size()==2);
    auto oldFurniture=legacyBytes(empty);oldFurniture.resize(oldFurniture.size()-loaded.layoutSaveBytes-(18+0*7)*8);oldFurniture[8]=6;
    check(!loaded.load(oldFurniture));
    cafe::Simulation closing;check(closing.welcome() && closing.welcome() && closing.brew());closing.toggleClosed();
    check(closing.active() && closing.queue.claims().empty() && !closing.layoutEditable());auto during=closing.save();check(closing.load(during));
    closing.advance(3);check(closing.serve());
    // Unsupported pre-menu content never replaces the live layout.
    auto prior=legacySave(closing);auto keep=loaded.save();check(!loaded.load(prior) && loaded.save()==keep);
}
