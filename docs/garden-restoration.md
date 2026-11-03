# G5: restoration campaign and garden regulars

Choose **Menu → Garden Café → Start Garden restoration** during campaign
preparation after completing the base first-paid-service goal. Starting is
optional and requires host-provided Garden ownership. It preserves the campaign
day, money, stock, staff, goals, base regulars and journal. Known base and G1–G4
saves migrate with restoration unstarted; no historical visits or rewards are
invented. Starting in an existing unlocked summer café preserves its recipes.

| Chapter | Required action | Earned once |
| --- | --- | --- |
| Open the courtyard | Open the attached courtyard during preparation | 10.00 |
| A table in the sunshine | Buy an outdoor table and deliver its first paid ticket | 10.00 and summer recipe access |
| Summer on the menu | Install cold preparation and serve iced coffee, lemonade and berry cake | 10.00, Garden sage finish and regular invitations |
| Meet the neighbors | Deliver each new regular's preferred order | 10.00 and party preparation |
| The neighborhood garden party | Complete the full party day and its service targets | 10.00 and the ending |

The normal summer prerequisites still apply: base first-paid and mixed-order
goals, an open courtyard, and a cold station for drinks. The cold station costs
40.00, refunds 20.00 and requires 40.00 earned ticket sales. An outdoor table
costs 6.00, refunds 3.00. Starting restoration in an already unlocked G4 café
retains its summer access; new restoration cafés unlock it after their first
outdoor delivery. All spending uses earned game currency.

Apply the earned Garden sage finish free through **Build → Equipment details
& finishes** while editing is allowed. It reuses the existing counter and
per-instance finish system. It has the same cosmetic/furnishing rules as the
existing finishes and cannot stack another bonus through moving or reloading.

The new neighbors have stable saved identities and one individual visit each
per day. Invite them from the Garden panel during service; ordinary seeded
arrivals also introduce eligible neighbors. They prefer outdoor seating with
the existing indoor fallback, FIFO waits, table service and capacity limits.

| Regular | Preferred recipe | Story |
| --- | --- | --- |
| Astrid, neighborhood gardener | Lemonade | Tends local planters and brings neighbors to the restored courtyard |
| Otto, morning dog walker | Iced coffee | Makes the café a regular stop on his morning route |
| Liv, book-club organizer | Berry cake | Recommends the café as an individual reading spot |

Introductions, returning-guest dialogue and post-party endings follow saved
delivery progress. Visits, reviews, satisfaction, last day and last score persist
independently of Maja, Leo and Nora. Closing an unserved visit remains neutral.
There is no simulated dog or group reservation system. Reviewed existing guest
models and their working walk/seated clips supply stable appearances; this
milestone needs neither a new Tripo model nor a new Mixamo bind. Custom artwork
and the full garden decoration collection remain G6.

Prepare a party between days after the first four chapters. Its checklist is:

- An open courtyard, one outdoor table and the cold station.
- Two available staff with all service roles enabled; hiring costs 15.00.
- Machine condition and cleanliness at least 60%.
- Working stock of at least 6 beans, 6 water, 6 ice, 3 lemon base and 3 cake stock.

Open the day to start an attempt. Use the ordinary ten-minute business clock,
period breaks, bounded arrivals, preparation, delivery and closing. Finish the
full day with at least **6 paid tickets** and **65% average satisfaction on
delivered visits**. A flawless shift, positive profit or perfect review is not
required. The preparation button shows the next unmet condition, and the panel
shows current tickets, average satisfaction, attempt and outcome.

Closing early or missing a target records failure and allows another prepared
attempt on a later day. A failed attempt still has ordinary wages, supplies and
daily overhead. Preparing itself has no entry fee. The ending keeps the café,
courtyard, recipes, earned finish and regulars available for continuing play.

The opening checkpoint contains prepared-party state and the previous attempt
counter. Restart rolls back the whole day: visits, stock, wages, outcomes,
attempt count and rewards. Reopening starts the same numbered attempt. Rewards
post to a dedicated bounded ledger stream using sequential chapter receipts.
Reload, repeated ticks and repeated starts cannot grant a chapter twice.

