#pragma once
#include "engine/simulator/compatibility.hpp"
#include <array>
#include <cstdint>
#include <string_view>

namespace cafe::garden {
// Reserved persistent content keys. Registration in the live recipe/layout
// catalog belongs to G2/G4; reserving a key does not enable that gameplay.
inline constexpr std::string_view expansion="cafe:garden";
inline constexpr std::array zones{"cafe:interior","garden:courtyard"};
inline constexpr std::array connections{"garden:doorway","garden:doorway-indoor-access","garden:doorway-outdoor-access"};
inline constexpr std::array tables{"garden:table-1","garden:table-2"};
inline constexpr std::array tableAccess{"garden:table-1-access","garden:table-2-access"};
inline constexpr std::array recipes{"garden:iced-coffee","garden:lemonade","garden:berry-cake"};
inline constexpr std::array furnishings{"garden:table-set","garden:umbrella","garden:flower-box","garden:trellis","garden:botanical-cups","garden:linen-apron","garden:cold-station"};
inline constexpr std::array regulars{"garden:gardener","garden:dog-walker","garden:book-club-organizer"};
inline constexpr std::array chapters{"garden:restore","garden:first-table","garden:summer-menu","garden:regulars","garden:party"};
inline constexpr std::size_t indoorTables=4,plannedOutdoorTables=2;
inline constexpr std::size_t plannedCombinedTables=indoorTables+plannedOutdoorTables;
inline constexpr std::uint64_t requiredBit=1,contentVersion=5;
inline constexpr std::size_t foundationSaveBytes=32,saveBytes=112;
inline constexpr int width=12,depth=20,doorZ=8;
inline bool outdoorTable(int id) {return id==101 || id==102;}
inline std::uint64_t fingerprint(std::uint64_t version=contentVersion) {
    engine::simulator::ContentHash h;h.text(expansion);h.word(version);
    auto keys=[&](const auto& list){h.word(list.size());for(auto key:list)h.text(key);};
    keys(zones);keys(connections);keys(tables);keys(tableAccess);
    keys(recipes);keys(furnishings);keys(regulars);keys(chapters);
    h.word(indoorTables);h.word(plannedOutdoorTables);
    if(version>=2){h.word(width);h.word(depth);h.word(doorZ);h.word(600);h.word(300);}
    if(version>=3){h.word(6);h.word(9);h.text("prefer-zone-fallback-fifo-v1");}
    if(version>=4){h.text("summer-menu-v1");h.word(4000);h.word(2000);}
    if(version>=5){h.text("restoration-story-v1");h.word(1000);h.word(6);h.word(650);}
    return h.value();
}
// Host-supplied capabilities, never serialized. A future distribution adapter
// verifies ownership. Native tests may inject fixtures; the browser supplies
// unavailable until an actual adapter exists. Saves cannot grant ownership.
struct Access {
    bool installed=false,owned=false;
    bool available() const {return installed && owned;}
};
enum class Restoration : std::uint64_t {Locked=0,CourtyardOpen=1};
struct State {
    bool selected=false;
    Restoration restoration=Restoration::Locked;
};
inline const char* status(Access access,State state) {
    if(!access.installed)return "Garden Café content is not installed. Your base café remains available.";
    if(!access.owned)return "Garden Café ownership is unavailable. Your base café remains available.";
    if(!state.selected)return "Garden Café is available. Select it during preparation to open the courtyard.";
    if(state.restoration==Restoration::CourtyardOpen)return "Courtyard open. Indoor and outdoor tables share your staff and equipment.";
    return "Garden Café selected. Open the courtyard during preparation to arrange outdoor tables.";
}
} // namespace cafe::garden
