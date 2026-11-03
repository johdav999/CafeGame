# Garden Café foundation and courtyard (G1–G2)

Garden content selection, compatibility, a connected courtyard and its layout
editor are implemented. [Outdoor customer service is implemented in G3](garden-service.md); the restoration story,
summer menu and final garden art remain later milestones.

## Access and development preview

The normal browser build has no installed/owned garden capability. Menu →
Garden Café explains availability. Expansion saves require both capabilities;
loading them without access preserves the live café and the device save. Start
a separate base campaign or sandbox to play without the expansion. Only an
explicit **Save shift** replaces the device slot.

`garden::Access` is supplied by the host and never read from a save. The future
G7 distribution adapter must verify ownership. There is no checkout or purchase
verification in these milestones. A query parameter or local-storage value
cannot enable the fixture in the normal build.

For local development, configure the browser build with
`-DCAFE_GARDEN_DEVELOPMENT_FIXTURE=ON`. This deliberately supplies installed and
owned capabilities. The resulting build exposes **Garden workshop** in Menu →
Garden Café: a closed, funded sandbox with manual traffic, the courtyard open
and no campaign gates. The release packager rejects fixture-enabled JavaScript.
Reconfigure with `-DCAFE_GARDEN_DEVELOPMENT_FIXTURE=OFF` and rebuild for normal use.

In an owned campaign, use **Select Garden Café**, then **Open courtyard** during
preparation after outstanding tasks and deliveries finish. Both are free in
G2; restoration costs and chapter progression belong to G5. Opening checks the
indoor doorway before accepting the change. Preparation changes become part of
the next opening checkpoint.

## Courtyard building

The courtyard adjoins the east side of the existing café. Its world bounds are
X `[6,12)` and Z `[-5,5)`, with a 12 × 20 half-metre grid. The single connection
joins indoor cell `(23,8)` to courtyard cell `(0,8)` at Z `-0.75m`. Each zone uses
the simulator's footprint/access/reachability validation; the engine waypoint
graph connects them only at that doorway.

Build mode offers **Outdoor table 1** and **Outdoor table 2**, using the existing
table/chair assets and fallback geometry. Each costs 6.00 and resells for 3.00;
moving and rotation are free. Their footprint is 2 × 4m including chairs. Example
anchors for two tables are `(7,-4.5)` and `(7,0.5)` metres, rotation 0. Drag/tap
placement, the floor guide and the keyboard coordinate form support both zones.

All editing requires closed-and-drained preparation or a valid purchase break.
Overlap, out-of-bounds placement, blocked access/doorways and insufficient cash
leave layout and money unchanged. Four indoor plus two outdoor sets are the
structural limit; a third outdoor table and a fifth indoor table are rejected.
The existing **Make room for 4 tables** action arranges indoor furniture only.

The courtyard reuses the reviewed floor/table/chair assets. It is an early
presentation, without final garden walls, foliage collections or weather.
Camera reset frames both zones while open; pan and zoom bounds expand with it.
Idle staff can be sent into the courtyard using the existing manual movement
control. Outdoor table occupancy, guest preferences, delivery and cleaning are
implemented in G3, which extends service demand and occupancy to these tables.

## Content and save contract

`src/garden.hpp` reserves stable expansion, zone, doorway, table/access, recipe,
furnishing, regular and chapter keys. Recipe keys are not registered in the live
five-item base menu. Outdoor layout IDs 101/102 project the two stable table keys;
they do not reuse indoor IDs or existing equipment IDs.

G2 introduced schema 21 / content 18 / rule revision 18, with a bounded garden trailer before
the base content stamp: required-content mask, garden content version/fingerprint,
restoration state, two table placements and purchase/sale counters. Garden content
version 2 fingerprints the reserved catalog, grid, doorway and table prices.
Base saves carry zero garden requirements and an empty courtyard. These content
fingerprints detect compatibility; they do not authenticate purchases.

Known schema-19/content-16 saves migrate without changing base data or their
opening checkpoint bytes. Schema-20/content-17 G1 saves migrate from the locked
garden foundation. Previously supported explicit base migrations remain available.
The live session and opening checkpoints validate with the same host capability;
restart cannot grant ownership or drop required garden state. Unknown content,
invalid garden phases, placements, counter/ledger mismatches and unavailable
required content are rejected before publication or device writes.

