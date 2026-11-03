# Cafe journal

In a campaign, choose **Café journal** in Serve, or open **Menu → Café journal**.
The book shows three optional daily goals, live progress and eighteen lifetime
achievements. A new campaign starts a new journal; sandbox sessions have no journal
rewards. Opening the journal does not pause service. Use Pause when needed.

Each day selects one goal from each group, using the campaign day rather than
random draws:

| Group | Rotating goals |
| --- | --- |
| Service | Serve 3 tickets; serve 2 mixed tickets; serve 5 tickets |
| Hospitality | 3 visits at 80% satisfaction; serve 3 distinct items; satisfy a named regular at 80% |
| Care | No discarded items; clean machine at closing; positive operating profit |

Care goals require all ten minutes of business time and at least three paid
tickets. Business time stops at period breaks. Early closing can bank completed
service/hospitality goals and achievements, but cannot earn full-shift goals.
Missing an optional goal has no penalty. Recipes retain their existing campaign
objective gates.

Daily goals pay 2.00 each when closing work finishes. Achievements pay 5.00 each,
once per campaign, also at closing. Results open automatically in Menu with the
earned names and separate daily/achievement amounts. These bonuses are distinct
ledger streams (`cafe:daily`, `cafe:achievements`) and do not count as ticket
earnings or operating profit. Rewards can pay outstanding closing costs.

Lifetime achievements cover 1/7/30 full shifts with service, 25/100/500 tickets,
25 mixed tickets, 50 espresso, 50 croissants, all five recipes, 50 satisfied
visits, five satisfied visits from each named regular, five profitable full
shifts, ten full shifts without waste, two employees, a plant and lamp, four
tables, and all three equipment upgrades. Ownership goals check installed items
at closing. Earned achievements remain earned after later sales or dismissals.

Full-shift milestones require at least one paid ticket. Customer satisfaction
uses the existing review score (800/1000); an individual ticket contributes each
of its distinct items once. Regular progress comes from named regulars, rather
than manually selecting a guest profile. Counters update in the existing
exactly-once review path, and reading the journal never changes gameplay.

## Persistence

The journal introduced save schema 17 / content and rules 9, with a bounded,
fixed-size journal record after campaign data. Table-service schema 18 and the
current dining-time schema 19 / content and rules 11 preserve it. The previous schedule schema 16 / rules 8 explicitly
migrates, along with the previously supported menu, staff, campaign and equipment
formats. Unknown content remains rejected. Loading stages and validates journal
state, ledger totals, daily results and the opening checkpoint before publication.

Counters, completed goals, reward receipts, day baselines and newly earned
achievements are saved together. Loading or revisiting results cannot pay again.
Prepare next day resets the daily page and celebration, preserving lifetime
progress. Restart day restores the whole opening checkpoint, including journal
progress and bonuses, so replaying replaces that day's rewards.

For older saves, per-item and satisfied-regular history cannot be reconstructed.
New service starts contributing to lifetime counters after migration; daily goals
and full-shift milestones join at the next preparation phase. A save already in
preparation can participate immediately. Existing recipes, stock, money and
regular histories are preserved. Migration normalizes the opening checkpoint
without altering the device slot until Save shift.

## Checks

`cafeJournalChecks` in the simulation suite exercises three actual reference-policy
days, partial restore, restart, daily rotation, closing rewards, frozen results,
malformed records, empty early closing and previous-format migration.
`cafeTableJournalChecks` exercises the asynchronous seated workflow with staff
tasks, stacked mixed orders, preparation/delivery in different orders, named
regulars, a takeaway ticket and a cancelled prepared table ticket. It checks
that preparation gives no journal credit, delivery/review retries cannot count
twice, GUI projection is read-only, closing banks the correct daily and lifetime
rewards, and restarting/replaying restores the same complete saved result.
`tools/journal-smoke.cjs` uses campaign-host evidence snapshots to check the normal
playable journal and rewards on WebGL 2 and automatic backend selection, at
desktop and narrow viewport sizes. Screenshots go to `build/evidence/journal`.
The desktop cases also take a real seated guest's order, prepare and deliver it
through the browser controls, inspect the visible journal, hire a colleague,
and bank the resulting achievement at closing. Both progress and rewards are
restored through the normal Save/Load controls without duplication.
The runner uses the installed browser renderer by default; set
`CAFE_SOFTWARE_RENDERING=1` to opt into SwiftShader. Slow software rendering can
take longer than the real-time walking-workflow timeout.
Narrow viewport checks do not establish physical mobile performance.

Local validation, 2026-10-28: focused journal regression checks passed natively
and in WebAssembly. All 19 offline tool tests and all 16 bundled simulator
hashes passed. The normal playable browser journal smoke passed
WebGL 2 and automatic selection at 1440×1000 and 390×844; screenshots were
visually inspected. Automatic selection used the WebGL fallback in this run.
The three-day native/Wasm campaign reports match exactly, including hash
`7900054799613664717` for the table-service-compatible save format.

Revalidation, 2026-10-29: the current native baseline and the expanded regression
suite pass all seven CTests, including table service, aggregate simulation,
campaign and equipment replays, and the stress replay. The prior table-service
regression warning above is superseded: the current checkout already contains
the counter/seated-service and dining-duration test corrections. The full
WebAssembly simulation regression executable, including the new seated journal
checks, also passes. Native and WebAssembly three-day campaign reports match
exactly (hash `11302423830753807667` under schema 19 / rules 11). All 20 offline
tool tests and all 16 bundled simulator source hashes pass. Physical-mobile
performance remains outside these local checks.

The expanded browser checks also pass on WebGL 2 and automatic selection at
desktop and narrow viewport sizes. Both desktop runs complete an actual seated
order and show its progress in the journal, then display **A helping hand** and
the 5.00 reward in day results. Screenshots are
`build/evidence/journal/table-rewards-webgl2.png` and
`build/evidence/journal/table-rewards-automatic.png`.


## Achievement celebrations and badge collection (2026-10-29)

Each of the 18 lifetime achievements has a distinct ImageGen medallion. When
the simulation banks achievement rewards at closing, a modal shows the badge,
achievement name, exact condition and the 5.00 reward already paid. Multiple
awards queue behind Next badge; Close/Escape dismiss the batch. Opening details
or a collection never claims or changes money. Daily-goal rewards keep their
existing journal presentation.

Earned badges appear in a paper shelf at the top of the scene immediately left
of the right-hand controls. The shelf scrolls after two rows and avoids customer
badge placement. On narrow screens it becomes a compact Badges-count button
with the latest earned icon; the collection still shows all 18 goals. Selecting
a badge opens its details. Locked collection badges show actual progress and
the future reward at closing.

Native dialog focus containment, Escape/backdrop dismissal, a persistent Close
control, reduced motion and descriptive labels support keyboard use. Manual
inspection pauses active service and resumes only a pause owned by that dialog.
An existing player pause is preserved. Automatic closing celebrations leave
the already stopped day alone. Presentation acknowledgments are stored separately
from game saves so restored/reloaded results do not repeat dismissed popups.

Artwork: assets/ui/achievements/provenance.json. Browser evidence and the real
paid campaign fixture are under build/evidence/achievement-ui and
build/evidence/achievement-fixtures. The all-18 shelf screenshot is explicitly a
read-only presentation stress fixture, not an assertion that all awards were
paid by that campaign.
