# Staff management (milestone 18)

The cafe starts with Alex. Open **Staff and priorities** to hire Sam and Robin,
up to three employees in total. Each hire costs **15.00** immediately, with no
refund on dismissal. Every employee earns **1.00 per full on-shift minute**,
including idle time. The cards show individual work time, wages paid and wages
owed. Breaks, global pause and hidden-tab suspension stop the relevant clocks.

## Priorities and concurrent work

Each person has four priorities: Preparation, Serving, Restocking and Cleaning.
Choose Off, Low, Normal or High. Off excludes new work in that role; existing
work is preserved. Assignment chooses employee/task pairs by personal role
priority, then task urgency, stable task ID and employee ID. It does not abandon
an active task merely because another priority was selected.

- Preparation covers the ticket's recipe chain and machine care.
- Serving covers handover at the counter.
- Restocking covers ingredient collection and timed stock runs.
- Cleaning covers dirty tables, retaining their seating claim until cleaned.

A useful division is Alex on preparation, Sam on serving/cleaning and Robin on
collection/restocking. Extra employees can clean a table or fetch stock while
the preparer works. Every employee has an individual scene actor and travel
binding; missing actors or failed routes cannot imply successful arrival.

There is still **one service counter and one active ticket**, and one preparer
owns that ticket's recipe chain. This milestone does not add simultaneous
customer counters or multiple espresso machines. The existing machine and
ingredient/output claims remain exclusive. Hiring a person does not increase
equipment capacity or allow a ticket to be paid twice.

## Breaks, dismissal and stock runs

An idle employee, collector, server or cleaner can take a break immediately.
Interrupted timed tasks retain their remaining time and can be reassigned to
another eligible person. A break requested during assigned/running drink
preparation is scheduled after the ticket has been prepared. The card says so;
the employee continues to earn wages until the break starts. This preserves
consumed ingredients and equipment claims. The scheduled break can be cancelled.
Cancelling the order also safely releases the preparation and begins the break.

Only an idle worker with no core production claim can be dismissed. Outstanding
team wages must be affordable and settled first. Keep at least one employee.
Retired work time and paid wages remain in the saved accounts; a replacement
starts with zero work time. Names are reused only when their slot is free;
worker IDs remain distinct and monotonic.

Browser restocking now queues a **1.5-second task plus travel**. One stock run
per ingredient can be outstanding; all five ingredients use the same controls.
At completion an atomic inventory transfer moves up to four available portions
into the available preparation capacity. A delayed task cannot create stock or
transfer another task's portions twice. Deliveries retain their separate
eight-second supplier clock, payment and incoming-capacity reservation.

## Accounting and implementation

Individual minute boundaries split simulation updates, so long and short time
steps produce the same wage entries. Unpaid wages reserve cash before hiring or
supplier purchases. Wage payments are distributed deterministically across the
roster, and their sum plus retired payments must match the wage ledger. Hiring
has its own ledger stream and is included in profit and shift reports.

`src/staff.inc` owns hiring, employee priorities, wage allocation and restock
task claims. The game's scheduler retargets queued work through validated
`TaskBoard` snapshots; the engine board still owns dependencies, assignment
tokens, interruption and remaining time. Core production is enabled only for the
employee who owns the preparation task. Rendering/navigation use public engine
APIs. The renderer pin and bundled simulator source are unchanged.

The zero-travel balance host retains its explicit reference policy rather than
pretending to measure physical travel. The stress host now hires three workers,
exercises individual breaks and queues timed stock runs. Focused rule tests
exercise preparation, cleanup and restocking running at the same time.

## Saves and migration

Current saves use **format 11, content version 3, rule revision 3**. Roster IDs,
name slots, role priorities, work/pay totals, scheduled breaks, workflow owners
and pending stock tasks are saved together with the menu, inventory, spatial
claims and ledger. Restore validates the whole candidate, rebases handles and
recreates staff travel before continuing.

The exact known milestone-17 format-10 catalogue migrates to a single employee,
preserving the old wage totals, tasks, products and deliveries. Unknown content
and pre-menu formats 1-9 remain incompatible. Loading never rewrites the device
slot; explicitly Save shift to keep an upgraded save. A genuine prior executable
produced `tests/fixtures/schema10.hpp` with a partly brewed drink and a paid
delivery in flight.

## Checks

The ordinary CTest suite includes `tests/cafe_staff_cases.hpp`: hiring limits,
affordability, role priority selection, concurrent work, breaks, dismissal,
arrears, saved assignments, corrupt roster rejection, old-save migration and
equivalence across time partitions.

With the built site served and Playwright plus a supported browser available:

```sh
node tools/staff-smoke.cjs
```

It exercises roster controls, visible work, partial restore, a deferred break,
handover by another employee, dismissal, accounts and the genuine old-save
migration on forced WebGL 2 and automatic selection. Screenshots go to
`build/evidence/staff-{webgl2,automatic}.png`. Use the same `CAFE_URL`, `NODE_PATH`,
`BROWSER_EXECUTABLE` and `CAFE_DISABLE_WEBGPU` controls as the menu smoke test.
Software-rendered checks do not establish hardware WebGPU or mobile performance.

Local evidence (2026-10-26): Windows Release CTest 4/4, Wasm CTest 4/4, eight
offline Node tests and all 16 bundled source hashes passed. Staffing and expanded
menu browser acceptance passed in headless Edge on forced WebGL 2 and automatic
WebGL fallback. The staff screenshots were inspected for readable controls and
correct roster/handover state. Two six-hour three-person replay runs (seeds 123
and 456) matched native/Wasm saves and deterministic report fields, served 719
and 718 tickets, and passed scale checks through 1,024 queued jobs. Sampled game
saves peaked at 23,081/23,103 bytes; this is not a process-memory or FPS measure.
See `build/evidence/stage18-stress-parity.json` for local results. Linux/cloud,
hardware WebGPU and physical mobile acceptance were not run here.
