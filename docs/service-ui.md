# Customer and service readability Â· 2026-10-26

## Reference GUI implementation Â· 2026-10-27

Mobile customer badges use a compact 72 × 44 CSS-pixel target and smaller
existing artwork. Placement avoids projected customer envelopes (including
standing height while seated), neighboring badges and the pause/navigation HUD.
If no clear position fits, the badge is hidden rather than covering a customer.
Ready badges use a short label; full order details and patience remain available
in the accessible label and tooltip. Desktop badge sizing is unchanged.
The iPhone preview smoke check verifies character clearance at multiple camera
angles and zoom levels on both renderer selections.

The service HUD now follows the reviewed GUI reference: floating oat-paper shift
and cash capsules, a forest selected navigation dock, serif ticket headings,
layered paper cards, and illustrated drink, pastry and coin artwork. The original
ImageGen raster illustrations are loaded by `web/gui-icons.js`; `web/gui.css` contains the
reference treatment, scoped to the playable view. All artwork ships locally; no
external fonts or image-generation services are called at runtime.

The icons distinguish demitasse espresso, tall americano, layered latte, tagged
tea and croissant. Utility icons use matching painted objects. The staff portrait is a decorative
illustration shared by ticket avatars, not a portrait inferred from guest names.
Ticket prices, items, readiness, patience, cash, goals and day phase all come from
existing state. The header shows actual remaining shift time rather than an
invented wall clock. Table actions use the selected ticket; takeaway guests
retain their counter queue. The illustrated scene in the concept is not part of this GUI
change; existing world models and rendering remain unchanged.

Narrow screens use a scene above a scrollable service sheet, a persistent mode
dock, and visible cash/pause controls. The primary action remains sticky; keyboard
focus, labelled icon controls and reduced-motion preferences are preserved.
The CMake `cafe_web_assets` dependency stages browser files on incremental builds
even when C++ does not need recompilation.

Validation: the browser Release build (including final link and asset staging),
JavaScript syntax checks and `npm test` (10/10) passed. The service
journey passed on software WebGL 2 and automatic selection reporting
`WebGpuRenderer ready`, including mixed-order payment, FIFO selection, camera,
paused deadlines, urgency, narrow touch/collision checks, dining and save/load.
Browser tests used 1440Ã—960 and 390Ã—844 CSS viewports with 0.35 3D render scale to
keep the software run practical; DOM/UI remained at full CSS resolution. Screenshots
were visually inspected. These checks do not establish full-resolution hardware
performance or physical-phone acceptance. An initial full-resolution WebGL run
lost its GPU context; a full-resolution software run timed out during brewing.
Evidence is in `build/evidence/service-*.png` and `service-ui.json` (latest run).
Use `CAFE_RENDER_SCALE=.35` with the existing smoke command for the same bounded
render workload; omit it for normal device-pixel-ratio rendering.

The service view uses ImageGen icons plus written labels for espresso,
americano, latte, tea and croissants. Compact tickets show the customer/name and
stable number, price, preparation state and remaining patience. The action bar
stays visible while browsing orders. Ordered items omit redundant status text;
working items show the actual step. Seated/departing visits have a separate list.

Above each visible customer, a button shows their number, ordered items, status
icon and patience time/bar. At or below 25% of their original patience budget,
the ticket says **Low patience**, with a contrasting border and bar. Colour is
supplementary. Ready orders use a check and explicit Ready label. Paid visits
show seating/departure status and no patience bar or urgency styling.

Select a customer badge or ticket to highlight its counterpart. Badges work with
keyboard and touch; their accessible name includes items, state and time.
Selecting a later customer inspects their order; service still follows the
existing queue. The main button names the customer it actually prepares/serves.
It offers the open-day/results action when appropriate and shows a reason when
blocked. Supplies, care and staff have labelled icon shortcuts. Guidance folds
when campaign orders arrive and stays available as a disclosure; the campaign
promotion leaves the ordinary practice HUD after a paid service.

## Engine and save contract

Prepared tickets have individual **Serve** buttons showing the customer number,
items and price. When several orders are ready, choose any customer's button to
request delivery. These choices stay visible while inspecting another ticket,
disable while paused and disappear once delivery starts. Takeaway handover still
waits for the staff and guest to reach the counter.

Takeaway customer callouts also start preparation when clicked, tapped or
activated with the keyboard. Once the whole ticket is ready and staff and guest
have reached the counter, activate the same callout to hand it over. Clicking a
later queued guest selects their ticket without preparing someone else's order;
collected table orders retain their preparation priority. Paused shifts and
unavailable preparation/handover actions remain blocked. Run
`node tools/takeaway-badge-smoke.cjs` for the focused browser check on WebGL 2
and automatic backend selection.

