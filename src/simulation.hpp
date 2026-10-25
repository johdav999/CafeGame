#pragma once
#include <cmath>
#include <stdexcept>

namespace cafe {
// Game policy stays independent of the platform and renderer.
struct Simulation {
    int served = 0, coins = 0;
    double brewing = 0;
    bool ready = false;
    bool brew() {
        if (ready || brewing > 0) return false;
        brewing = 3;
        return true;
    }
    void advance(double seconds) {
        if (!std::isfinite(seconds) || seconds < 0) throw std::invalid_argument("Invalid simulation delta");
        if (brewing > 0) {
            brewing = seconds >= brewing ? 0 : brewing - seconds;
            if (brewing == 0) ready = true;
        }
    }
    bool serve() {
        if (!ready) return false;
        ready = false;
        ++served;
        coins += 5;
        return true;
    }
};
}
