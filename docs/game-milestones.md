# CafeGame: next five milestones

The proposed paid expansion has its own sequence:
[Garden Café add-on milestones G1–G7](garden-cafe-milestones.md).

Status: stages 17-20 implemented; stage 21 planned, 2026-10-26. These continue the existing stage numbers after
stage 16. Implement in order; each stage should leave a playable browser game.
The aim is a small, complete cafe experience with meaningful choices beyond
brewing espresso, following [design.md](../design.md).

## Stage 17 - Expanded menu and order tickets

Implemented controls and contracts: [menu and tickets](game-menu.md).

**Player outcome:** Read a customer's order and choose how to prepare several
drinks and a simple food item.

- Add espresso, americano, latte, tea and a ready-to-serve croissant. Add water,
  milk, tea and pastry stock alongside beans, including supplier prices,
  delivery capacity, restocking and clear out-of-stock explanations.
- Model americano and latte preparation as ordered steps with equipment access;
  reuse espresso production and add hot-water/steaming interactions. Croissants
  come from deliveries; baking is outside this stage.
- Let profiles choose from the available menu. Support one or two items per
  ticket, show each item's preparation and handover state, and display the total
  price. Only ordered products can satisfy that ticket.
- Track product ownership, freshness, cancellation, waste and quality per item.
  Settle one payment and one review when the complete ticket is served; partial
  preparation or abandonment must not duplicate payment or release another
  guest's stock. Retain the existing full-order payment policy.
- Replace the single brew action with a compact menu and readable order tickets.
  Make the next required action and any blocked reason visible.

**Done when:** All five products can be ordered, prepared and served in the 3D
scene; a latte-plus-croissant ticket works end to end. Shortages, expiry,
cancellation and save/load midway through preparation preserve stock and money.
The practice scenario exposes the complete menu without progression locks.

## Stage 18 - Hireable staff and concurrent service

Implemented controls and contracts: [staff management](game-staff.md).

**Player outcome:** Manage a small team and divide work during a rush.

- Start with one barista and allow hiring up to three total staff. Show hiring
  costs, individual wages and whether the cafe can afford a hire.
- Give staff configurable priorities across preparation, serving, restocking and
  cleaning. Assign breaks individually; preserve unfinished work and release
  claims safely when assignments change. Dismissal requires an idle worker.
- Schedule multiple independent tasks concurrently while respecting exclusive
  equipment, ingredient/output reservations and customer claims. One machine
  remains a bottleneck; extra workers do not create extra machine capacity.
- Show staff names, current tasks, idle/blocked reasons and break state. Animate
  each staff member through the existing navigation adapters.
- Save the roster, priorities, wages, assignments and in-flight travel bindings.
  Keep staff skill trees and complex fatigue simulation outside this stage.

**Done when:** Two staff can prepare and serve/clean concurrently, three can run a
busy shift without duplicate delivery or equipment use, and all wages reconcile.
A break, dismissal attempt or restore during work cannot strand claims or jobs.

## Stage 19 - Daily shifts and progression

Implemented controls and contracts: [daily campaign](game-campaign.md).

**Player outcome:** Complete a day, understand the results and have a reason to
open again.

- Add a campaign separate from the four existing sandbox scenarios: preparation,
  open service, closing/draining and an end-of-day summary. Target an initial
  shift of roughly 10-15 minutes of active play, subject to balancing.
- Stop arrivals at closing and explicitly resolve remaining guests and tasks.
  Summarize revenue, supplies, wages, repairs, waste, profit and satisfaction;
  charge any daily overhead once with a visible breakdown.
- Introduce a short sequence of objectives: first paid service, a mixed order,
  a clean shift and a profitable day. Unlock recipes progressively in campaign;
  preserve the full-menu practice mode from stage 17.
- Add a small roster of named returning regulars with saved preferences and
  visit satisfaction. Returning visits use seeded demand; dialogue is optional
  presentation and does not replace visible order information.
- Save campaign day, phase, objective progress, unlocks and regular history.
  Explain losses and provide a restart-day/new-campaign route without trapping
  the player in unaffordable mandatory purchases.

**Done when:** A player can finish three consecutive days, earn each objective
reward once and resume during service, closing or the summary. Reopening or
reloading cannot repeat overhead, wages, rewards or the day transition.

## Stage 20 - Equipment upgrades and cafe customization