`CafeScene::guestPins` resolves current scene actor handles and uses the pinned
engine's public `CameraComponent::worldToScreen` method. The browser supplies
the CSS viewport size; projection and badge coordinates use that same space,
independently of device pixel ratio. A bounded collision layout offsets crowded
labels with leader lines. Markers outside the view are hidden. They are hidden
in Build/Menu and rebound from live actors after a load.

The host publishes customer locations; `web/service-ui.js` owns DOM presentation
and transient selection. Patience comes from the existing simulation deadline
and original budget, never a browser timer. Pause/hidden-tab suspension therefore
freezes it. Camera motion still updates positions while paused. DOM ticket nodes
are retained to preserve keyboard focus. No game prices, queue rules, save bytes,
schema, renderer internals, dependency pins or provider services changed.

## Validation

`node tools/service-ui-smoke.cjs` checks item icons, linked selection without
reordering, the real first mixed-order payment, live camera projection, paused
deadlines, a presentation-only urgency fixture, touch interaction, bounded
non-overlapping narrow labels, a visible sticky action, ready/seated states and
restored actor bindings. It writes `build/evidence/service-ui.json` and
`service-*.png`. Use `CAFE_BACKENDS=webgl2` to isolate a backend;
`CAFE_DISABLE_WEBGPU=1` also exercises automatic WebGL fallback.

Browser evidence is desktop/emulated narrow coverage, not physical-mobile
acceptance. The existing cloud command includes the new focused smoke check.

Local results on 2026-10-26: browser Release build passed; the focused journey
passed on WebGL 2, WebGPU and forced automatic WebGL fallback. The fallback
sample recorded 1,013 frame intervals, median 16.7 ms and p95 16.8 ms, across
the journey/resizes; it is a desktop observation, not a phone performance claim.
Missing-model/audio/adapter playback fallback and audio/lifecycle checks passed.
`npm test` passed 8/8, simulator hashes 16/16, and `git diff --check` passed.
Linux/cloud and physical-mobile validation were not run for this UI iteration.
Evidence: `service-ui-browser.log`, `service-ui-fallback.log`,
`service-ui-assets.log`, the latest service UI JSON and `service-*.png` under
`build/evidence`. Screenshots were visually inspected at desktop and narrow sizes.

## Remaining production work

1. **Art and animation:** replace remaining blockout furniture and repeated
   figures with the reviewed cafÃ© asset pack. Add a shared rig, walk/sit/work/
   handover animations and visible cup/ingredient handling. Establish one fully
   polished barista â†’ machine â†’ cup â†’ customer interaction before expanding.
2. **World feedback:** stronger ready-cup highlighting, distinct regulars,
   readable machine/shelf states, restrained contextual sound and cleanup effects.
   Keep every important cue available without audio or colour discrimination.
3. **Learnability and balance:** observe new players completing a shift, shortage,
   hiring, upgrade and day two without help. Tune patience, travel, costs and
   progression using those observations and deterministic balance reports.
4. **Device acceptance:** test actual phone/tablet touch, zoom/text scaling,
   frame pacing, loading, audio unlock, memory and browser recovery. Re-measure
   busy four-table/three-staff scenes on both renderer paths. Keep a reduced
   quality setting available if measurements call for it.
5. **Release confidence:** retain compatibility fixtures and save recovery,
   publish dated device results and package hashes, run Linux/cloud checks and
   complete a bug pass. External deployment and paid asset generation remain
   separate actions.


## ImageGen UI artwork

The playable UI now uses 20 transparent ImageGen icon crops in `assets/ui/`,
plus generated paper panel and forest-green button skins rendered with CSS
nine-slice borders. Labels, focus rings and interaction states remain HTML/CSS.
The complete prompts and packaging details are in `assets/ui/provenance.json`.

## Cafe attractiveness

The top bar shows a derived 0–100 score with a generated heart icon. Tap or focus
and open it for a breakdown: unlocked recipes contribute 5 points each (25 max);
customer experience contributes 50, based on saved satisfaction reviews (75%
when guests are waiting) and current guests' average patience score (25%). With
no waiting guests it uses reviews alone; before any reviews the baseline is 75%.
Reviews include waiting, freshness, cleanliness and seating fit. Furnishings
contribute 2 points per table (8 max), 3 per purchased plant or lamp (12 max),
and 5 for an upgraded finish. The total is recalculated after load and updates
without changing arrival rates, prices or existing satisfaction rules.

## Tooltips

Hover labels, values, icons and controls for contextual help. Keyboard focus shows the same help on interactive controls; Escape dismisses it. Unavailable actions retain their current reason. Dynamic tickets need no extra registration. Tooltips add accessible descriptions, stay inside the viewport and do not intercept clicks.

## Ingredient shortage alerts