Saves use schema **24**, content/rules **21**, Garden content **5**; the engine
core remains wire format **1** and its renderer pin is unchanged. The fixed
32-word story record precedes the existing Garden trailer. Its start mode
distinguishes a new restoration from a grandfathered summer café. The joint
loader checks chapter order, ledger reward totals, regular identities/history,
party outcome and checkpoint monotonicity before replacing live state. The
ledger uses its public 18-stream budget to accommodate all base, table and story
streams. Missing ownership preserves the active café and exact device bytes.

Validation entry points are `cafe_garden_story` and
`tools/garden-story-smoke.cjs`, with evidence under `build/evidence/garden-g5`
and `build/evidence/garden-story-browser`. The native/Wasm policy explicitly
uses zero travel and 100 ms decisions. It starts with the frozen base schema-19
fixture, earns purchases, completes all chapters over six days, fails a full
party, retries, checks restart and continues after the ending. The frozen G4
schema-23 fixture separately protects existing equipment and opening saves.
The browser journey uses normal controls and scene travel; it does not speed up
the party clock. Automatic renderer selection separately checks a valid late
party fixture. Software rendering does not establish hardware WebGPU or physical
mobile performance; Linux/cloud acceptance remains separate.

Native/Wasm validation on 2026-10-30 produced matching opening hash
`8626201289303795474` and completed hash `7707914422765489379`. Both completed
all chapters over six days, failed a full party, retried, and completed the
successful party despite an extra cancelled visit. Thus the base flawless-shift
goal is not a hidden story requirement. The reports are saved as `balance.json`
and `balance-wasm.json` in the native evidence directory.

| Six-day balance | Amount |
| --- | ---: |
| Opening cash | 100.00 |
| Ticket sales | 139.00 |
| Garden chapter rewards | 50.00 |
| Base objective rewards | 15.00 |
| Journal rewards | 23.00 |
| Supplies | −63.00 |
| Wages | −42.00 |
| Repairs | −5.00 |
| Cold station | −40.00 |
| Outdoor table | −6.00 |
| Hiring | −15.00 |
| Overhead | −25.00 |
| Closing cash | **131.00** |

Seven focused native CTests, all 21 Node tests and the bundled simulator's 16
source hashes passed. These logical balance results use the declared zero-travel
policy and do not measure renderer speed or actual staff travel time.

The complete browser journey passed on hardware WebGL 2 using Intel Iris Xe /
Direct3D 11. It started from the migrated base fixture, used normal controls to
complete every chapter, served all three regulars with doorway/outdoor/cold-work
travel, failed and retried a party, and finished the ordinary full party clock.
It then verified completion, restart rollback, save/restore and continued play.
Automatic renderer selection used `WebGpuRenderer` for a separate late-party
completion and restore check; that adapter was not inspected. Both runs recorded
zero page errors in `garden-story-browser/report.json`.

The played party ended with 175.00 cash. A native idle-clock continuation from
the browser's own saved party independently agreed on cash, served count,
payment high-water mark and the complete story record. Use the native diagnostic
`cafe_garden_story --finish-idle-party input.save output.save` for that bounded,
drained-party comparison. It advances the same ordinary clock and period breaks;
it does not author service outcomes.

Desktop and 390-pixel completion screenshots were inspected after acknowledging
the ordinary achievement pop-up; neither layout overflowed horizontally. These
checks used quarter-density drawing buffers (274 × 250 in the desktop scene),
so they do not establish full-resolution rendering performance. An initial forced
software-rendered full-clock run timed out and was not counted as a passing run.
Hardware WebGPU performance, physical mobile and Linux/cloud remain unverified.
The owned preview is retained in `build/garden-preview/site`; the standard
`build/browser` is rebuilt with development ownership **OFF**.
The normal-build WebGL 2 and automatic-backend checks both refused the G5 save
without changing the active café or exact stored bytes; both recorded zero page
errors in `garden-story-browser/unavailable.json`.
