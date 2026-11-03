# Stage 14: customer demand and satisfaction

New browser shifts have automatic foot traffic. **Pause foot traffic** holds its countdown; **Resume foot traffic** continues it. Global pause and hidden tabs stop simulation time. Closing the cafe holds arrivals and clears waiting guests neutrally; the current order can still finish. **Manual guest** chooses a profile for the existing **Welcome guest** button. Brewing retains the prototype's regular-guest shortcut when the queue is empty. Headless sessions default to manual traffic, so tests and console scenarios remain explicit.

| Profile | Queue + service patience | Wait / coffee / cleanliness / preference weights | Behavior |
| --- | --- | --- | --- |
| House regular | 120 seconds | 30 / 40 / 20 / 10 | Prefers a seat; balances service and quality |
| Commuter | 90 seconds | 55 / 25 / 10 / 10 | Takes coffee away, freeing seats |
| Espresso enthusiast | 150 seconds | 10 / 65 / 15 / 10 | Prefers a seat; values fresh coffee most |

The first automatic visit is due after 12 simulation seconds. Later intervals are `30000 - reputation*10 + uniform(10001)` milliseconds, where reputation is on a 0-1000 scale. A new cafe starts at 750; thereafter it is the integer lifetime review average. Good reviews bring slightly faster traffic. Full queues/floors miss a visit and schedule another; they never overflow the three-person queue or eight-guest floor limit. Missed visits have no review. Closed and disabled traffic consume neither countdown nor random values. There is no offline catch-up burst.

Every paid delivery records one review. Its inputs are remaining patience, actual coffee freshness/production quality, cleanliness and preference fit. Cleanliness is the lower of machine cleanliness and `1000 - 250*dirtyTables`, clamped to zero. A commuter's takeaway preference scores 1000. Other guests score 1000 for available seating, 250 when seats are reserved, or 300 when the cafe has no tables. The score is the integer weighted mean for that profile. Coffee prices remain 5.00; ratings create no extra payment, tip or refund.

Cancellation, patience expiry, stale coffee and other departure without coffee record one zero review. Repeated leave/cancel/serve responses cannot duplicate it. Closing clears queued guests without a review. Delivery records the review alongside the already prepared Ledger/core payment; retirement removes the guest but retains bounded lifetime totals. The HUD shows profiles, per-guest patience, review count, average reputation, missed visits and the latest score breakdown. Recipe variety, repeat-customer identities, price elasticity and richer emotions remain future game policy.

The reusable `engine/simulator/demand.hpp` contains explicit seeded `DemandRandom`, `ArrivalTimer`, weighted `satisfaction` and linear `patienceScore`. They are portable values with no clock, scene, Runtime, profiles, IO, ledger or review ownership. Randomness uses nonzero xorshift32 state and integer rejection sampling over its actual domain, with a draw watermark and atomic failure. The game copies a candidate stream, draws profiles only for admitted automatic guests, and publishes it with the scheduled interval. Rendering, manual guest selection and failed manual commands consume no random draws. The default seed is fixed for repeatable new shifts; callers can restore another nonzero typed seed.

Simulation advance stops at arrival, customer deadline, freshness and dining boundaries before processing later visits. This makes arrival/profile randomness and review-driven cadence independent of render-frame partitions. Actor navigation still owns actual arrival; stepping a large headless delta does not invent browser travel. The core owns the shared queue/service patience deadline and delivery-before-expiry rule.

Envelope 8 appends traffic/countdown, RNG state and draw count, admissions/missed visits, successful/failed review counts, cumulative score, baseline pre-stage-14 sales, last review inputs and per-guest profile/creation-time/patience/outcome. Candidate load validates profile indices and patience budgets, matching core deadlines/states, bounded totals and paid-service/review arithmetic before publishing. Formats 1-7 preserve the original regular deadlines and finances, start with manual traffic and have no retroactive reviews. Historical terminal guests are neutral; the new admission counter begins with the live guest count. Core wire schema 1, renderer pin and localStorage slot remain unchanged.

The diagnostic console adds `traffic` and `guest PROFILE` (0 regular, 1 commuter, 2 enthusiast), using the same portable game rules. Tests cover golden random vectors, invalid/overflow draws, timer/scoring boundaries, expiry, preferences, takeaway, review idempotency, capacity, closed/disabled clocks, save/load continuation, frame partitions, rejected saves and legacy migration. `tools/demand-smoke.cjs` checks rendered customer behavior and future random replay on both browser paths. The complete cloud check now runs that scenario as well as the existing browser regression.

Validation on 2026-10-25: final WebAssembly browser and console builds succeeded. CafeGame simulation CTest passed 1/1 after the event-boundary changes; WebEngine standalone CTest passed 4/4. Generic contracts passed in Edge 156 without browser errors. The console preserved a commuter's one 96.6% review, 55.00 cash balance and arrival countdown through save/load. Four offline tooling tests, all 14 bundled source hashes, canonical/bundled demand API/test parity, JavaScript syntax and whitespace checks passed. All three actual engine-skill copies document the new contracts.

Rendered demand scenarios passed forced WebGL 2 and automatic software-renderer fallback. They verified closed/global-pause countdowns, seeded automatic profiles, weighted positive reviews, commuter takeaway without seat claims, exactly-once cancellation reviews, saved outcomes and identical future visitor/random progression after replay. Cash totals matched sales and costs. Screenshots are build/evidence/webgl2-demand.png and build/evidence/automatic-demand.png; the WebGL 2 screenshot was visually inspected.

The complete earlier-stage rendered regression also passed both browser paths on envelope 8: service/save/load, supplies, finance identities, coffee expiry/waste, cleaning, repair prepayment/refunds, interrupted maintenance restore, placement preview rejection, move/rotate/sell/buy, layout reload and moved-table seating/cleanup. Pause/resume selectors identify the exact control alongside the new traffic buttons.

