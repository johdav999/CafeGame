# Stage 8: queue, service and seating occupancy

The browser starts with three guests. Brew serves the front of a three-position FIFO queue; the other guests advance toward the counter. Welcome guest adds a new arrival when queue and guest limits allow. There is one exclusive counter position and two exclusive seats. After Serve, a guest reserves a seat, walks to it and stays for an order-dependent duration before leaving. When seats are full, requests wait FIFO at the waiting area. Departure, cancellation, patience expiry and movement failure release spatial claims. The barista still uses production's worker/station reservations.

## Current dining durations

| Item | Consumption time |
| --- | --- |
| Espresso | 15 simulation seconds |
| Americano | 20 simulation seconds |
| Latte | 25 simulation seconds |
| Tea | 25 simulation seconds |
| Croissant | 30 simulation seconds |

Two-item orders add the two durations: espresso with a croissant is 45 seconds;
latte or tea with a croissant is 55 seconds. Dining-in guests keep their table
for the complete stay and through departure/cleanup. Takeaway guests do not
reserve a table. In table service, sitting while waiting for an order or food
does not consume eating time: the full duration starts on successful delivery.
Counter-service dining starts after the served guest reaches the chair.

The remaining duration is persisted. Schema 19 upgrades older eight-second
timers proportionally, preserving each visit's remaining fraction rather than
restarting it. Save validation checks the timer against the actual ordered
items. `cafe_table_service` covers all items, mixed/reversed orders, waiting,
table ownership, cleanup, save/load, malformed timers and old-save migration.

The portable engine/simulator/occupancy.hpp implements OccupancyPool<Owner>. Compact mode shifts a standing queue forward; stable mode keeps assigned seat/equipment points fixed and promotes oldest waiters into free slots. Requests are bounded; retries preserve priority. A claim holds a target before arrival and becomes occupied only when the matching owner/point/token reports arrival. Changed queue positions and restore invalidate stale tokens. A WorkerId pool supports equipment access without making the helper depend on scene/navigation code.

CafeGame owns point geometry and the guest lifecycle. It uses engine PathFollower and CharacterMotorComponent with authored routes. Logical occupancy prevents duplicate targets; it does not provide crowd collision avoidance, dynamic layout edits or arbitrary navigation surfaces. A missing guest abandons/leaves and releases claims. Actor handles and navigation requests are rebuilt after load.

## Saves and tests

Cafe save format 2 persists guest phases, remaining seated time, queue order, counter/seat claims and occupied state together with wallet and the existing core bytes. Candidate load validates customer states, queue order, unique point ownership and layout bounds before publishing. Previous format-1 cafe saves are explicitly migrated. Core runtime snapshot schema remains 1. The storage slot remains cafegame.shift.v1 for compatibility; its encoded payload contains its own version.

The console shares these rules and explicitly reports immediate preparation/seating. A host can call welcome, brew(false), serve(false), seated and departed to use real movement. Native and browser tests use the same portable occupancy helper; local native execution remains a separate validation gate.

Contract coverage includes contention, FIFO promotion, stable seat ownership, record limits, duplicate requests/releases, stale queue arrivals, stale restore arrivals, invalid restore preservation, worker access, queue expiry/departure cleanup, seat timers, wallet consistency, spatial save roundtrip and legacy migration. Browser acceptance covers visible movement, queue refill, service, dining, release after departure and reload while seated.

Validation (2026-10-25): complete cafe_game Wasm build passed. Engine standalone CTest 4/4 and 814 contracts passed in Node and Edge 156 with no browser errors. Cafe simulation CTest passed, including queue/seat lifecycle, stale arrival, invalid restore, full spatial roundtrip and format-1 migration. All four tooling tests, eight bundled-source hashes, JavaScript syntax and diff whitespace checks passed. The expanded browser smoke passed forced WebGL 2 and automatic software fallback: travel pause/load/cancel, queue refill, counter exclusivity, serving two guests, seating, departure cleanup and restoring seated state without duplicate reward. Screenshots are in build/evidence/*-seating.png. Native Windows/Linux execution, full Linux cloud setup, hardware WebGPU and physical mobile checks were not run. No renderer pin update, paid generation, commit or push was performed.
