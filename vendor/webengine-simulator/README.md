# Bundled WebEngine simulator

Portable source snapshot of the sibling WebEngine working tree after simulator prompt 5 (2026-10-25). This is unreleased source, not a published engine revision. Renderer dependencies remain pinned separately in the root CMakeLists.txt. SHA256SUMS records each bundled implementation/build file.

Refresh only the listed files from a reviewed WebEngine checkout, regenerate SHA256SUMS, and run simulator and CafeGame checks. Do not copy renderer internals. The simulator target is standard-library-only; its upstream tests live in WebEngine, while CafeGame integration tests live in tests/. Keep WEBENGINE_BUILD_SIMULATOR_TESTS disabled for this source-only bundle.

Hashes use UTF-8 text normalized to LF so Windows and Linux Git checkouts agree. Run node tools/verify-simulator.mjs from the repository root; CI checks the manifest.

Garden G4 adds bounded, atomic `extendResources`, `extendInventory` and
`extendWorker` authoring APIs. They preserve active jobs, holds, identities and
clock state, reject duplicate additions, and emit no events. The game uses them
on a detached candidate to upgrade selected older catalogs. Integration and
atomic rejection/foreign-handle tests live in `tests/summer_menu_test.cpp`.
This scoped extension does not change the snapshot wire format or renderer pin.

CafeGame table service adds the optional `requireQueueHead` argument to
`Runtime::acceptOrder`. Its default preserves FIFO; table orders pass false so
the player can choose a guest. This local additive extension does not change
the core snapshot schema or renderer pin. Integration coverage lives in
`tests/table_service_test.cpp`.

Stage 8 includes the optional header-only occupancy helper. SHA256SUMS now tracks eight implementation/build files; verify with tools/verify-simulator.mjs.

Stage 9 includes workflow.hpp; the manifest tracks nine implementation/build files. TaskBoard remains optional and does not change the renderer pin.

Stage 10 adds supply.hpp and Runtime::transfer. The manifest now tracks ten source/build files; core snapshot schema and renderer pin are unchanged.

Stage 11 adds optional economy.hpp and ledger error descriptions; eleven implementation/build files are tracked. The core snapshot schema and renderer pin are unchanged.

Stage 12 adds quality.hpp, atomic Runtime::remove and StockRemoved notifications. Twelve source/build files are tracked; core snapshot schema and renderer pin remain unchanged.

Stage 13 adds optional layout.hpp and enabled stable occupancy points. Thirteen source/build hashes are tracked; core wire schema and renderer pin are unchanged.

Stage 14 adds optional demand.hpp: seeded random state, arrival timing and pure satisfaction/patience scoring. Fourteen source/build hashes are tracked; core wire schema and renderer pin remain unchanged.

Stage 15 adds optional diagnostics.hpp for detached definition validation and read-only job explanations. Fifteen source/build hashes are tracked. Native Windows and Wasm contracts passed; Cafe scenarios, inspector UI and balancing reports remain consumer policy. Core wire schema and renderer pin remain unchanged.

Stage 16 adds compatibility.hpp, Runtime::metrics and clock-only transaction fast paths. Sixteen source/build hashes are tracked. Host envelopes/migrations and long replay/scale reports remain consumer policy; core schema 1 and renderer pin stay unchanged. See CafeGame docs/simulator-compatibility.md for local evidence and limits.
