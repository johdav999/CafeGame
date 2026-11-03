# Indoor and outdoor service (Garden Café G3)

G3 enables seating, order collection, delivery, dining and cleaning at the two
courtyard tables. It reuses the three-person staff limit, preparation stations,
stock reservations, whole-ticket payment and review rules. No recipes,
equipment tiers or assets are added in this milestone.

## Playing

Open the courtyard and place outdoor tables through the
[foundation controls](garden-cafe.md). Each set provides one party seat, for up
to four indoor and two outdoor tables. Staff share their existing preparation,
serving, restocking and cleaning priorities across both areas. Outdoor walks
consume normal service time; additional seating does not add machine capacity.

House regulars prefer indoors. Espresso enthusiasts prefer outdoors when the
courtyard is open. Practice guests can use **Seating preference** to choose a
zone or keep the profile preference. Guests fall back to a free table in the
other area. Existing table waiters retain arrival order; a new preference never
jumps the queue. Takeaway guests keep their separate FIFO counter queue.

Tickets show the preference and destination, such as **Prefers outdoors ·
Outdoor table 1**. Staff status names the table. Written reasons explain walks,
full/dirty tables and work waiting for eligible staff. Use the same guest badges
and **Take order → Prepare → Serve** controls in either area. Several orders
can be collected and prepared deliveries can overlap the next preparation.

Outdoor guests use the existing patience, freshness, satisfaction and dining
timers. Seats stay claimed during departure and cleaning. Closing drains both
areas before results and overhead settle. Building and resale still require a
closed, drained café or a valid purchase break; occupied or dirty tables cannot
be moved or sold.

## Bounds and persistence

The one occupancy pool has six stable points: 0–3 map to indoor IDs 1–4; 4–5 map
to courtyard IDs 101–102. Disabled points retain their identities. The game
selects a preferred free zone using a detached public occupancy-pool copy,
temporarily masking only unclaimed alternatives. Existing points and arrival
tokens remain stable. The engine pool owns FIFO promotion and exclusive claims.

Enabled seating feeds existing attractiveness, admission and arrival pacing.
Automatic arrivals remain bounded to nine guest records, at most two table
waiters and the three-position takeaway queue. Authored/native fixtures may
bypass the appeal gate as before, but cannot exceed nine records. No group
seating or reservations are introduced.

Schema **22**, base content/rule revision **19**, and garden content **3** save
guest seating preferences and a six-bit early seat mask. Claims, task ownership,
prepared tickets, dining and cleaning validate together before publication.
The engine pin and simulator core snapshot format are unchanged.

Known schema-21/content-18 G2 saves migrate courtyard layouts and active indoor
visits while retaining assigned destinations and deadlines. Newly enabled
outdoor points may promote older table waiters. G1 and earlier supported base
migrations remain explicit. Invalid preferences, masks/layouts or missing access
are rejected without replacing the live café or device bytes. Opening
checkpoints use the same host capability; restart rolls back wages, payments,
reviews and rewards with the rest of the day. Restored routes are rebuilt from
claims/tasks; transient actor positions are not save data.

`tests/fixtures/garden-g2-indoor21.bin` was captured with the genuine G2 writer
before G3 changes. It contains two outdoor furnishings, two indoor claims and
an assigned order-collection task. SHA-256:
`fe7719628ea8ca8f6e850c10f6185a9caf6e6e4a416f6729a14642a35aa126d6`.

## Validation

Target/test `cafe_garden_service` covers frozen migration, preference/fallback,
stable tokens, FIFO promotion, bounded demand and malformed preferences. Its
four-guest campaign uses three staff, nonzero wages, a staff break, restored
collection/delivery/prepared/dining/cleaning stages, one payment per ticket,
closing and checkpoint replay. It is explicitly a **zero-travel, 100 ms** policy.
Run it with an output directory to create browser fixtures:
`cafe_garden_service build/evidence/garden-g3`.

`node tools/garden-service-smoke.cjs` uses those fixtures in an owned development
preview. Supply the established Playwright `NODE_PATH` and `BROWSER_EXECUTABLE`.
Set `CAFE_START_SERVER=1` for a temporary server on port 4188, or use `CAFE_URL`.
The test exercises actual doorway travel, normal controls, paused stage saves,
outdoor dining/cleaning, closing and restart on forced WebGL 2 and automatic
selection. Reports/screenshots go to `build/evidence/garden-service-browser`.
Set `CAFE_GARDEN_OWNED=0` against the normal build to check non-destructive
rejection of an active G3 save instead.

Development ownership remains a build option, unavailable through save bytes or
URL flags and rejected by release packaging. Normal builds keep it OFF; purchase
verification belongs to G7. Hardware WebGPU, physical-mobile performance and
Linux/cloud evidence must be reported separately from local checks.

## Local results, 2026-10-30

- All 21 Node tests passed. Windows native `cafe_garden_service`,
  `cafe_garden_foundation`, `cafe_table_service`, `cafe_simulation` and
  `cafe_campaign_three_days` passed.
- The final G3 native and Wasm scenarios both served four tickets with three
  concurrent staff. Opening hash: `14783761631407294783`; closing-summary hash:
  `10823272821505669178`. Nonzero wages, sales and overhead reconcile.
- The owned browser journey passed on forced WebGL 2 and automatic selection.
  Both reported WebGL 2. It recorded actual guest/staff doorway travel, three
  concurrent staff, four receipts totaling 1700 minor units, seven paused restore
  stages, outdoor cleaning, complete closing and restart, with no page errors.
  Desktop and 390px viewport screenshots were inspected; a viewport check is
  not a physical-mobile performance result.
- The tested owned site is preserved in ignored `build/garden-preview/site`;
  normal `build/browser` is configured with development ownership OFF.
- The normal build rejected the active G3 save on both renderer selections,
  preserving live tickets, cash and stored bytes with no page errors. Evidence:
  `build/evidence/garden-service-browser/unavailable.json`.

Linux/cloud checks were not run in this Windows task. Hardware WebGPU and
physical-mobile acceptance remain outstanding. The earlier extended legacy
browser-smoke delivery timeout is recorded in the G1–G2 guide; it is not counted
as a passing G3 check. No paid asset generation, publishing or engine upgrade
was performed.
