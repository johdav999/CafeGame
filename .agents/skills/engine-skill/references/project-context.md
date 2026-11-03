# CafeGame integration context

Inspected 2026-10-25. Recheck the current repository before relying on this snapshot.

- Read root `AGENTS.md`, `README.md`, `design.md` and `docs/assets.md`. This is a C++20/WebAssembly 3D cafe game with a warm Scandinavian dollhouse direction. Do not add a native host merely because the engine supports one.
- Engine root is the explicit `WEBENGINE_SOURCE_DIR` override when configured; otherwise CMake FetchContent obtains the pinned WebEngine revision. At inspection the pin was `56080eca124c9a62e15b146799a8004bdad5a9b2`. Resolve the actual build cache/source directory before selecting APIs. Do not silently change the pin or point it at the sibling engine.
- `cafe_game` links `WebEngine::Browser`, `engine_audio_browser` and `engine_assets_browser`. Preserve WebGPU and WebGL2 compatibility, asset-decode worker staging and third-party licenses.
- Game rules belong in `src/simulation.hpp` and game-owned code. Brewing/serving/coins/pause are the prototype baseline. Customers, decoration, progression and the fuller GUI described in the design are targets, not all delivered systems.
- Use simulation time for brewing, shifts and customer patience, and route accepted commands through the game simulation before changing coins or stock. Scene actors/UI project that state. Navigation and state machines can support customers without owning recipe/economy policy.
- A simulator release plan or uncommitted engine target is not a usable dependency at this pin. Verify source, public API, tests and upgrade scope before adopting a simulator library.
- With Emscripten active, `npm run configure` and `npm run build` build target `cafe_game`; `npm run dev` serves it. Read the current package scripts and README for Windows environment setup. `npm test` covers the existing tool tests, not rendered game acceptance.
- Linux cloud uses `bash tools/cloud/setup.sh` when unprepared and `bash tools/cloud/run.sh COMMAND ...` per shell. Full validation is `bash tools/cloud/check.sh`; the build tree is `build/cloud/browser`, separate from Windows `build/browser`. For a cloud preview use `CAFE_SITE_DIR=build/cloud/browser/site npm run dev`.
- Follow the design's readability, input and performance needs on both browser renderers. Software-rendered browser tests do not establish hardware WebGPU or physical-mobile performance. Asset generation remains an explicitly authorized authoring action; keep credentials out of runtime bundles.

The bundled `engine.md` is copied from WebEngine's canonical root guide. Refresh it when requested; preserve this game-specific context and its dependency pin.

Stage 5/6 update: CafeGame links WebEngine::Simulator from vendor/webengine-simulator when the selected renderer checkout lacks it. Its exact LF-normalized sources are tracked by SHA256SUMS. Runtime orders, wallet receipts and local saves are implemented. The portable console host in tests/ is a diagnostic example only. See docs/simulator-saves.md and docs/simulator-release.md; the renderer pin remains unchanged.
