#pragma once
#include "simulation.hpp"
#include "previous_guest_envelope.hpp"
#include "fixtures/schema8.hpp"
#include <source_location>
inline void cafeCompatibilityChecks() {
    auto check=[](bool ok,std::source_location at=std::source_location::current()){if(!ok)throw std::runtime_error("Cafe compatibility line "+std::to_string(at.line()));};
    check(cafe::currentContent()!=cafe::legacyContent);
    cafe::Simulation game{4,5000};check(game.welcome(1) && game.brew());game.advance(1);
    auto current=game.save();auto metadata=cafe::inspectSave(current);check(metadata && metadata.sourceSchema==cafe::saveSchema && !metadata.migrated);
    auto word=[](auto& data,std::size_t offset,std::uint64_t value){for(int i=0;i<8;++i)data[offset+i]=std::uint8_t(value>>(8*i));};
    auto bad=current;word(bad,bad.size()-16,99);auto before=game.save();
    check(game.restore(bad).error==cafe::LoadError::ContentVersion && game.save()==before);
    bad=current;bad.back()^=1;check(game.restore(bad).error==cafe::LoadError::ContentMismatch && game.save()==before);
    bad=current;word(bad,8,cafe::saveSchema+1);check(game.restore(bad).error==cafe::LoadError::UnsupportedSchema && game.save()==before);
    bad=current;bad.resize(90);check(!game.restore(bad) && game.save()==before);
    bad=current;word(bad,24,999);check(game.restore(bad).error==cafe::LoadError::Malformed && game.save()==before);
    cafe::Simulation loaded;check(loaded.restore(current) && loaded.save()==current);
    auto previousBalance=withoutGardenFields(game);
    auto stamp=cafe::contentForRules(11,11);
    word(previousBalance,previousBalance.size()-16,stamp.version);word(previousBalance,previousBalance.size()-8,stamp.fingerprint);
    cafe::Simulation migrated;auto migration=migrated.restore(previousBalance);
    check(migration && migration.migrated && migrated.save()==current);
    auto previousCapacity=withoutGardenFields(game);
    stamp=cafe::contentForRules(12,12);
    word(previousCapacity,previousCapacity.size()-16,stamp.version);word(previousCapacity,previousCapacity.size()-8,stamp.fingerprint);
    check(migrated.restore(previousCapacity).migrated && migrated.save()==current);
    loaded.advance(2);check(loaded.serve() && loaded.served==1 && loaded.wallet==5500);
    auto paid=loaded.save();check(loaded.restore(paid) && loaded.save()==paid && !loaded.serve());
    // Genuine pre-menu fixture: deliberately incompatible, never silently upgraded.
    std::vector<std::uint8_t> frozen;
    auto hex=[](char c){return c<='9'?c-'0':c-'a'+10;};
    for(std::size_t i=0;i+1<sizeof(schema8Hex)-1;i+=2)frozen.push_back(std::uint8_t(hex(schema8Hex[i])*16+hex(schema8Hex[i+1])));
    check(loaded.restore(frozen).error==cafe::LoadError::ContentVersion && loaded.save()==paid);
    bad=current;word(bad,8,9);word(bad,bad.size()-16,cafe::legacyContent.version);word(bad,bad.size()-8,cafe::legacyContent.fingerprint);
    check(loaded.restore(bad).error==cafe::LoadError::ContentVersion && loaded.save()==paid);
    for(std::size_t cut=0;cut<current.size();cut+=17)check(!game.load(std::span(current).first(cut)) && game.save()==before);
}