Native Windows/Linux execution, the complete Linux cloud environment, hardware WebGPU and physical mobile performance were not validated in this run. No renderer pin change, paid generation, commit or push was performed.


## Small-cafe arrival balance (2026-10-29)

Updated by rules 14 below: the intervals in this section are the starter baseline.

Automatic dine-in arrivals are admitted only while fewer than two guests are
waiting on a table claim. Occupied and reserved table claims are separate from
those two waiting places. This limit applies to future automatic arrivals at any
cafe size; the existing three-person takeaway counter queue remains independent.
Manual practice/authoring admissions retain their explicit fixture limits.
Capacity-blocked walk-ins do not become guests or receive patience deadlines or
failed reviews; the existing missed-demand statistic records the skipped attempt.

With one or two tables, subsequent automatic arrival intervals are
45000 - reputation * 10 + uniform(0..10000) simulation milliseconds (35–55 seconds
over the full reputation range; 37.5–47.5 seconds at the initial reputation).
With three or four tables the previous 30000 base returns. The authored first
arrival timer is unchanged. Profile selection and jitter remain deterministic,
and the table-queue check does not mutate claims or evict existing guests.

Content/rule revision 12 explicitly migrates revision-11 schema-19 saves, retaining
current guests, finances and the already scheduled arrival timer. Existing larger
queues drain naturally; new automatic dine-in admissions wait for space. Native
coverage checks 100 arrival attempts, renewed admission after a table releases,
the independent takeaway queue, expanded-cafe timing, partition determinism and
save migration. Browser evidence: build/evidence/arrival-balance/report.json.


## Attractiveness visitor capacity — rules 13 (2026-10-29)

Normal admissions now share a cafe-wide visitor cap, covering both table and
takeaway guests. Attractiveness 30 or lower permits 2; the cap increases at each
whole ten-point threshold: 40→3, 50→4, 60→5, 70→6, 80→7, 90→8, 100→9. Scores
between thresholds use the lower tier. Staff do not count. Walking-out guests
count until they have actually departed. The independent two-person table wait
limit and three-person counter queue still apply.

New practice/preset and campaign games start at 30: menu 10/25, experience 10/50,
furnishings 10/25. The initial morning and rush presets contain two guests.
The starter menu contributes ten points; extra unlocked recipes establish their
remaining fifteen-point bonus over ten successful visits. Experience starts at
ten and blends toward the reviewed score over ten reviews, with a current-wait
penalty. Two starter tables give ten furnishing points; more tables, decor and
finishes increase this to twenty-five. Their total can reach 100 in both
practice and campaign play.

The cap is checked by automatic arrivals and every player admission adapter.
Low-level welcome() remains an authored/native-fixture primitive; player routes
explicitly request the attractiveness check. No existing visitor is evicted if
appeal falls or an older crowded save is restored; further admissions stop until
there is room. The runtime and bounded save loader now support nine visitors.
Rules-12/schema-19 saves migrate explicitly to rules 13 without losing their
guests, finances or scheduled arrival.

## Attractiveness arrival cadence — rules 14 (2026-10-29)

Previously attractiveness increased capacity but did not increase foot traffic.
A two-table cafe could allow five visitors while still admitting only one every
35–55 seconds, leaving little overlap when takeaway guests were served quickly.
Newly scheduled intervals now use `max(6000, starterInterval * 2 / visitorLimit)`
simulation milliseconds. The existing reputation adjustment and seeded jitter
are preserved. At score 60–69 with reputation 600, this means 15.6–19.6 seconds
instead of 39–49 seconds; score 30 retains the original starter cadence.

This is an arrival rate, not a guaranteed occupancy. Visitor capacity, two table
waiters, three takeaway queue places, disabled traffic and period-end closures
still gate admission. Existing guests are never evicted. Schema-19/rules-13 saves
migrate explicitly, preserving the pending countdown, guests, money and RNG.
The new rate applies when the next interval is scheduled.

The native demand regression checks natural concurrent arrivals around 65 appeal,
frame partition invariance and the previous-save migration. The
`cafe_appeal_traffic_fixture` target produces a validated two-table, 63-appeal save
after six actual paid visits for `tools/appeal-traffic-smoke.cjs`.

Native coverage includes every threshold, between-tier values, a combined
dine-in/takeaway cap at 30, renewed admission after departure, actual deliveries
and furnishing purchases that reach 100, nine-visitor save/load and known-rule
migration. Browser coverage: tools/appeal-capacity-smoke.cjs; evidence under
build/evidence/appeal-capacity.

## Recovery-friendly seating and patience (rules 15)

Attractiveness still sets the overall visitor cap (30: 2, through 100: 9).
Admission also respects usable tables plus at most two waiting dine-in guests,
with a separate three-guest takeaway allowance including the service counter.
Dine-in profiles are held outside when no tables are installed; excess demand
never creates a failed review. Dirty/claimed tables remain unavailable through
cleanup. Native authored fixtures may explicitly bypass admission policy.

New dine-in visits have 180 seconds to reach their table. Once seated they get
a fresh service allowance: 120 seconds for regulars and 150 for enthusiasts.
Takeaway guests keep their 90-second counter/service allowance. Satisfaction
and UI timers use the active stage; table waiting does not reduce the service
wait score. The saved guest phase timer stores table waiting, then service
waiting, then the existing product-dependent consumption duration after payment.
The core deadline is a hard bound across both waiting stages.

Known rules-14 and earlier saves retain existing guest deadlines, layouts,
progress and opening checkpoints. Only new visitors adopt the split timers.
The schema stays 19; the content/rule revision is 15.
