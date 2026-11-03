# Equipment and customization (milestone 20)

The four table slots described here are indoors. Owned Garden Café content adds
two outdoor tables with the same staff and stock; see [indoor/outdoor service](garden-service.md).

Open **Build and layout → Equipment and finishes**. Close and drain a sandbox,
or use campaign preparation and the breaks after Morning and Lunch. Guests, staff tasks and deliveries must finish
before changes. Building also works while paused; service remains paused.
For a well-funded sandbox, choose **Layout workshop** in Scenarios and authoring.
It starts closed with 1000.00, no guests, the full menu and no campaign gates.

| Item | Buy / resale | Gameplay effect |
| --- | --- | --- |
| Espresso speed kit | 30.00 / 15.00 | Espresso and intermediate shots take 1.8s instead of 3s. Each shot wears the shared condition meter by 150 instead of 100 and dirties it by 200 instead of 150. Repairs cost 7.50 instead of 5.00. |
| Preparation station | 45.00 / 22.50 | One extra equipment slot; two staff can prepare independent steps of the same mixed ticket concurrently. Both need Preparation enabled. One employee still works sequentially. |
| Storage shelf | 20.00 / 10.00 | Adds 24 stored portions per ingredient, increasing aggregate storage from 24 to 48. |
| Sage / terracotta plant | 2.00 / 1.00 each | +1 percentage point of reputation and +3 attractiveness furnishing points while installed. |
| Brass / forest lamp | 3.00 / 1.50 each | +0.5 percentage points of reputation and +3 attractiveness furnishing points while installed. |
| Forest / oat / honey-oak finish | Free | Cosmetic cabinet/floor palette. |

Installed decor adds up to 3 percentage points to review-based reputation (or
the initial 75%), capped at 100%. Selling removes the item's bonus; moving,
restyling and buying it again cannot accumulate bonuses. Customer review scores
remain unchanged. Content-5 saves migrate to content 6 with these bonuses derived
from their existing layout.

The speed kit fits the fixed counter. Select other items or tables in **Build
item**, choose an anchor and rotation, then inspect the footprint, access marker,
price, resale refund and blocked reason before applying. Move/rotate free.
The station uses a 1.5 × 1m footprint, storage 1 × 1m, and each decorative object
0.5 × 0.5m. Every object also needs clear, reachable access. The floor plan and
the 3D navigation graph use the same accepted layout. Overlaps and blocked
routes preserve the previous state.

Up to four table sets are supported at 6.00 each, with 3.00 resale; two are
included initially. Each set supports one guest party as before. To fit four,
one valid grid arrangement is anchors `(0,10)`, `(6,10)`, `(12,10)`, `(18,10)`
with zero rotation (world anchors `(-6,0)`, `(-3,0)`, `(0,0)`, `(3,0)` metres).
Move the first two before purchasing the last two. Required paths and every
enabled table access remain validated; plants and lamps never add seating.

Campaign purchases also require ticket earnings at least equal to the item's
purchase price. The first paid-service goal unlocks the speed kit, storage and
cosmetics; the mixed-order goal unlocks the preparation station. Extra tables
require the first paid-service goal and at least 6.00 in cumulative ticket sales.
A clean shift is an optional cash challenge and never blocks extra seating. Existing cash
must cover the purchase after owed wages. Upgrades and resale are included in
daily results and lifetime cash flow, with their own ledger entries.

Both brewing positions use the same condition meter and the selected speed tier.
Care is exclusive with active service. Selling a speed kit retains wear and dirt;
it cannot repair the machine for free. Selling the prep station requires drained
work. Empty the extra storage shelf before selling it; existing preparation and
main storage stock are retained. Supplier deliveries reserve one shelf at a
time, so an Order 12 needs twelve free spaces in one shelf. Staff stock runs keep
their chosen source across travel, interruptions and saves.

## Persistence and validation

In Build mode, drag a Buy/Move item button onto the cafe floor and release to
place it. The pointer label reports whether the drop is valid; the floor-plan
preview shows the snapped footprint. Q rotates and Escape cancels. Selecting an
item then using Place in scene also supports tap-to-place; the coordinate form
remains available for keyboard placement. New items are charged only when the
existing purchase transaction accepts the drop. Invalid drops and cancellation
leave cash and installed furniture unchanged. The fixed espresso speed kit uses
its existing upgrade button.

`tools/build-placement-smoke.cjs` checks pointer purchases, invalid drops and
cancellation on forced WebGL 2 and automatic renderer selection.

### Mobile Build mode

Phones, tablets and narrow windows use a furniture drawer with Tables, Decor
and Equipment categories. Cards show price or ownership; **Move furniture**
filters to owned items. The drawer scrolls normally with touch. Free cabinet
finishes and installed equipment controls remain under Equipment; plant and
pot selections remain under Decor.