Ready stock is shown through conditional warnings beside the top-left shift panel.
Beans, water, milk, tea leaves and pastry stock each have their own ImageGen icon;
a warning appears only at zero ready stock and disappears when stock recovers.
Cash and attractiveness keep their original top-right panel. Each warning opens
Supplies for that ingredient and explains stored/incoming quantities in its tooltip.

When supplies are missing, a button beside Prepare Order replenishes the first
blocking ingredient reported by the simulation, falling back to another empty
ingredient. It orders 12 portions with the displayed cost when storage is empty,
waits during delivery, and switches to Refill when storage is available. Refill
uses the existing staff task to move up to 4 portions to the work area. Pause,
insufficient cash, storage limits and existing deliveries are respected. No supply
purchase or restock happens automatically. The button disappears after shortages
are resolved. Source prompts and hashes are recorded in assets/ui/provenance.json.

## Illustrated build palette

Build uses ImageGen icon cards for four table slots, the preparation bench, storage
shelf, two plant slots, two lamps and the fixed-counter speed upgrade. The eight
original illustrations and prompts are recorded in assets/ui/provenance.json.
Cards show purchase cost or free movement for owned furniture and explain closed
cafe, funds and campaign restrictions in tooltips.

Drag a furnishing card onto a clear cafe floor position to purchase or move it.
The pointer preview shows the selected object and valid/invalid feedback using
the existing floor picker and simulation layout validation. Release commits the
existing atomic purchase/move command. Invalid drops and Escape leave cash and
furniture unchanged; Q rotates. Mouse and touch use the same pointer path. A
keyboard user can activate a card, use Place selected item or the retained floor
plan/coordinate editor. The speed-kit card installs on the existing counter.
Plant/pot customization, resale, finishes and equipment details remain available.

`node tools/build-placement-smoke.cjs` checks valid/invalid placement on both
renderers. `node tools/build-palette-smoke.cjs` checks generated icon loading,
all furnishing types, purchase accounting, moving, touch drag, cancellation,
rotation, counter upgrade, closed-cafe restrictions and mobile layout.

## Placement feedback and valid-area guide

Selecting a furnishing now draws a floor guide projected by WebEngine's actual
camera. Green cells indicate cursor positions where the selected footprint and
access routes fit; red cells are blocked. The current footprint is outlined in
green or red, with the required access cell in gold. Rotation updates the guide.
The guide clears on completion, cancellation or leaving Build.

Drops call the simulation preview and purchase/move commands directly instead of
using the hidden coordinate editor's disabled Apply button as the placement
authority. The coordinate editor remains an alternative input. Rejections now
explain bounds, overlap, clearance, routes, cash or campaign restrictions next to
the pointer. Build also shows a Resume or Close cafe action for those blockers.
This keeps clear-looking gaps from being mistaken for valid space when an object's
full footprint or required access is larger than the gap.

`node tools/placement-guide-smoke.cjs` checks projection/picking agreement, valid
and blocked guides, a stale-editor regression, purchase accounting, pause/close
recovery, cancellation and phone layout on both browser renderers.

## Contextual machine service

Clean and Repair actions sit beside Prepare Order and ingredient replenishment.
They appear only when cleanliness or condition is below 20%, and retain the existing
maintenance availability rules (including current orders, pause and funds).
Repair shows its actual price, including the speed-kit rate; Clean shows current
cleanliness. During care they switch to progress and Cancel cleaning/repair.
These shortcuts dispatch the existing maintenance commands and do not purchase
or schedule anything automatically.

## Top-left service alerts

Matching ImageGen Clean, Repair and Refill/Order icons share the ingredient-alert
area beside the shift panel. Machine alerts use the same below-20% conditions as
the contextual action buttons; they hide while care is underway and when fixed.
The supply alert names Order or Refill according to available storage and hides
while delivery/refilling is underway. Select an icon to reveal its service
action; nothing is charged or scheduled merely by selecting the warning.
Tooltips explain current condition, cost and blockers. Artwork and full prompts
are recorded in assets/ui/provenance.json.

## Maintenance below 20% and queued care

Contextual Clean/Repair controls and top-bar alerts appear strictly below 20%
(200 on the internal 0–1000 scale). At exactly 20% they remain hidden.
The machine's brewing minimum uses the same 20% baseline. Preventive maintenance
is still available through the full Machine care drawer.

Care selected during an active ticket is queued in the saved game state. It
starts after delivery/cancellation; it does not discard the ticket or charge for
a repair before it starts. A queued request can be cancelled. The service panel
shows queue/progress status and the applicable Cancel action. The explicit rules-6
to rules-7 upgrade preserves existing schema-15 saves using the same catalog.

## Table service

