# Daily campaign (milestone 19)

Refresh the browser build and choose **New campaign**, then **Open day**. The
opening scenario and authored presets are still independent sandboxes;
Quiet practice keeps the full menu. Starting either mode replaces the current
session. The device slot changes only with **Save shift**.

Campaigns start with 100.00, one employee, 24 beans and 12 of each other raw
ingredient at preparation. Service lasts ten minutes of simulation time; pause
and hidden tabs stop it. Preparation allows supplies, care, hiring and layout
editing without wages. Finish preparation tasks and deliveries before opening.

At closing, arrivals stop. Existing queued tickets remain available to prepare,
and active orders, dining, departures, deliveries and tasks drain normally.
Machine cleaning queues automatically after the final ticket. Resume staff and
enable the appropriate priorities if closing work is waiting. **Close day early**
uses the same drain process, but cannot earn the full-shift clean objective.
Layout's close control closes the campaign day; it cannot reopen a closed day.

The results screen freezes time, wages and gameplay spending. It shows sales,
net supply purchases, wages earned (including arrears), net repairs, furniture,
hiring, discarded item count, satisfaction and operating profit. Rent is 3.00
and utilities 2.00 per day, charged once at summary. Objective rewards are shown
in the ledger and excluded from operating profit. Unpaid wages/overhead are
visible and block the next day. A solvent loss permits continuing.

Objectives each pay 5.00 once per campaign. Clean shifts and profitable days
are independent optional bonuses, rather than a chain that blocks expansion:

1. First paid service unlocks americano.
2. A paid ticket with two different items unlocks latte and tea.
3. A full ten-minute shift with at least one paid service, no disappointed
   visits, no discarded items and clean equipment at summary earns the optional
   clean-shift bonus. It does not gate recipes or furnishings.
4. A day with positive operating profit completes the starter progression.

Espresso and croissants are available initially. Automatic demand uses unlocked
recipes; manual tickets also respect locks. Maja prefers espresso, Leo americano
and Nora latte. Their seeded returning visits use espresso until the preferred
recipe is available. The regulars panel saves visits, reviewed satisfaction and
last visit score; tickets display their names and actual orders. No dialogue or
generated assets are required.

**Prepare next day** carries stock, employees, cash, recipes and regulars forward
once, resetting only daily reporting baselines. The prototype is bounded to 365
days. **Restart day** restores the checkpoint captured immediately before the
latest opening: all subsequent sales, purchases, wages, goals and visits roll
back together, returning to preparation. Preparation changes made before opening
are retained. This allows recovery without repeating reward payments in the
same history. **New campaign** supplies a fresh starting state at any time.

## Persistence and validation

Envelope schema 14 / content version 5 / rule revision 5 saves campaign phase,
day, baselines, goals, regular history and a bounded nonrecursive opening
checkpoint. Runtime wire format remains 1; renderer pin is unchanged. Known
schema-10 menu and schema-11 staff saves migrate into unrestricted sandbox mode.
Milestone-19 schema-12 campaigns and their opening checkpoints migrate with
progress intact; [milestone 20](game-equipment.md) adds saved equipment and finishes.
Unknown content and inconsistent progress are rejected before replacing the
session or device slot. There is no offline catch-up or automatic device rewrite.

`cafe_simulation_tests` covers progression, restart, frozen summaries, locks,
closing, malformed saves and genuine schema-11 migration. `cafe_campaign` runs
three days with the deterministic 100 ms zero-travel reference manager, restores
each summary canonically and exports a final hash. Passing a writable evidence
directory also writes service/closing/summary snapshots for the rendered browser
acceptance script `tools/campaign-smoke.cjs`.

The reference manager verifies rules and native/Wasm parity; it does not measure
physical navigation throughput, GPU performance or ten-minute player balance.
Record actual checks and remaining platform gates in the implementation report.

Milestone-19 validation on Windows, 2026-10-26: all five Release CTests and all five Wasm/Node
CTests passed, including a one-hour sandbox checkpoint replay and the three-day
campaign. The three-day native and Wasm reports match exactly, including final
hash `15390211562178144214`: 22/22/23 tickets, operating profits 107.50/86.50/92.50,
15.00 total overhead and 20.00 total objective rewards. These are reference-policy
results, not measured player earnings. Offline tool tests passed 8/8 and all 16
bundled simulator hashes matched.

Rendered campaign acceptance passed forced WebGL 2 and automatic WebGL fallback
in headless Edge: physical service, partial restore, unlock/reward, restart,
closing restore, frozen summary, next day and genuine schema-11 migration.
`build/evidence/campaign-webgl2.png` was visually inspected. Linux/cloud,
hardware WebGPU and physical mobile were not validated in this local task.
