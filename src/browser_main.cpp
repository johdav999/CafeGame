#include "cafe_scene.hpp"
#include "engine/application.hpp"
#include "engine/renderer.hpp"
#include <emscripten.h>
#include <deque>

namespace {
engine::Application app;
std::unique_ptr<engine::Renderer> renderer;
cafe::CafeScene* scene = nullptr;
cafe::Simulation game;
std::deque<int> commands;
bool paused = false;
void publish() {
    EM_ASM({window.cafeUpdate?.({served:$0,coins:$1,brewing:$2,ready:!!$3,paused:!!$4});},
        game.served, game.coins, game.brewing, game.ready, paused);
}
void frame() {
    try {
        while (!commands.empty()) {
            int command = commands.front(); commands.pop_front();
            if (command == 2) {
                paused = !paused;
                if (paused) app.pause(); else app.resume();
            } else if (!paused && !app.suspended()) {
                if (command == 0) game.brew();
                if (command == 1) game.serve();
            }
        }
        renderer->serviceRecovery();
        if (renderer->ready()) {
            engine::ApplicationFrameCallbacks callbacks;
            callbacks.simulate = [](auto&, const auto& frame) { game.advance(frame.simulation.delta); };
            app.advance(emscripten_get_now() / 1000, callbacks);
            scene->project(game);
            renderer->resizeCanvas();
            renderer->render();
        } else app.resetClocks();
        publish();
    } catch (const std::exception& error) {
        app.pause(); paused = true;
        EM_ASM({window.engineStatus(UTF8ToString($0),true);}, error.what());
    }
}
}
extern "C" {
EMSCRIPTEN_KEEPALIVE void cafe_command(int command) {
    if (command >= 0 && command <= 2 && commands.size() < 16) commands.push_back(command);
}
EMSCRIPTEN_KEEPALIVE void cafe_suspend(int hidden) { commands.clear(); app.setSuspended(hidden != 0); }
EMSCRIPTEN_KEEPALIVE void cafe_shutdown() { emscripten_cancel_main_loop(); app.shutdown(); }
}
int main() {
    try {
        app.setSceneBinding([](engine::Scene* active) {
            if (!active) { renderer.reset(); scene = nullptr; return; }
            scene = &dynamic_cast<cafe::CafeScene&>(*active);
            renderer = std::make_unique<engine::Renderer>(*scene, scene->camera());
            const int gl = EM_ASM_INT({return new URLSearchParams(location.search).get('backend')==='webgl2';});
            renderer->initialize(gl ? engine::RenderBackendPreference::WebGl2 : engine::RenderBackendPreference::Automatic);
        });
        app.start(app.loadScene(std::make_unique<cafe::CafeScene>()));
        app.setSuspended(EM_ASM_INT({return document.hidden;}) != 0);
        emscripten_set_main_loop(frame, 0, true);
    } catch (const std::exception& error) {
        EM_ASM({window.engineStatus(UTF8ToString($0),true);}, error.what());
        return 1;
    }
}
