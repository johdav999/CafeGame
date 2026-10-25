# CafeGame

A 3D cafe simulator built with [WebEngine](https://github.com/johdav999/WebEngine)'s C++20/WebAssembly browser runtime and `WebEngine::Browser` renderer. WebGPU is selected automatically, with WebGL 2 available through `?backend=webgl2`.

The starter includes a cafe made from engine primitives, a three-second espresso brew/serve loop,
coins, pause/resume and suspension while the tab is hidden. It is an initial playable scaffold;
customer AI, placement, economy, persistence and production assets are future work.

## Run locally

For Codex cloud tasks, see [cloud setup](docs/cloud.md). The setup command is
`bash tools/cloud/setup.sh`; agent commands are documented in [AGENTS.md](AGENTS.md).

Install Node.js 22+, CMake 3.24+, Ninja, Git, Python 3 and Emscripten **6.0.11**.
Activate the SDK (`emsdk_env.bat` on Windows, `source emsdk_env.sh` on Unix), then:

```sh
npm run configure
npm run build
npm run dev
```

Open [localhost:4173](http://localhost:4173). Use Brew espresso, wait three seconds, then Serve coffee.
The browser site is `build/browser/site/`; serve it over HTTP or HTTPS, including `.wasm` as `application/wasm`.
No npm dependencies or API keys are needed to run the starter.

The first configure fetches WebEngine at **56080eca124c9a62e15b146799a8004bdad5a9b2** and its pinned dependencies.
To develop against an existing engine checkout:

```sh
emcmake cmake -S . -B build/browser -G Ninja -DCMAKE_BUILD_TYPE=Release -DWEBENGINE_SOURCE_DIR=/path/to/WebEngine
```

Build only `cafe_game`; the engine playground is excluded from the default consumer build.
The engine owns rendering and application timing. CafeGame owns gameplay and scene composition.
Keep the dependency pin reviewed when updating the engine.

## Project layout

- `src/`: platform-independent game rules, 3D cafe scene and browser host.
- `web/`: browser canvas, lightweight HUD and host callbacks.
- `assets/`: approved content inventory; generated drafts are ignored.
- `tools/`: local static server and offline ElevenLabs/Tripo asset tools.
- `tests/`: gameplay and provider tooling checks.
- `.github/`: CI builds a downloadable browser artifact and tests tools/game rules.

## Audio and 3D assets

[Asset setup and commands](docs/assets.md) cover ElevenLabs speech/sound effects and Tripo3D model generation.
Copy `.env.example` to `.env` when ready to generate assets. Commands default to dry runs;
`--execute` submits a paid generation request. Keys are never part of the browser runtime.

## Checks

```sh
npm test
g++ -std=c++20 -Isrc tests/simulation_test.cpp -o cafe-test
./cafe-test
```

CI runs these checks and compiles the real WebEngine browser target. Actual GPU rendering acceptance
requires a browser with WebGPU or WebGL 2; a successful compile alone does not verify rendering.
GitHub Actions uploads `cafe-game-browser`. Deployment is not enabled by this scaffold.

Optional browser acceptance: with Playwright available and the dev server running, run
`node tools/browser-smoke.cjs`. Set `BROWSER_EXECUTABLE` to Chrome/Edge if needed, and use
`NODE_PATH` for an external Playwright installation. It checks rendered coffee, pause/resume
and serving on forced WebGL 2 and automatic backend selection, saving screenshots in `build/evidence/`.
