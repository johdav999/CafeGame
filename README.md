# CafeGame

Garden Café add-on work: [G1–G2 foundation and courtyard](docs/garden-cafe.md),
[G3 indoor/outdoor service](docs/garden-service.md),
[G4 summer menu and cold preparation](docs/garden-summer-menu.md),
[G5 restoration and garden regulars](docs/garden-restoration.md)
and the [expansion milestones](docs/garden-cafe-milestones.md).

A 3D cafe simulator built with [WebEngine](https://github.com/johdav999/WebEngine)'s C++20/WebAssembly browser runtime and `WebEngine::Browser` renderer. WebGPU is selected automatically, with WebGL 2 available through `?backend=webgl2`.

The playable prototype serves espresso, americano, latte, tea and croissants,
including two-item tickets, ingredients and equipment steps. It includes moving
staff/customers, a FIFO queue, seating, supplies, operating costs, freshness,
maintenance, table layout editing, payment receipts and local save/load.
The first playable presentation adds a paper HUD, Serve/Build/Menu navigation,
guided first shift, bounded camera controls, original local props/character
poses and engine audio. Primitive fallbacks remain available.
The [cafe clock](docs/cafe-clock.md) shows Day and 08:00–18:00 business hours,
with Morning, Lunch and Afternoon purchase breaks and explicit continuation.
See the [release candidate guide](docs/game-release.md) for controls and device gates.
The [service HUD guide](docs/service-ui.md) explains customer badges, order icons,
patience and the remaining production art/device work.

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

Open [localhost:4173](http://localhost:4173). Choose Begin guided shift, open the day,
then prepare and serve the visible tickets. Menu contains save/load and settings.
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

The proposed reusable simulator library is scoped in the
[v0.1 release plan](docs/simulator-library-release-plan.md). Its inventory,
reservation, production and customer-service systems are implemented in the separate WebEngine working tree;
CafeGame adopts the bundled portable module while retaining its renderer pin. See [save/load and validation](docs/simulator-saves.md).

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
cmake -S tests -B build/simulation
cmake --build build/simulation --config Release
ctest --test-dir build/simulation -C Release --output-on-failure
```

CI runs these checks and compiles the real WebEngine browser target. Actual GPU rendering acceptance
requires a browser with WebGPU or WebGL 2; a successful compile alone does not verify rendering.
GitHub Actions uploads `cafe-game-browser`. Deployment is not enabled by this scaffold.

Optional browser acceptance: with Playwright available and the dev server running, run
`node tools/browser-smoke.cjs`. Set `BROWSER_EXECUTABLE` to Chrome/Edge if needed, and use
`NODE_PATH` for an external Playwright installation. It checks rendered coffee, pause/resume
and serving on forced WebGL 2 and automatic backend selection, saving screenshots in `build/evidence/`.

[Simulator release candidate and remaining validation gates](docs/simulator-release.md). Verify the bundled source with `node tools/verify-simulator.mjs`.

Stage 7 adds visible barista/customer travel using engine navigation. See [movement and interaction adapters](docs/simulator-movement.md).

Stage 8 adds a three-guest queue, Welcome guest, exclusive service and two seats. See [queue and seating behavior](docs/simulator-occupancy.md).

Stage 9 adds supply collection, preparation, hand-over, staff breaks and table cleaning. See [workflow controls and persistence](docs/simulator-workflows.md).

Stage 10 adds a storeroom, timed bean deliveries, reserved capacity, restocking and optional auto supply. See [supply controls and persistence](docs/simulator-supply.md).

Stage 11 adds paid beans, supplier refunds, staff wages and a cash/profit ledger with saved history. New shifts start with 50 coins. See [economy controls and persistence](docs/simulator-economy.md).

Stage 12 adds coffee freshness/quality, machine wear, cleaning and paid repair tasks with saved progress. See [quality and maintenance](docs/simulator-quality.md) and the [remaining roadmap](docs/simulator-roadmap.md).

Stage 13 adds closed-cafe table placement, half-metre snapping, route validation, buying/selling, saved layouts and navigation updates. See [layout controls and persistence](docs/simulator-layout.md).

Stage 14 adds automatic foot traffic, guest preferences/patience, satisfaction and reputation, with saved deterministic randomness. See [customer demand and reviews](docs/simulator-demand.md).

### Authoring and balancing (stage 15)

Open **Scenarios and authoring** to start Morning, Commuter rush, Quiet practice
or Staff recovery, or export a JSON shift snapshot. Save before starting another
scenario to keep current progress. **Shift diagnostics** explains disabled actions
and inspects reservations, production, staff tasks and spatial claims.

Definitions live in `src/definitions.hpp`; presets live in `src/scenarios.hpp`.
Build the independent tests/console targets, then run `npm run balance -- --scenario all --seeds 1,2,3 --seconds 300` for repeatable headless reports.
Use `--format csv --output build/evidence/balance.csv` to save a comparison.
See [authoring contracts and report limits](docs/simulator-authoring.md).

Stage 16 writes content-stamped saves, explicitly migrates known legacy shifts and
reports incompatible rules without replacing the current shift. Shift diagnostics
shows version/record information. Run `npm run stress -- --seconds 21600 --seeds 123,456 --scale 1024 --output build/evidence/stress.json` for checkpoint replay and
scale timings. See [compatibility, migration and scale contracts](docs/simulator-compatibility.md).

The [game milestones](docs/game-milestones.md) track the implemented menu (17),
staffing (18), daily progression (19), upgrades/customization (20) and the stage-21
first playable candidate. WebGL 2, automatic fallback and Intel hardware WebGPU
have rendered-play evidence. Physical-mobile acceptance remains outstanding;
see the release guide for dated evidence and known limits.

The [café journal](docs/game-journal.md) adds three rotating daily goals and
eighteen lifetime achievements per campaign, with saved progress and one-time
closing rewards. Open it from Serve or Menu; day results show the rewards earned.

Milestone 17 is now implemented: see [menu, tickets and ingredient controls](docs/game-menu.md).
Choose Quiet practice, read a ticket, prepare its first item and serve the whole
order. Manual guests can request one or two different menu items.

Milestone 18 adds [hireable staff and concurrent cafe work](docs/game-staff.md):
up to three employees, individual breaks, role priorities, timed restocking,
wages and guarded dismissal.

Milestone 19 adds the [daily campaign](docs/game-campaign.md): **New campaign**,
preparation, ten-minute service, closing, results and the next day. Complete
objectives for one-time cash rewards and recipe unlocks; meet returning regulars
and restart a day from its opening checkpoint when needed. Daily rent/utilities,
wages, supplies, repairs, waste and satisfaction appear in the results.
Milestone 20 adds [equipment and customization](docs/game-equipment.md): faster
espresso, an extra preparation station, expanded storage, four table sets,
plants, lamps and forest/oat/oak finishes. Open **Build and layout** during
campaign preparation, or select **Layout workshop** for a funded sandbox.
Prices, refunds, footprints and tradeoffs are shown before purchase.
Saves use format 24 / content 21, including garden restoration, party attempts, regular histories and Garden Café summer recipes/cold preparation, seating preferences/claims and courtyard layouts, dining times, table service, the café journal, business clock and plant/pot selections, and migrate known milestone-17/18 saves into sandbox
mode and preserve milestone-19 campaigns and opening checkpoints. Pre-menu saves
remain incompatible; loading preserves device bytes until **Save shift**.
