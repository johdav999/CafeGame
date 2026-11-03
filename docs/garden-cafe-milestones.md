# Garden Café add-on: implementation milestones

Status: G1–G5 source implemented; G6–G7 planned, 2026-10-30.
G1–G7 form a separate sequence from the base game's stages 17–21.
Implement in order; each milestone must leave the base café playable.

G1–G2 implementation and validation notes: [foundation and courtyard](garden-cafe.md).
G3 implementation and validation notes: [indoor and outdoor service](garden-service.md).
G4 implementation and validation notes: [summer menu and cold preparation](garden-summer-menu.md).
G5 implementation and validation notes: [restoration and garden regulars](garden-restoration.md).

## Product scope

Extend the player's existing neighborhood café with a courtyard they restore,
decorate and run. Follow the warm Scandinavian dollhouse direction in
[design.md](../design.md): a little coffee, a good morning, now outdoors.

The first release contains:

- One attached courtyard with up to two outdoor table sets, raising the proposed
  combined indoor/outdoor limit from four to six. Confirm the limit in G1.
- Three recipes: iced coffee, lemonade and delivered berry-cake slices.
- One shared cold-preparation station with ordered preparation steps.
- Three named regulars: a gardener, a dog walker and a book-club organizer.
- A five-chapter restoration campaign ending in a neighborhood garden party.
- A coordinated garden collection: outdoor table/chairs, umbrella, flower box,
  climbing-plant trellis, botanical cup set and linen staff apron.
- Outdoor ambience and optional quiet music, subject to separate asset approval.

The distinct gameplay addition is running indoor and outdoor table service with
shared staff, supplies and equipment. Weather is presentation-only in this
release. Berry cake is delivered; baking, gardening/crop simulation, pet AI,
group seating, multiplayer and a second independent café are outside scope.
Picnic orders are deferred rather than introducing another fulfillment mode.

Paid ownership grants access to the expansion; restoration and purchases use
ordinary earned game currency. Keep the base campaign complete. Fixes,
accessibility and essential controls remain available to every player.

## G1 — Expansion foundation and compatibility

**Player outcome:** Continue an existing café safely, with a clear route into the
expansion when it is available.

- Define stable expansion, recipe, furnishing, zone, regular and chapter IDs;
  keep expansion content separate from base content selection and objectives.
- Add a game-owned content-availability seam for owned/unavailable states and a
  development-only fixture. A browser flag or local save is not purchase proof.
  Production ownership verification belongs to G7's selected distribution host.
- Plan the courtyard bounds, doorway, table/access IDs and combined capacity.
  Audit layout, occupancy, demand, staff, UI and save limits before raising them;
  retain the existing indoor capacity when the expansion is unavailable.
- Extend durable state and content fingerprints, including opening checkpoints.
  Define migration from the current supported base saves with the garden locked
  and no changes to existing cash, stock, layout, regulars or achievements.
- If an expansion save is loaded without required content or ownership, explain
  the requirement and preserve the current session and saved bytes. Never strip
  garden objects or silently convert the save. Offer a separate base session.

**Done when:** Owned and unavailable fixtures select the correct content; a
known base save migrates intact; missing-content, malformed and unknown saves
fail without replacing the session or device slot. A base-only campaign still
completes its normal day and save/load journey.

## G2 — Courtyard layout and connected navigation

**Player outcome:** Open the courtyard and arrange reachable outdoor seating.

- Add one attached outdoor zone and doorway using existing scene/navigation
  mechanisms. Provide a Garden workshop scenario with funded placement tests.
- Extend the closed-and-drained editor to the garden, using the existing
  preparation and purchase-break rules. Preview zone boundaries, footprints,
  access points, purchase price and refund before accepting changes.
- Add outdoor table sets using existing table-party semantics. Validate paths
  from the queue and service counter through the doorway to every enabled seat
  and cleaning point; umbrellas and trellises must not block required routes.
- Publish placement, capacity, navigation and ledger changes together. Preserve
  the previous layout on overlap, blocked-doorway or insufficient-cash failure.
- Extend bounded camera controls and picking so both the café and courtyard are
  usable; keep status labels readable and provide a reliable camera reset.

