#pragma once
// Retained counter-to-seat flow is still supported for migrated old sessions.
inline bool welcomeCounterGuest(cafe::Simulation& game) {
    auto id=game.runtime->arriveCustomer(game.profiles[0].patience);if(!id)return false;
    game.guests.push_back({id.value,cafe::Simulation::GuestPhase::Queue});
    auto& guest=game.guests.back();guest.arrived=game.runtime->time();guest.budget=game.profiles[0].patience;++game.admitted;
    guest.tableService=false;
    cafe::Simulation::require(game.queue.request(guest.id));game.runtime->drainEvents();return true;
}
// Synthetic old envelope markers for rejection tests. These are not valid
// historical saves after the milestone-17 catalogue change. The genuine schema-8
// fixture is retained separately under fixtures/.
inline std::vector<std::uint8_t> legacyBytes(std::vector<std::uint8_t> bytes) {
    bytes.resize(bytes.size()-cafe::compatibilitySaveBytes);bytes[8]=8;return bytes;
}
inline std::vector<std::uint8_t> legacySave(const cafe::Simulation& game){return legacyBytes(game.save());}
