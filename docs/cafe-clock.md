# Cafe hours and period breaks

The HUD shows the business day, 24-hour time and current period:

| Period | Opening hours | Active play |
| --- | --- | --- |
| Morning | 08:00–12:00 | 4 minutes |
| Lunch | 12:00–14:00 | 2 minutes |
| Afternoon | 14:00–18:00 | 4 minutes |

One second of active service advances the business clock by one minute. The
existing ten-minute campaign shift therefore covers the complete ten-hour day.

At 12:00, 14:00 and 18:00, the clock stops exactly at the boundary and the cafe
closes to new arrivals. Accepted tickets, seated guests and cleanup finish first.
The HUD says “finishing service” during this drain. It then shows a purchases
break with an explicit Start Lunch, Start Afternoon or Start day button.

During the break, business time and wages stay stopped. Players can buy and move
available furnishings, hire staff, order supplies and perform maintenance.
Deliveries, restocking and care may finish while business time remains frozen.
These are planning breaks, distinct from the Pause button that freezes all work.
Campaign unlocks and affordability rules still apply. Furniture placement still
requires an empty cafe with no outstanding preparation work.

In campaigns, 18:00 uses the existing closing and day-summary flow. Prepare the
next day to shop, then Open day to begin at 08:00. Early closing still produces a
partial-day summary. Full-shift objectives use actual business service time,
excluding period breaks and closing cleanup.

Clock state is saved with the game. Older practice saves retain their cafe and
orders and begin the new business clock at Day 1, 08:00. Older campaign saves
infer the current time from that day's previous service elapsed time; already
passed period boundaries are not replayed. Existing checkpoints remain usable.

Native schedule checks cover exact boundaries, prevention of clock overshoot,
free planning time, purchases, draining tickets, malformed saves and migration.
`cafe_schedule_fixture` produces near-boundary saves for
`node tools/day-clock-smoke.cjs`, which exercises the actual browser clock,
continuation controls, purchases, campaign transitions, save/load and mobile HUD.

The clock now offers **Build & shop** during preparation and each daytime
intermission. It opens the draggable build catalog without resuming service.
The next-period button waits for any new delivery or preparation tasks to
finish; building uses the same validated footprints and access routes.
