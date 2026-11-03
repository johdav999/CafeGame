# Simulator v0.1 release candidate

Prompt 6 completes release preparation in the sibling WebEngine repository: docs/simulator-guide.md, docs/simulator-changelog.md, docs/simulator-release.md, examples/simulator/parity.cpp and scripts/simulator-parity.py. The standalone example remains examples/simulator/headless.cpp.

The release workflow builds native Linux, native Windows and Wasm consumers, runs the contract suites, records exact canonical snapshots and ordered event traces, then compares all three artifacts. The scenario includes two customers competing for a worker/station and finite stock, restored assignments, mid-production saves, invalid saves, output claims, payment retries and running cancellation. Whole and partitioned time advances must also match.

Locally on 2026-10-25, a clean Wasm consumer build passed, all four CTest targets passed, whole/partitioned traces matched, and Edge passed all 764 contracts without browser errors. Native Windows/Linux and remote cross-platform CI results remain unverified. The native C++ toolchain is absent on this machine. Stage 5 browser rendering evidence remains recorded in simulator-saves.md; hardware WebGPU/mobile performance and full Linux cloud validation remain open gates.

CafeGame's bundled simulator source has six LF-normalized SHA-256 hashes checked by tools/verify-simulator.mjs in Linux/Windows CI. The renderer pin is unchanged. No runtime library source or gameplay behavior changed in prompt 6. Existing uncommitted work is preserved; no tag, package, commit or push was created.

Before release acceptance, run the configured native and parity CI jobs for the final revision and the consumer cloud checks. Treat this as release-candidate source until those gates pass.

## Stage 15 local validation — 2026-10-25

Delivered typed resource/process/profile definitions, validated Morning/Rush/Quiet/
Recovery presets, atomic scenario reset, read-only multi-system inspection and
blocked-action explanations, live JSON export and the deterministic headless
balance host. See [authoring contracts](simulator-authoring.md).

Checks run locally on this source:

- Final MSVC 19.44 native Windows builds: Cafe tests/console/balance targets and
  standalone engine consumer/parity/contracts. Cafe CTest 3/3 and engine CTest 4/4
  passed, including the diagnostic event-outbox preservation contract.
- Final Emscripten 6.0.11 builds: browser game against the unchanged pinned renderer,
  independent Cafe tests/console/balance targets and standalone engine Wasm/browser
  tests. Cafe CTest 3/3 and engine CTest 4/4 passed. The engine contract page also
  passed in Edge 156.0.4314.42 with no page/console errors.
- `tools/authoring-smoke.cjs` passed on the final browser build for forced WebGL 2
  and automatic fallback: four paused preset resets, saved-shift preservation,
  invalid index rejection, active-order reset/rebinding, fresh service, inspector
  projections and JSON download equality without state mutation.
- The existing full `tools/browser-smoke.cjs` passed on both paths for service,
  finances, quality/expiry/waste, repair/refund/break restore and layout/navigation/
  cleanup. The final equivalent content-key/capability alias refactor was followed
  by the complete native/Wasm contracts and final focused authoring browser smoke.
- Eight 120-second runs (all four presets, seeds 123 and 456) produced identical
  report JSON in native Windows and Wasm after Windows newline normalization.
  Artifacts: `build/evidence/stage15-balance.json`, `stage15-balance.csv` and
  `authoring-{webgl2,automatic}.png`. Reports identify the explicit zero-travel
  reference policy; these are logical balance comparisons, not GPU benchmarks.
- `npm test` passed 6/6. Script syntax checks, `git diff --check`, all 15 bundled
  hashes, canonical/vendor source and test parity, the renderer pin and all three
  installed/repository engine-skill stage-15 updates were verified.

Native build directories are `build/simulation-stage15-native` (Cafe) and
`WebEngine/build/simulator-stage15-native` (engine), configured with
`-G "Visual Studio 17 2022" -A x64` and built/tested with `-C Release`.
Windows validation covers the portable library and console hosts, not a native
3D Cafe renderer. Linux/full cloud validation, hardware WebGPU, physical mobile,
long stress/scale and general content migration remain unverified here. CI now
runs content/balance contracts and uploads native per-platform balance artifacts;
cloud/check.sh includes the rendered authoring smoke. CI/cloud jobs were not run
from this local task. No paid generation or dependency/pin update was performed.

## Stage 16 local validation — 2026-10-25

Delivered content-stamped envelope 9, explicit known-legacy migrations, typed load
outcomes, runtime record metrics, clock-only transaction fast paths and long
checkpoint/replay/scale tooling. Core schema 1 and the renderer pin are unchanged.
See [compatibility contracts](simulator-compatibility.md).

Final source checks run locally:

- MSVC 19.44 Release: Cafe CTest 4/4 (including one simulated hour of checkpoint
  replay), standalone engine consumer/parity/contracts CTest 4/4.
- Emscripten 6.0.11 Release: full browser build, Cafe CTest 4/4 and standalone
  engine CTest 4/4. The engine contract page passed in Edge 156.0.4314.42 with no
  page or console errors; new compatibility/scale helper assertions run alongside
  its historical counter. No native Cafe 3D renderer is implied by console tests.
- Focused compatibility browser smoke passed forced WebGL 2 and automatic fallback:
  genuine schema-8 mid-brew fixture, retained device bytes until explicit save,
  schema-9 upgrade, future/content rejection without state publication and resumed
  service/payment. Screenshots: build/evidence/compatibility-{webgl2,automatic}.png.
- Seeds 123 and 456 each ran 24 simulated hours on native Windows and Wasm. Each
  run checked 868 joint checkpoints; rolling/final hashes, final metrics, record
  peaks and canonical snapshot sizes matched exactly across platforms. Both seeds
  peaked at 20,124 Cafe save bytes, four live guests/jobs and 128 ledger entries.
  Scale cases through 1024 queued jobs passed saturation, rebase, conservation and
  retirement; the 1024-job core fixture serialized to 117,556 bytes.
- The existing engine parity runner recorded identical whole/partitioned time
  traces and compared exact snapshots plus ordered events between native and Wasm.
  Traces are in WebEngine/build/evidence/stage16-{native,wasm}.trace.
- npm test passed 8/8; all 16 bundled source hashes, canonical source/test parity,
  script syntax, whitespace, renderer pin and three engine-skill copies passed.

The detailed paired report is build/evidence/stage16-stress-parity.json. Timings
were measured during other local checks and are informational; no stable latency
budget, speedup ratio, process-memory bound or GPU performance follows from them.
Native/Linux CI and full cloud setup were not run here. Hardware WebGPU, physical
mobile, larger rendered crowds and unknown content-family migrations remain
separate release/validation work. Old unstamped saves necessarily assume the
historical default policy; see the compatibility contract for that limitation.
No provider credentials, paid generation, dependency download or pin update was
needed. CI/cloud scripts now include the delivered stress/compatibility checks.

The final full browser, demand and authoring smoke suites also passed both forced
WebGL 2 and automatic fallback. Coverage includes quality expiry/waste, maintenance
refunds and interrupted restore, seating/cleanup/navigation after layout changes,
finance, seeded arrival replay, weighted/failure reviews, scenario reset, read-only
inspection and report download. The malformed-save assertion now checks the new
"damaged" explanation rather than the prior generic "rejected" text. No gameplay
change was needed for that assertion update.