**Done when:** A player can buy, move, rotate, sell and restore two outdoor
tables. Six combined tables have valid access; an attempted seventh and a
blocked doorway are rejected without charges or state changes. Indoor-only
layouts retain their existing behavior. This milestone uses reviewed assets or
existing primitive fallbacks; final artwork is G6.

## G3 — Indoor and outdoor service

**Player outcome:** Run both areas with the same team and see the tradeoff
between additional seating and longer staff travel.

- Extend guest seat selection to eligible indoor/outdoor tables, with a visible
  seating preference and fallback to an available eligible table. Keep the
  existing FIFO queue and one-party-per-table policy; no group reservations.
- Route staff through preparation, table delivery and outdoor cleaning using
  existing priorities and claims. Outdoor guests follow the existing dining,
  patience, satisfaction, payment and departure lifecycle.
- Base demand on enabled capacity and existing demand rules. More seating must
  not spawn unbounded guests or bypass equipment and staffing bottlenecks.
- Preserve assignments, occupied seats, delivery ownership and cleaning tasks
  across breaks, pause, closing, restart and save/restore. Prevent moving or
  selling occupied tables through the existing drained-edit requirement.
- Show zone/table destinations and blocked reasons in the normal service UI;
  keep indoor/outdoor filters optional and retain one readable order list.

**Done when:** Three staff serve simultaneous indoor and outdoor tickets with
no duplicate handovers, payments, seat claims or cleaning rewards. Closing
drains both areas. Restore during doorway travel, delivery, dining and cleaning
rebuilds valid routes and claims. Record a browser run with actual travel;
zero-travel balance reports alone do not establish this milestone.

## G4 — Summer menu and cold preparation

**Player outcome:** Prepare a small summer menu with understandable supply and
equipment choices.

- Add iced coffee (espresso then cold assembly), lemonade (cold assembly), and
  delivered berry-cake slices (plate and serve). Reuse beans/water and introduce
  bounded ice, lemon base and cake stock with explicit supplier costs/capacity.
  Ice is delivered stock, without melting simulation.
- Add the purchasable cold-preparation station with an exclusive preparation
  slot, visible footprint, price/refund and reachable access. Reuse existing
  reservation, workflow and equipment mechanisms; avoid a parallel job system.
- Define recipe prices, step durations, freshness and waste behavior in game
  definitions. Reserve inputs and outputs correctly across multi-step work.
- Reuse one/two-item tickets, including mixed base/garden orders. Campaign
  demand must respect recipe unlocks and installed equipment; manual requests
  explain unavailable items. Garden workshop exposes all three recipes.
- Keep the existing whole-ticket settlement and review policy. Save intermediate
  espresso, station ownership, reserved ingredients and per-item preparation.

**Done when:** All three items can be supplied, prepared and served in-browser;
an iced-coffee-plus-cake ticket settles once. Shortages, expiry, interruption,
closing and restore mid-recipe preserve stock, equipment claims and money.
New supplies appear correctly in storage, results and balance reports.

## G5 — Restoration campaign and garden regulars

**Player outcome:** Restore the space, meet its regulars and host a garden party
with a clear ending and continued free play afterward.

- Offer **Start Garden restoration** during eligible owned-campaign preparation,
  after the base first-paid-service goal. Starting is optional and preserves
  the base campaign's day, goals and regular history.
- Implement five chapters: restore/open the courtyard; furnish and serve its
  first table; install cold preparation and introduce summer recipes; welcome
  all three new regulars; host the neighborhood garden party.
- Give each regular a preferred recipe, short written story beats and saved
  visit history. The dog walker is a regular identity, without a simulated dog.
  The book club uses individual existing guest visits, without group seating.
- Define the party as a bounded special service day with a clear preparation
  checklist and achievable served-ticket/satisfaction targets. Use the normal
  clock, queue and closing flow; a missed target allows another attempt.
- Grant chapter rewards and recipe/decor unlocks exactly once. Show numeric
  targets, costs and blocked reasons; optional flawless-shift goals must not
  block the story. Balance required purchases against normal café earnings.
- Persist story progress, party attempt/result and rewards in saves and opening
  checkpoints. Restart rolls the whole day back consistently. Completion keeps
  the courtyard, menu and regulars available for ongoing play.

**Done when:** A campaign started from a migrated base save completes all five
chapters through normal UI. A failed party can be retried, and reload/restart
cannot duplicate rewards. A scripted multi-day balance report and an actual
travel playthrough demonstrate affordable progression without purchased coins.

