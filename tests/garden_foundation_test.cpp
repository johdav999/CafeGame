#include "simulation.hpp"
#include "balance.hpp"
#include "garden_layout_cases.hpp"
#include "previous_guest_envelope.hpp"
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <set>
#include <source_location>

namespace {
void check(bool ok,std::source_location at=std::source_location::current()) {
    if(!ok)throw std::runtime_error("Garden foundation line "+std::to_string(at.line()));
}
void word(std::vector<std::uint8_t>& bytes,std::size_t offset,std::uint64_t value) {
    for(int i=0;i<8;++i)bytes.at(offset+i)=std::uint8_t(value>>(8*i));
}
void write(const std::string& directory,const char* name,const std::vector<std::uint8_t>& bytes) {
    std::ofstream file(directory+"/"+name,std::ios::binary);
    file.write(reinterpret_cast<const char*>(bytes.data()),std::streamsize(bytes.size()));
    check(bool(file));
}
}
int main(int argc,char** argv) {
    try {
        std::set<std::string_view> ids{cafe::garden::expansion};
        auto unique=[&](const auto& list){for(auto key:list)check(ids.insert(key).second);};
        unique(cafe::garden::zones);unique(cafe::garden::connections);unique(cafe::garden::tables);unique(cafe::garden::tableAccess);
        unique(cafe::garden::recipes);unique(cafe::garden::furnishings);
        unique(cafe::garden::regulars);unique(cafe::garden::chapters);
        check(cafe::garden::plannedCombinedTables==6 && cafe::garden::indoorTables==4);
        check(cafe::definitions::menu.size()==8);

        // Frozen using the real schema-19/content-16 writer before G1 changes.
        std::ifstream file(GARDEN_BASE_FIXTURE,std::ios::binary);
        check(bool(file));
        const std::vector<std::uint8_t> old{std::istreambuf_iterator<char>(file),{}};
        cafe::Simulation base;
        auto result=base.restore(old);
        check(result && result.migrated && result.sourceSchema==19);
        check(!base.gardenState.selected && base.gardenState.restoration==cafe::garden::Restoration::Locked);
        check(base.campaign.enabled && base.campaign.day==1 && !base.campaign.checkpoint.empty());
        check(base.wallet==10000 && base.tableCount()==2 && base.served==0);
        auto migrated=base.save(),roundtrip=withoutSummerFields(base);
        roundtrip.erase(roundtrip.end()-cafe::compatibilitySaveBytes-cafe::garden::saveBytes,roundtrip.end()-16);
        word(roundtrip,8,19);
        const auto oldStamp=cafe::contentForRules(16,16);
        word(roundtrip,roundtrip.size()-16,oldStamp.version);
        word(roundtrip,roundtrip.size()-8,oldStamp.fingerprint);
        check(roundtrip==old); // all base data, including opening bytes, intact
        check(base.restartDay() && !base.gardenState.selected);
        check(!base.selectGarden());
        cafe::Simulation owned;
        owned.contentAccess={true,true};
        check(owned.restore(old) && owned.contentAccess.available());
        check(!owned.gardenState.selected && owned.restartDay());
        check(owned.selectGarden() && owned.gardenState.selected);
        check(owned.campaign.checkpoint.empty() && owned.tableCount()==2);
        const auto selected=owned.save();
        cafe::Simulation legacy;legacy.contentAccess={true,true};check(bool(legacy.restore(old)));
        check(legacy.restartDay());legacy.gardenState.selected=true;legacy.campaign.checkpoint.clear();
        auto foundation=withoutSummerFields(legacy);
        const auto foundationAt=foundation.size()-cafe::compatibilitySaveBytes-cafe::garden::saveBytes;
        foundation.erase(foundation.begin()+foundationAt+cafe::garden::foundationSaveBytes,foundation.end()-cafe::compatibilitySaveBytes);
        word(foundation,8,20);word(foundation,foundationAt+8,1);word(foundation,foundationAt+16,cafe::garden::fingerprint(1));
        const auto foundationStamp=cafe::contentForRules(17,17);
        word(foundation,foundation.size()-16,foundationStamp.version);word(foundation,foundation.size()-8,foundationStamp.fingerprint);
        cafe::Simulation foundationLoaded;foundationLoaded.contentAccess={true,true};
        check(foundationLoaded.restore(foundation).migrated && foundationLoaded.save()==selected);
        check(bool(cafe::inspectSave(selected,cafe::currentContent(),owned.contentAccess)));
        check(!cafe::inspectSave(selected)); // bytes never grant access

        for(auto access:{cafe::garden::Access{},cafe::garden::Access{true,false},cafe::garden::Access{false,true}}) {
            cafe::Simulation unavailable{4,5000};unavailable.contentAccess=access;
            check(!unavailable.selectGarden());
            const auto before=unavailable.save();
            check(unavailable.restore(selected).error==cafe::LoadError::ExpansionUnavailable);
            check(!unavailable.load(selected) && unavailable.save()==before);
            check(unavailable.contentAccess.installed==access.installed && unavailable.contentAccess.owned==access.owned);
            check(bool(unavailable.restore(migrated)));
        }
        cafe::Simulation restored;restored.contentAccess={true,true};
        check(restored.load(selected) && restored.save()==selected);
        check(restored.openDay());
        const auto opening=restored.save();
        restored.advance(1);
        check(restored.restartDay() && restored.gardenState.selected && restored.contentAccess.available());
        check(restored.openDay() && restored.save()==opening);
        check(!restored.selectGarden()); // service cannot change content selection
        const auto before=restored.save();
        for(auto [index,value]:std::array<std::pair<int,std::uint64_t>,5>{{{0,2},{1,99},{2,0},{3,99},{0,0}}}) {
            auto bad=selected;word(bad,bad.size()-cafe::compatibilitySaveBytes-cafe::garden::saveBytes+std::size_t(index)*8,value);
            check(!restored.restore(bad) && restored.save()==before);
        }
        auto bad=selected;word(bad,8,cafe::saveSchema+1);
        check(restored.restore(bad).error==cafe::LoadError::UnsupportedSchema && restored.save()==before);
        for(std::size_t cut=0;cut<selected.size();cut+=113)
            check(!restored.restore(std::span(selected).first(cut)) && restored.save()==before);

        // A base outer envelope must not hide a garden-only opening checkpoint.
        bad=opening;for(int n=0;n<4;++n)word(bad,bad.size()-cafe::compatibilitySaveBytes-cafe::garden::saveBytes+std::size_t(n)*8,0);
        check(!base.restore(bad) && !base.gardenState.selected);

        // Continue the genuinely migrated base save through closing and day two.
        cafe::Simulation journey;check(journey.load(migrated));
        for(int tick=0;tick<9000 && !journey.summary();++tick){cafe::referenceDecisions(journey);journey.advance(.1);}
        check(journey.summary() && journey.served>0 && !journey.gardenState.selected);
        check(journey.nextDay() && journey.campaign.day==2);
        const auto dayTwo=journey.save();check(journey.load(dayTwo) && journey.save()==dayTwo);
        const auto courtyard=gardenLayoutChecks();
        if(argc==2) {
            std::filesystem::create_directories(argv[1]);
            write(argv[1],"garden-selected.save",selected);
            write(argv[1],"garden-opening.save",opening);
            write(argv[1],"base-migrated.save",migrated);
            write(argv[1],"garden-courtyard.save",courtyard);
        }
        std::cout<<"{\"gardenFoundation\":true,\"selectedHash\":\""<<cafe::sim::checkpointHash(selected)
                 <<"\",\"dayTwoHash\":\""<<cafe::sim::checkpointHash(dayTwo)<<"\",\"courtyardHash\":\""<<cafe::sim::checkpointHash(courtyard)<<"\"}\n";
    } catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