Seated guests reserve a table on arrival and wait near the entrance when all
tables are occupied. Their patience runs while waiting for a table, an order,
preparation and delivery. Unserved guests leave when it expires.

Click a seated guest's order badge (or select their ticket and choose **Take
order**) to send a barista to their table. Collect several orders before using
**Prepare** on a selected ticket. Prepared orders stay reserved for their guest;
click any ready guest's badge to deliver that ticket. The barista walks to the
table before payment. Waiting and ready badges show remaining patience.

Table visits, collected orders and prepared tickets persist in saves. Known
previous saves migrate with their existing guest flow preserved; new seated
arrivals use table service. Takeaway guests use the counter.


## Compact waiting badge (2026-10-29)

Unpaid waiting guests show only a generated brass service-bell-and-clock icon
and seconds of patience remaining. The world badge omits the guest number,
product icons and progress bar during waiting; preparing, ready and visit states
retain their existing presentation. Full guest identity, products, service state
and patience remain in the accessible button label, hover/focus tooltip and order
panel. Clicking a waiting-to-order badge still dispatches the table-order action.
The 44px minimum touch target, urgency cue and collision placement are preserved.

Artwork: assets/ui/service-waiting.webp, generated with built-in ImageGen. The
complete prompt, source location, alpha-preserving resize and hash are recorded
in assets/ui/provenance.json. Browser evidence is under
build/evidence/waiting-badge; tools/waiting-badge-smoke.cjs checks desktop/mobile,
hover/focus details and real waiting-to-preparing-to-ready transitions.


## Ticket-aware supply shortcuts (2026-10-29)

The preparation panel follows the selected ticket, including seated table guests,
and uses per-ticket ingredient deficits published by the simulation. Deficits use
the existing recipe input totals and available inventory, so one remaining bean
still triggers a supply action for a ticket needing two coffee items. Ready, paid
and actively preparing tickets do not request their ingredients again.

Each deficient or empty ingredient has its own Order/Refill action next to
Prepare. An incoming delivery leaves other ingredient actions visible, with the
existing single-delivery rule explained while they are disabled. Delivery changes
Order to Refill; replenishing enough stock clears the ticket deficit and enables
preparation. Unrelated empty ingredients retain their shortcuts.

Regression coverage: native menu snapshot checks for seated/mixed-item shortages,
a validated low-stock save, and tools/supply-actions-smoke.cjs for real purchase,
delivery, refill, preparation and desktop/mobile layouts on both renderers.
Evidence: build/evidence/supply-actions/report.json and screenshots.


## Takeaway identity (2026-10-29)

The simulation publishes the actual profile takeaway flag for each ticket.
Takeaway waiting badges use the ImageGen takeaway cup-and-exit-arrow icon plus
the existing seconds countdown. Other takeaway states retain that icon alongside
their service-state cue. Order cards use the same cup avatar and an explicit
Takeaway label, and accessible labels/tooltips name the service type. Dine-in
waiting badges keep the service bell. Identity updates when a loaded save reuses
a guest ID with a different profile.

Artwork: assets/ui/takeaway.webp. Complete built-in ImageGen prompt, original
alpha-preserving resize and hash: assets/ui/provenance.json. Desktop/mobile and
real takeaway counter-service checks: tools/arrival-balance-smoke.cjs.

## Collected orders and preparation choice (2026-10-29)

Dine-in badges show a menu before the order is taken, then switch immediately
when collection completes to the existing ImageGen bell-and-clock artwork for
waiting to be served. The badge refresh includes this state transition even
though both states share the waiting category. Countdown and accessible service
labels remain visible.

Each collected dine-in order has a Prepare button showing its guest number and
items. Players can prepare any collected order, including a later guest's ticket.
Buttons explain and disable preparation while paused, busy, short of ingredients,
or waiting for machine care. Ready orders can still be delivered independently.
The table-service and waiting-badge browser smoke checks cover these transitions.


## Attractiveness and visitor count (2026-10-29)

The attractiveness breakdown now shows visitor capacity and current visiting
guests alongside menu, experience and furnishing scores. A new cafe reads
10 + 10 + 10 = 30, allowing two guests. Each ten-point threshold from 40 through
100 permits one additional guest, reaching nine. Component tooltip descriptions
explain the starting values and improvement paths.

## Counter and coffee machine clicks

In Serve mode, click or tap the counter or coffee machine to prepare the next waiting ticket. Takeaway tickets follow their queue; collected table orders retain their existing priority. Collect a seated guest's order before preparing it. The action prepares the whole ticket, including mixed orders, and does not admit guests when no orders are waiting.

Camera drags, Shift gestures, cancelled pointers and clicks in Build/Menu do not prepare orders. Pause, ongoing preparation, supplies and machine care retain their existing guards. Ready orders still use the explicit Serve controls.

