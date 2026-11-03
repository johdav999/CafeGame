# Simulator saves and CafeGame integration

Prompt 5 adds version-1 snapshots and adopts WebEngine::Simulator for the cafe service loop. The renderer stays pinned at 56080eca; the unreleased, portable simulator sources are bundled under vendor/webengine-simulator so cloud builds do not depend on a sibling checkout.

Brew creates a customer, order and production job. One worker and station consume one bean and produce an espresso in three simulation seconds. Serve delivers the claimed output and pays five coins once. Cancel abandons the order without refunding consumed beans. Customer patience is 60 simulation seconds. There are 100 beans per fresh session; restocking is deferred.

Save shift stores one localStorage slot on the current origin. Load shift validates a candidate before replacing the session. It restores wallet, processed receipt sequence, stock, reservations, jobs, orders and timers together. Invalid data leaves the current shift intact. Loading clears queued commands and resets the host clock; the current pause setting is retained. There is no offline progression, automatic loading or cross-device storage. Browser storage errors are displayed in the status line.

The core format uses bounded canonical little-endian values, a schema version and exact definition catalog comparison. Restore rebases handles to a fresh runtime epoch, validates references and recomputes claims/capacity totals. Events are not replayed. Hosts rebuild travel bindings using fresh handles; CafeGame explicitly uses immediate arrival. Snapshots are consistency-checked local data, not authenticated anti-cheat records. Only version 1 is supported.

## Native console host

With a C++20 compiler (Visual Studio developer shell on Windows):

```sh
cmake -S tests -B build/simulation
cmake --build build/simulation --config Release
ctest --test-dir build/simulation -C Release --output-on-failure
```

Run cafe_session_host from the build directory (Release/ for Visual Studio). Commands are brew, step, serve, cancel, save, load, quit. Each step advances one second. The console uses the same cafe session and writes cafe-shift.save in its working directory. This is a minimal diagnostic host, not a native renderer. Browser storage uses localStorage; native storage uses a bounded file read.

## Validation (2026-10-25)

- Emscripten 6.0.11: complete cafe_game build passed.
- Cafe simulation CTest: 1/1 passed under Node; invalid saves, mid-production continuation, cancellation and repeat payment covered.
- Engine standalone CTest: 2/2 passed; 764 simulator checks under Node.
- npm test: 4/4 offline tooling checks passed.
- Edge smoke: forced WebGL 2 and automatic fallback passed rendered cup, pause, cancellation, mid-brew save/load, page reload, wallet and invalid-save checks. Images: build/evidence.
- Native Windows/Linux execution and full Linux cloud setup were not run on this Windows machine; native compiler unavailable. CI builds the shared tests and console host. Software rendering does not establish hardware WebGPU or mobile performance.

Legacy skill mirrors under C:/Users/Johan are unavailable on this machine. Repository-local WebEngine and CafeGame engine-skill references are maintained instead.

Engine browser suite: 764 checks passed in Edge 155.0.4283.62 with no browser errors.

The minimal console host compiled and completed brew/step/save/serve/load/serve under Node/WebAssembly. This checks the host logic, not native Windows execution. CI now includes Ubuntu and Windows native builds/tests; remote runs have not been observed.

Stage 7 supersedes the browser immediate-arrival adapter: assigned jobs reconstruct actual travel after load. Running production restores without a second ingredient commit. See simulator-movement.md.

Stage 8 writes cafe envelope schema 2 for queue/seating/guest state and migrates prior schema-1 cafe saves. The Runtime core snapshot remains schema 1. See simulator-occupancy.md.

Stage 9 writes cafe envelope schema 3 for task/shift state and dirty seats. Formats 1 and 2 are explicitly migrated. Core Runtime snapshot schema remains 1. See simulator-workflows.md.

Stage 16 supersedes the historical envelope/validation notes above: Cafe writes
schema 9 with explicit content identity and preserves known formats 1..8 through
validated migrations. Core wire schema stays 1. See simulator-compatibility.md and
the stage-16 simulator-release.md evidence for current platform checks.