Tap an item to collapse the drawer and reveal the full scene. Tap the floor
to preview a snapped footprint, use **Rotate 90°**, then choose **Place** or
**Move**. Previewing and rotating never charge cash. Confirmation rechecks the
existing layout, route, campaign and available-cash rules before submitting the
same game command as desktop placement. Only an accepted snapshot reports
success. **Cancel** or **Furniture** discards the draft; selling an owned item
requires a separate confirmation with its refund. **Done** returns to Serve
without opening the café automatically. Closing, draining and pause requirements
are shown directly in the drawer.

The browser presentation is in `web/mobile-build.js` and `web/mobile-build.css`,
with shared draft/command handling in `web/build-placement.js`. It reuses the
existing ImageGen item artwork and world-aligned placement guide. Landscape
uses a right drawer; portrait uses a bottom drawer. Safe areas, 44px controls,
category keyboard navigation and live placement feedback are supported.

Run `node tools/mobile-build-smoke.cjs` with Playwright and
`BROWSER_EXECUTABLE` configured (optional `CAFE_URL`). It checks explicit
purchase confirmation, duplicate confirmation, invalid positions, rotation,
free moves, cancellation, sales/refunds, closed-café gating, finishes and
responsive layouts on WebGL 2 and automatic backend selection. Screenshots and
results go to `build/evidence/mobile-build/`. Browser emulation does not
establish physical-device performance or touch acceptance.

Envelope 15 / content 6 / rule revision 6 records equipment ownership and IDs,
catalog purchase/resale counts, finishes, four-table placements, storage source
selection, the table mask before occupancy restoration, and the optional second
preparation workflow. All core stock, ledger,
placement and equipment changes are validated in a detached session before
publication. Failed purchases, moves and sales preserve durable state.

Known menu (10), staff (11) and campaign (12) saves migrate. Old campaign phases,
regulars, rewards and nested opening checkpoints remain valid. Migration adds
the new empty storage inventory and immutable fast-recipe definitions through
public engine APIs. It supplies no owned upgrades or cash. Stored device bytes
remain unchanged until explicit Save. Unknown content remains incompatible.
Equipment-family format-13 snapshots also migrate, including paid guests
waiting behind occupied tables. Older table masks are reconstructed from claims
and checked against the layout without promoting a guest during restoration.

The renderer pin and bundled simulator are unchanged. Visuals use existing
primitive meshes and public scene/material/navigation APIs; no paid generation,
runtime credentials or new renderer internals are needed. Approved production
art, room expansion and multiple locations remain outside this milestone.

`cafe_simulation_tests` covers exact speed/wear, concurrent workers/stations,
source-preserving stock runs, four occupied tables, refunds, rejects, campaign
gates, partial restores and a genuine campaign-12 fixture. `cafe_equipment` runs
ten minutes of upgraded three-worker service with periodic canonical restores;
its deterministic report can be compared between native and Wasm. These are
zero-travel rules checks, not hardware or player-balance measurements.
`tools/equipment-smoke.cjs` exercises actual browser controls and physical travel
on forced WebGL 2 and automatic fallback. Hardware WebGPU, physical mobile and
Linux/cloud require their own validation.

Local validation, 2026-10-26: six Windows Release CTests and six Wasm/Node CTests
passed. Native/Wasm three-day campaign reports match exactly (hash
`16678915056995573959`), as do upgraded ten-minute reports (hash
`10885161682343944182`, 22 services, three employees, four tables, 48-portion
storage, peak save 12,024 bytes). These hashes cover deterministic state, not
wall-clock speed. Eight offline tool tests and all 16 simulator source hashes
passed. Both rendered equipment acceptance paths passed: forced WebGL 2 and
automatic WebGL fallback in headless Edge. Room/catalog screenshots in
`build/evidence/equipment-*-webgl2.png` were visually inspected. No cloud,
hardware WebGPU or physical-mobile results are claimed.

## Plant and pot styles (2026-10-28)

Build and layout includes four Tripo foliage models (snake, rubber, jade and
monstera) and three pots (terracotta, fluted oat and sage cylinder), giving 12
combinations. Select either existing plant set under Plant and pot before or
after purchase. Styling is free while layout editing is available; prices,
footprints and furnishing points are unchanged. The fixed corner plant uses
rubber foliage and the oat pot. Format 15 saves preserve both purchased sets;
format 14 saves migrate with default styles.

Validation: native cafe_simulation passed, including all combinations, save
migration and edit gates. The browser plant-styles smoke passed all combinations
and save/load on WebGL 2 and WebGPU. Screenshots: build/evidence/plants.

## Make room for four tables

The starter table positions can fragment the dining floor after a third table
is added. In Build, **Make room for 4 tables · Free** stages all four complete
table-and-chair footprints and validates their access routes together, then
moves only owned tables into those positions. Plants, lamps, equipment, cash
and inventory are untouched. Future table slots stay empty until purchased.
The action is available during empty preparation or period breaks. It selects
the next missing table and shows green legal placement positions when affordable.
If dining-area decoration blocks the supported layouts, the action explains
what to move and applies no changes. Layouts persist through normal saves.