## G6 — Garden art, decoration and ambience

**Player outcome:** Enjoy a coherent garden café that feels part of the existing
game and remains easy to read while serving.

- Reuse reviewed plants, pots, characters and furniture where suitable. Author
  missing courtyard, garden collection, drink/food and story artwork following
  [the asset pipeline](assets.md). All new graphic artwork and textures use
  ImageGen; use Tripo for missing 3D assets and the established cleanup workflow.
  Paid generation requires separate explicit authorization.
- Register reviewed local assets with provenance, size/triangle/texture budgets
  and fallbacks. Inspect final models from multiple angles and in both renderers;
  foliage, umbrella edges and the doorway must remain readable at gameplay zoom.
- Integrate botanical ceramics and linen apron appearances without changing
  recipe/worker identity or overwriting shared asset state. Show decoration
  gameplay bonuses explicitly and derive them from installed items without
  stacking gains through moving, restyling or reloading.
- Add restrained outdoor ambience, optional music and visual rain only if
  approved assets are available. No weather-driven seating evacuation or demand
  penalties. Respect existing audio buses, gesture unlock, mute and hidden tabs.
- Adapt paper-style UI, camera framing and contextual controls for narrow
  screens, keyboard and touch; preserve UI scaling and reduced motion.

**Done when:** The full collection is usable and saved, approved assets load
with working fallbacks, and tickets/paths remain legible in both zones. Verify
audio controls and keyboard/touch journeys. Record asset totals and screenshots
for WebGL 2 and hardware WebGPU; record physical-mobile evidence separately.

## G7 — Paid distribution and release acceptance

**Player outcome:** Access purchased content reliably and finish a polished
expansion without risking their existing café.

- Select the actual storefront/distribution host before implementing checkout
  or ownership verification. Integrate its supported ownership/restore flow
  behind G1's seam; specify offline and temporary verification-failure behavior.
  Keep payment credentials and provider keys outside browser bundles and saves.
- Test base-only, newly owned, returning owned and unavailable-content sessions,
  including purchase restoration and transient ownership/network failures.
  Failures must preserve saves and avoid trapping a valid session behind a
  destructive reset. Development fixtures cannot ship as an ownership bypass.
- Run the base regression journey and the full garden campaign on both backend
  paths. Cover migrated saves, opening checkpoints, closing, party retry,
  capacity bounds, invalid placement and interrupted mixed-menu service.
- Run focused portable-rule tests, native Windows and Linux/cloud checks,
  native/Wasm deterministic replay, and bounded multi-day balance/stress runs.
  Include maximum combined capacity and distinguish real versus zero travel.
- Measure frame rate, load time, download bytes and memory on representative
  desktop hardware and a physical mobile device. Compare with the design's
  60 FPS desktop/30 FPS lower-power targets and document any unmet gate.
- Document included content, controls, ownership recovery, compatible save
  versions and known limits. Package a reviewable release candidate with dated
  evidence; publishing is a separate action.

**Done when:** All G1–G6 acceptance criteria have evidence; the selected host's
purchase/restore journey works; the base and expansion journeys pass without
save loss; hardware WebGPU, WebGL 2 and physical-mobile release gates have
recorded results. Unresolved gates remain explicit blockers to release.

## Implementation and evidence contract

- Keep game policy and durable state in `src/simulation.hpp` and game-owned
  modules; scene/UI code projects accepted state. Reuse the bundled simulator
  and public engine APIs. Verify capabilities against the actual engine revision
  before implementation; this plan does not require a renderer-pin update.
- Use simulation time and seeded demand. Preserve pause/hidden-tab suspension,
  bounded state, atomic spending/placement/rewards and native/Wasm parity.
- Add migrations or explicit non-destructive incompatibility for each durable
  change, updating schema/content/rule revisions as needed. Cover both the live
  session and opening checkpoint; never treat content hashes as authentication.
- At each milestone, add focused rule tests where rules change, save/restore
  coverage, relevant browser interaction checks and updated player docs. Record
  actual commands/results and remaining limits; compilation and software
  rendering do not establish hardware or mobile acceptance.
- Recheck [base milestones](game-milestones.md) and
  [release gates](game-release.md) before G7. The garden must not conceal or
  replace outstanding base-game acceptance work.