The frozen `tests/fixtures/garden-g1-base19.bin` was produced before G1 changes
with `Simulation::startCampaign()` then `openDay()` using the real schema-19 /
content-16 writer. It includes its genuine opening checkpoint. SHA-256:
`d1da77aadf651d99781c4fa71e6581feed4d3fb801376514bb7b9e49312ffc97`.

## Capacity audit and validation

G1 audited `Simulation::seats`, `layout.inc`, equipment table masks, scene table
arrays, `demand.inc`, the browser host and build controls. G2 adds a separate
two-table courtyard grid, six visual table slots, bounded 720-cell navigation
and a packed outdoor picking range 480–719. The base occupancy pool, four-bit
indoor mask and base demand policy were unchanged in G2. G3 extends the pool and
mask to six points while retaining the nine-visitor limit; see the service guide.
Generic grid validation already supports these bounded zone dimensions;
no engine revision change is required.

Build target/test `cafe_garden_foundation` covers access selection, real base-save
migration, schema-20 migration, malformed/unavailable saves, nested checkpoints,
base day-two progression, outdoor bounds, all rotations, doorway protection,
purchase/refund accounting, insufficient cash and six-table restore. Passing the
same native/Wasm executable establishes deterministic hashes for these fixtures.
An optional output-directory argument writes browser fixtures.

`node tools/garden-smoke.cjs` checks the normal browser's unavailable-content
loader on forced WebGL 2 and automatic selection. With an owned development
build, set `CAFE_GARDEN_OWNED=1` for courtyard controls, pointer placement,
rotation, rejection, sale, save/load, six-table restore and actual staff travel
through the doorway. Use the established Playwright `NODE_PATH`,
`BROWSER_EXECUTABLE` and optional `CAFE_URL` environment settings. Evidence is
written under `build/evidence/garden-browser`. Software-rendered checks do not
establish hardware WebGPU or physical-mobile performance.
Set `CAFE_START_SERVER=1` to have the smoke test start and stop its own local
preview server on port 4187. `CAFE_BASE_REGRESSION=1` additionally runs the
extended legacy browser smoke; its outstanding result is recorded below.

## Local validation, 2026-10-30

- `npm test`: all 21 Node tests passed.
- Windows native build passed. CTest `cafe_garden_foundation`, `cafe_simulation`
  and `cafe_campaign_three_days` passed against the final source.
- The focused Wasm build/test passed with the same native hashes:
  selected foundation `9165690798691094916`, base day two
  `14122721463536327312`, six-table courtyard `5196671714181907951`.
  The full Wasm simulation regression also passed during implementation.
- The owned fixture browser journey passed on forced WebGL 2 and automatic
  selection, with both selecting WebGL 2. It loaded reviewed assets, placed
  furniture with pointer/keyboard controls, checked rejection and refunds,
  restored six tables and moved a worker through the connected doorway.
  Reports/screenshots: `build/evidence/garden-browser/owned.json` and
  `*-courtyard.png`. The owned site snapshot is in ignored
  `build/garden-preview/site`; the normal `build/browser` configuration is OFF.
- The normal build's unavailable-content journey passed on forced WebGL 2 and
  automatic selection, including preserved live state/device bytes and rejection
  of the workshop command. Report: `build/evidence/garden-browser/unavailable.json`.
- Release packaging rejected the fixture-enabled JavaScript before creating a
  release archive, as intended.
- The extended legacy `tools/browser-smoke.cjs` did not complete: after its
  opening-cash fixture and pause selector were updated, its 60-second wait for
  a supplier delivery timed out under software rendering (489 simulation
  milliseconds remained). This is an outstanding extended-browser check, not a
  passing result. Native campaign/rule tests and the focused garden journeys
  establish only the coverage described above.

Linux/cloud checks could not run because WSL returned access denied. Hardware
WebGPU and physical-mobile acceptance were not established. No asset generation,
publishing, purchase verification or engine dependency upgrade was performed.
