#pragma once
#include "simulation.hpp"
inline std::vector<std::uint8_t> withoutStoryFields(const cafe::Simulation& game) {
    if(game.gardenStory.started || game.finish==3)throw std::runtime_error("Garden story has no historical envelope");
    auto bytes=game.save();const auto at=bytes.size()-16-cafe::garden::saveBytes-cafe::Simulation::gardenStorySaveBytes;
    bytes.erase(bytes.begin()+at,bytes.begin()+at+cafe::Simulation::gardenStorySaveBytes);
    auto put=[&](std::size_t offset,std::uint64_t value){for(int n=0;n<8;++n)bytes[offset+n]=std::uint8_t(value>>(8*n));};
    put(8,23);auto stamp=cafe::contentForRules(20,20);put(bytes.size()-16,stamp.version);put(bytes.size()-8,stamp.fingerprint);
    if(game.gardenState.selected){auto gardenAt=bytes.size()-16-cafe::garden::saveBytes;put(gardenAt+8,4);put(gardenAt+16,cafe::garden::fingerprint(4));}
    return bytes;
}
// The classic catalog has identical core bytes. Remove only G4 envelope fields
// when constructing explicit historical test writers; never downgrade summer jobs.
inline std::vector<std::uint8_t> withoutSummerFields(const cafe::Simulation& game) {
    if(game.summerCatalog)throw std::runtime_error("Summer catalog has no historical envelope");
    auto bytes=withoutStoryFields(game);
    std::size_t equipment=88+game.runtime->save().size(),workflow=equipment+cafe::Simulation::equipmentSaveBytes+8;
    for(const auto& guest:game.guests){workflow+=3*8;game.saveTableGuest(guest,[&](auto){workflow+=8;});}
    for(const auto* pool:{&game.queue,&game.counter,&game.seats})workflow+=(1+pool->claims().size()*3)*8;
    const auto layoutEnd=bytes.size()-cafe::compatibilitySaveBytes-cafe::garden::saveBytes-cafe::Simulation::journalSaveBytes-game.campaignSaveBytes()-cafe::Simulation::scheduleSaveBytes-game.menuSaveBytes()-game.demandSaveBytes();
    bytes.erase(bytes.begin()+layoutEnd-32,bytes.begin()+layoutEnd);
    const auto restock=workflow+(1+3+game.crew.size()*9+5)*8;
    bytes.erase(bytes.begin()+restock,bytes.begin()+restock+24);
    for(auto [offset,count]:std::array<std::pair<std::size_t,std::size_t>,4>{{{34*8,8},{26*8,24},{20*8,8},{12*8,8}}})
        bytes.erase(bytes.begin()+equipment+offset,bytes.begin()+equipment+offset+count);
    auto put=[&](std::size_t at,std::uint64_t value){for(int n=0;n<8;++n)bytes[at+n]=std::uint8_t(value>>(8*n));};
    put(8,22);const auto stamp=cafe::contentForRules(19,19);put(bytes.size()-16,stamp.version);put(bytes.size()-8,stamp.fingerprint);
    if(game.gardenState.selected){const auto at=bytes.size()-16-cafe::garden::saveBytes;put(at+8,3);put(at+16,cafe::garden::fingerprint(3));}
    return bytes;
}
inline std::vector<std::uint8_t> withoutSeatingPreferences(const cafe::Simulation& game) {
    auto bytes=withoutSummerFields(game);std::size_t at=88+game.runtime->save().size()+29*8+8;
    for(const auto& guest:game.guests){
        std::size_t words=0;game.saveTableGuest(guest,[&](auto){++words;});
        at+=3*8+(words-1)*8;
        bytes.erase(bytes.begin()+at,bytes.begin()+at+8);
    }
    return bytes;
}
// Explicitly construct schema 19, before the expansion trailer existed.
inline std::vector<std::uint8_t> withoutGardenFields(const cafe::Simulation& game) {
    auto bytes=withoutSeatingPreferences(game);
    bytes.erase(bytes.end()-cafe::compatibilitySaveBytes-cafe::garden::saveBytes,bytes.end()-cafe::compatibilitySaveBytes);
    auto put=[&](std::size_t at,std::uint64_t value){for(int n=0;n<8;++n)bytes[at+n]=std::uint8_t(value>>(8*n));};
    const auto stamp=cafe::contentForRules(16,16);
    put(8,19);put(bytes.size()-16,stamp.version);put(bytes.size()-8,stamp.fingerprint);
    return bytes;
}
// Construct the pre-table-service guest layout for explicit migration tests.
// Visits with pending table service cannot use that historical format.
inline std::vector<std::uint8_t> withoutTableGuestFields(const cafe::Simulation& game) {
    auto bytes=withoutGardenFields(game);std::size_t at=88+game.runtime->save().size()+29*8+8;
    for(const auto& g:game.guests) {
        if(g.visit || g.prepared || (g.tableService && !g.rating))throw std::runtime_error("Active table service has no previous guest envelope");
        // Historical envelopes used an eight-second dwell budget. Preserve
        // the fraction remaining when constructing a pre-dining fixture.
        auto dwell=std::uint64_t(g.remaining)*8000/std::uint64_t(cafe::Simulation::diningDuration(g.items));
        for(int n=0;n<8;++n)bytes[at+16+n]=std::uint8_t(dwell>>(n*8));
        at+=3*8;bytes.erase(bytes.begin()+at,bytes.begin()+at+4*8);
    }
    return bytes;
}
