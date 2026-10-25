#include "simulation.hpp"
#include <limits>
#include <iostream>
int main() {
    cafe::Simulation game;
    auto check = [](bool ok) { if (!ok) throw std::runtime_error("Simulation check failed"); };
    check(!game.serve());
    check(game.brew());
    check(!game.brew());
    game.advance(2);
    check(!game.ready && !game.serve());
    game.advance(1);
    check(game.ready && !game.brew());
    check(game.serve() && game.served == 1 && game.coins == 5);
    check(!game.serve());
    check(game.brew());
    game.advance(10);
    check(game.ready);
    bool rejected = false;
    try { game.advance(std::numeric_limits<double>::quiet_NaN()); } catch (const std::invalid_argument&) { rejected = true; }
    check(rejected);
    std::cout << "Simulation checks passed\n";
}
