# Stage 15: authoring and diagnostics

The simulator has a small, typed C++ authoring surface, four runnable Cafe presets,
read-only inspectors with blocked-action explanations, and deterministic balance
reports. All hosts use the same Simulation; no renderer or provider credentials
are needed for content validation and headless reports.

## Author definitions and scenarios

`src/definitions.hpp` owns persistent resource/process IDs, espresso inputs,
outputs, duration and capability, and guest profile names, patience, weights and
takeaway preferences. `src/scenarios.hpp` owns initial beans, cash, nonzero RNG
seed, arrival countdown, guest profiles, traffic, supply automation and staff
availability. Edit these typed definitions and rebuild. This release has no JSON
hot reload or visual recipe editor. Additional playable drinks still need game
policy, UI and save validation; merely registering a process does not add a menu.
Prices, machine/supply/layout policy remain in the game-owned `.inc` files.

`validateContent()` checks the production catalog using the engine's registration
rules, profile bounds/weights, scenario bounds, references and duplicate keys.
`cafe_balance --validate` exits nonzero and prints field paths on failure. CTest
runs validation in native and Wasm configurations. Malformed presets are rejected
before the current session changes. The four presets are:

| Key | Purpose |
| --- | --- |
| morning | Original shift: 4 beans, 50.00, 3 regulars, automatic arrivals |
| rush | 1 bean, 25.00, 3 commuters and early traffic |
| quiet | 100 beans, 50.00, 1 enthusiast, manual arrivals |
| recovery | 2 beans, 12.00, 2 guests, staff on break |

In the browser open **Scenarios and authoring**, choose a preset and press
**Start selected scenario**. This replaces the current shift. Save first to keep
it; starting a scenario never overwrites the device save. It works while paused
and retains the global pause. The scene cancels/rebuilds travel, clears queued
commands and resets host clocks after a successful reset. A detached scenario is
published through the existing joint save validator, including fresh handle epochs.

All initial conditions become ordinary saved game state. A scenario label is not
persisted and selecting another preset does not relabel a loaded shift. Envelope
8 and core schema 1 stay unchanged. Registration validates process definitions
against core saves, and guest clocks are validated against profiles. This is not
a general content-version migration system: changing rules/weights/prices between
builds is not guaranteed compatible. Explicit content versions/migrations remain
stage 16. Default rules and the existing renderer pin are unchanged here.

## Read-only inspection and export

Open **Shift diagnostics** for inventory totals, available/input-held/incoming
capacity, job/order/worker/station IDs, deadline remaining, task roles/priorities/
dependencies, spatial claims and the current RNG state. Existing guest tickets,
review inputs and finance journal complete the view. Blocked actions name a
concrete next step, including supply cash, dirty equipment, staff breaks and
physical counter arrival. Global pause takes precedence in the browser.

Queries return copies, never drain events, advance time, assign jobs or draw RNG.
The browser limits inspector DOM refreshes to 5 Hz while expanded. Runtime data
is still queried each frame; this is a small-session tool, not a scale benchmark.
The action list explains current policy blockers; command execution remains
subject to engine validation, capacity/work limits and navigation changes.

**Export shift report** downloads `cafe-shift-report.json`, a read-only snapshot
with metrics plus inventory/job/task/claim/action inspection. It does not export
a playable save or record historical events. Currency uses integer minor units,
time milliseconds and quality/reputation 0..1000. The native/Wasm console host
supports `scenario KEY`, `validate`, `inspect` and `report` as well.

## Repeatable balance runs

Build `tests/CMakeLists.txt` natively, or build it with Emscripten and Node.
The resulting `cafe_balance` (`.exe` or `.cjs`) uses the same game-owned policies:

```sh
npm run balance -- --scenario all --seeds 1,2,3 --seconds 300
npm run balance -- --host build/simulation-wasm/cafe_balance.cjs --scenario rush --seeds 123,456 --seconds 120 --format csv --output build/evidence/rush.csv
```

The tool discovers common native/cloud/Wasm build paths or accepts `--host`.
It validates content before dispatch, rejects unknown scenarios/options, limits
runs to 32 positive uint32 seeds and 1..3600 whole seconds, and writes only when
`--output` is supplied. JSON contains per-run metrics; CSV has one row per run.
Use several seeds and compare individual outcomes; no statistical confidence or
optimal strategy is claimed. The console also accepts `cafe_balance KEY SEED SECONDS`.

The named `reference-v1-zero-travel-100ms` policy decides every 100 ms, resumes
staff, serves fresh ready drinks, restocks at one bean, orders when total beans
are at most four, and repairs/cleans below 50% while idle. It never invents extra
manual guests. Zero travel and immediate seating are explicit headless adapters;
reports measure logical game balance, not browser navigation, FPS or GPU speed.
Ending at a time boundary may leave a ready drink for the next decision.

Reports include sales, cash, profit, net supply spend, wages/arrears, waste,
admissions, missed arrivals, successful/failed reviews, reputation and RNG state.
Bean/machine blocked time samples waiting guests with no active order after the
policy's decisions. Those two categories are exclusive; idle time is separate
and can overlap them. Identical preset, seed, duration, policy and executable
produce byte-identical reports. The browser export is a live snapshot, not a
headless reference-policy run.

## Portable engine API

Include `engine/simulator/diagnostics.hpp`. Optional header-only
`validateDefinitions(resources, processes, limits)` registers into a detached
Runtime and returns indexed `DefinitionIssue` paths/errors. Invalid resources or
limits yield `resources/limits`; oversized process lists yield `processes`.
Valid processes are accumulated so duplicate keys are diagnosed using the live
registration semantics; invalid records are not added. This is bounded by the
supplied Limits, not a second permissive content loader. Allocation failures may
throw; callers retain ownership of error handling.

`inspectJob(const Runtime&, JobId)` returns a copied `JobInspection`, remaining
running time and an explanation based on job state/blocked Error; stale IDs return
the normal Result error. Queued/no-error means waiting for explicit assignment;
it does not predict the result of a future scheduling pass. These helpers own no
host references, events, clock, scenes, scenarios, storage, JSON or game policy.
The same source builds for native Windows/Linux and Wasm. Canonical source is in
WebEngine, with a hash-checked distribution in CafeGame's vendor directory.

## Validation

See the stage 15 entry in `simulator-release.md` for checks actually run. Unit
contracts cover invalid catalogs/references, stale handles, non-mutating inspection,
scenario rejection/publication/save roundtrips, repeatable reports and seed changes.
The authoring browser smoke covers resets, pause, inspection and report download
under forced WebGL 2 and automatic fallback. Native Linux/cloud, hardware WebGPU
and physical mobile evidence remain separate release gates. Native Windows portable/console evidence is recorded separately
from 3D renderer acceptance.

Stage 16 supersedes the stage-15 compatibility limitation: envelopes now include
content version/fingerprint and explicit legacy migration decisions. Definitions
and profiles are fingerprinted; bump ruleRevision for saved-policy changes.
Checkpoint/replay, record metrics and scale reports are documented in
[compatibility and scale](simulator-compatibility.md).