Implemented controls and contracts: [equipment and customization](game-equipment.md).

**Player outcome:** Spend profits to improve throughput and make the room feel
like their cafe.

- Add a small equipment catalogue: a faster espresso-machine tier, an additional
  preparation station and extra storage. Show purchase cost, capacity, speed and
  maintenance tradeoffs before committing a purchase.
- Extend the existing closed-and-drained layout editor to equipment and up to
  four table sets. Update occupancy limits, routes and save validation together;
  reject purchases or placements beyond supported bounds.
- Offer a few plants, lamps and finish variants in the forest/oat/oak palette.
  Keep cosmetic changes separate from clearly labelled gameplay bonuses.
- Preview footprints, access points, price and refund before placement. Publish
  layout, stock/equipment changes and ledger effects together or preserve the
  previous state on failure. Rebuild navigation only after valid publication.
- Gate upgrades with campaign goals and earnings; retain an unrestricted layout
  practice preset. Room expansion and multiple cafe locations remain future work.

**Done when:** Earnings buy an upgrade that measurably changes throughput, an
extra station supports concurrent work, and four table sets remain reachable.
Blocked placement, insufficient cash, sale and save/load preserve equipment,
occupancy, inventory and the ledger.

## Stage 21 - Presentation and first playable release

Source and local release candidate: [player guide and validation](game-release.md).
WebGL 2/fallback and Intel hardware WebGPU journeys pass. Physical-mobile
acceptance remains an outstanding gate; this is a local release candidate.

**Player outcome:** Learn and enjoy the complete loop in a coherent, welcoming
3D cafe without using developer controls.

- Replace focal blockout props and characters with approved stylized assets;
  add readable work, queue and seated poses, warm morning lighting and restrained
  steam/reward effects. Keep primitive fallbacks for missing or failed assets.
- Deliver the paper-style HUD, order tickets, contextual actions and compact
  Serve/Build/Menu navigation from the design brief. Put diagnostics in an
  optional developer panel and support bounded camera pan/orbit/zoom and reset.
- Integrate approved local brewing, cup, door and ambience audio through the
  engine audio APIs. Unlock playback after a user gesture; provide mute/volume
  controls and written equivalents for speech or status sounds.
- Add a guided first shift, keyboard focus, touch-sized controls, UI scaling,
  reduced-motion support and a narrow-screen layout that preserves the scene.
- Use Tripo/ElevenLabs tools only for separately authorized generation. Record
  provenance, inspect models and audio, then register approved local files in
  the asset manifest. Builds and gameplay require no provider credentials.
- Package a browser release candidate with run instructions, known limits and
  dated validation evidence. Publishing/deployment is a separate action.

**Done when:** A new player can complete the first shift, understand a shortage,
hire help, buy an upgrade and continue to day two through the normal UI. Validate
rendered play on WebGL 2 and hardware WebGPU, plus a representative physical
mobile device; record measured frame rate, load time and asset sizes against the
design targets. Software-rendered checks alone do not establish these gates.

## Shared implementation and validation contract

- Keep recipes, prices, staffing, campaign and upgrade policy in game-owned
  code. Reuse the bundled simulator's inventory, production, service, tasks,
  ledger and layout mechanisms, and public engine rendering/navigation/audio
  APIs. Scope any missing generic engine mechanism explicitly before adding it.
- Keep the renderer pin unchanged unless an identified requirement justifies a
  separately reviewed upgrade. A newer skill reference is not proof of support
  at the pinned revision.
- Extend typed definitions, scenario reports and balance/stress runners as the
  game grows. Record whether a report models actual travel or zero-travel policy.
- Use simulation time, seeded demand and bounded state. Preserve pause/hidden-tab
  suspension and deterministic native/Wasm replay for game rules.
- For every durable-state change, update schema/content fingerprints and the
  declared rule revision as needed. Supply tested migrations for known old
  content or a clear non-destructive incompatibility result; never silently
  discard a shift.
- Each milestone needs focused rule tests, actual browser interaction checks on
  both backend paths, save/restore coverage and updated player documentation.
  Run native Windows and Linux/cloud validation for changed portable rules;
  report checks actually run and outstanding platform gates separately.

Out of scope for these five milestones: multiplayer, multiple locations,
complex baking, large skill trees, live provider generation and a native game
host. The reusable library remains a foundation; these stages primarily add
CafeGame content and integration.
