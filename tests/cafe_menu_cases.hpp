#pragma once
#include "balance.hpp"
#include "diagnostics.hpp"
#include <source_location>
inline void cafeMenuChecks() {
    using namespace cafe;using namespace engine::simulator;
    auto check=[](bool ok,std::source_location at=std::source_location::current()){if(!ok)throw std::runtime_error("Cafe menu line "+std::to_string(at.line()));};
    auto roundtrip=[&](Simulation& game){auto bytes=game.save();Simulation loaded;check(loaded.load(bytes) && loaded.save()==bytes);};
    // One bean is nonzero stock, but cannot supply two coffee items. The second
    // item's milk shortage must also remain visible for a seated table guest.
    {
        Simulation shortage{1,5000};shortage.immediate=false;
        check(shortage.ticketShortages({0,-1}).empty());
        check(shortage.ticketShortages({0,1})==std::vector<std::size_t>{0});
        auto milk=shortage.runtime->stock(shortage.inventory,shortage.ingredient(2)).value.available();
        check(bool(shortage.runtime->remove(shortage.inventory,std::array{Amount{shortage.ingredient(2),milk}})));
        check(shortage.welcome(0,0,2));auto id=shortage.guests.front().id;auto claim=shortage.seats.claim(id);
        check(bool(claim));shortage.seated(id,claim->point,claim->token);
        check(shortage.guests.front().phase==Simulation::GuestPhase::Dining);
        auto before=shortage.save();
        check(menuView(shortage).find("\"shortages\":[0,2]")!=std::string::npos);
        check(shortage.save()==before);
    }
    for(int p=0;p<5;++p) {
        Simulation game{20,5000};check(game.welcome(1,p));auto unchanged=game.save();
        check(!game.prepare((p+1)%5) && game.save()==unchanged);
        auto inputs=game.ticketInputs({p,-1});check(game.prepare(p));
        game.advance(.25);roundtrip(game);game.advance(10);check(game.ready);roundtrip(game);
        for(const auto& a:inputs)check(game.runtime->stock(game.inventory,a.resource).value.total==(a.resource==game.beans?20:12)-a.quantity);
        check(game.serve() && game.served==1 && game.credited("cafe:sales")==definitions::menu[std::size_t(p)].price);
        auto paid=game.save();check(!game.serve() && game.save()==paid);roundtrip(game);
        check(game.deliveredReviews==1 && game.runtime->stock(game.inventory,game.productResource(p)).value.total==0);
    }
    Simulation mixed{20,5000};check(mixed.welcome(1,2,4) && mixed.prepare(2));
    auto core=mixed.runtime->order(mixed.order).value;check(core.price==1050 && core.jobs.size()==2);
    mixed.advance(.5);check(!mixed.ready && mixed.items[1].madeAt==500 && mixed.items[0].madeAt==-1);roundtrip(mixed);
    check(!mixed.serve());mixed.advance(3);check(!mixed.ready && mixed.runtime->job(core.jobs[0]).value.state==JobState::Running);
    auto midway=mixed.save();Simulation restored;check(restored.load(midway));
    mixed.advance(2);restored.advance(2);check(mixed.ready && mixed.save()==restored.save());
    check(mixed.items[0].madeAt==5500 && mixed.machineCondition.snapshot().uses==1);
    check(mixed.serve() && mixed.wallet==6050 && mixed.deliveredReviews==1);roundtrip(mixed);
    // Two beverages consume separate shots, preserve ordered equipment access,
    // and give each completed item its own freshness and quality.
    Simulation pair{20,5000};check(pair.welcome(1,1,2) && pair.prepare(1));pair.advance(10);
    check(pair.ready && pair.machineCondition.snapshot().uses==2 && pair.stock==18);
    check(pair.items[0].quality==1000 && pair.items[1].quality==850);roundtrip(pair);
    check(pair.serve() && pair.credited("cafe:sales")==1300);
    // Expiry of a partial ticket discards every prepared item exactly once.
    Simulation expired{20,5000};check(expired.welcome(0,2,4) && expired.prepare(2));expired.advance(.5);
    expired.takeBreak();expired.advance(120);check(!expired.active() && expired.served==0 && expired.failedReviews==1);
    auto waste=expired.wasted;check(waste>=1 && !expired.serve());expired.advance(0);check(expired.wasted==waste);roundtrip(expired);
    Simulation cancel{20,5000};check(cancel.welcome(1,2,4) && cancel.prepare(2));cancel.advance(.5);
    check(cancel.cancel() && cancel.wasted==1 && cancel.served==0);check(!cancel.cancel());roundtrip(cancel);
    check(cancel.runtime->metrics().jobs==2); // Only the abandoned order's jobs.
    // All raw ingredients are checked before accepting the order.
    Simulation shortage{20,5000};check(shortage.welcome(0,2,4));
    check(bool(shortage.runtime->remove(shortage.inventory,std::array{Amount{shortage.ingredient(2),12}})));
    auto before=shortage.save();check(!shortage.prepare(2) && shortage.save()==before && shortage.menuMessage.find("Milk")!=std::string::npos);
    check(shortage.purchaseIngredient(2) && shortage.pendingSupplyCost==1200);roundtrip(shortage);
    check(shortage.cancelSupply() && shortage.wallet==5000);check(shortage.purchaseIngredient(2));shortage.advance(8);
    check(shortage.restockIngredient(2) && shortage.runtime->stock(shortage.inventory,shortage.ingredient(2)).value.total==4 && shortage.prepare(2));
    // Every ingredient has paid delivery, incoming-capacity ownership and refunds.
    for(int n=0;n<5;++n) {
        Simulation supplies{4,10000};check(supplies.purchaseIngredient(n));roundtrip(supplies);
        check(supplies.wallet==10000-definitions::ingredients[std::size_t(n)].price*12);
        check(supplies.cancelSupply() && supplies.wallet==10000);check(supplies.purchaseIngredient(n));supplies.advance(8);
        check(supplies.runtime->stock(supplies.storage,supplies.ingredient(std::size_t(n))).value.total==12);roundtrip(supplies);
    }
    // A failed load never replaces the current ticket or its money/claims.
    Simulation corrupt{20,5000};check(corrupt.welcome(0,2,4) && corrupt.prepare(2));corrupt.advance(4);
    auto bytes=corrupt.save(),bad=bytes;bad[bad.size()-compatibilitySaveBytes-garden::saveBytes-Simulation::gardenStorySaveBytes-8-corrupt.scheduleSaveBytes-corrupt.journalSaveBytes-corrupt.menuSaveBytes()+16]=9;
    check(!corrupt.load(bad) && corrupt.save()==bytes);
    // Long and partitioned updates execute dependent recipes identically.
    Simulation whole{20,5000},split{20,5000};check(whole.welcome(1,1,2) && split.welcome(1,1,2));
    check(whole.prepare(1) && split.prepare(1));whole.advance(10);for(int n=0;n<100;++n)split.advance(.1);
    check(whole.save()==split.save());
}
