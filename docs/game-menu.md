# Expanded menu and order tickets (milestone 17)

CafeGame now serves five products, with one or two **different** items per
ticket. Start **Quiet practice** in Scenarios and authoring to try every recipe.
Its first guest requests espresso; use the manual guest's first/second item
selectors for subsequent practice orders. Profile choice gives regulars a
rotation of the menu, commuters latte or americano (sometimes with a pastry),
and enthusiasts espresso or latte. Automatic arrivals use these preferences.
Sold-out requests remain visible with a restocking explanation.

| Product | Price | Preparation | Fresh after completion |
| --- | --- | --- | --- |
| Espresso | 5.00 | 1 bean, espresso machine, 3 seconds | 45 seconds |
| Americano | 6.00 | Brew 1 bean into a shot, then add 1 water at the kettle for 1 second | 45 seconds |
| Latte | 7.00 | Brew 1 bean into a shot, then steam 1 milk for 2 seconds | 45 seconds |
| Tea | 4.00 | 1 water and 1 tea leaf portion, kettle, 2.5 seconds | 60 seconds |
| Croissant | 3.50 | Plate 1 delivered pastry, 0.5 seconds | 120 seconds |

These are equipment times; browser staff travel and collection add time. There
is no baking system. Ingredient quantities are portions, not physical litres.
All recipes are available without unlocks; campaign progression is milestone 19.

## Playing

Read the next ticket and choose its first item in the preparation menu. This
starts the entire ticket. The barista prepares its jobs as ingredients and
equipment become available; a croissant can be plated before its latte shot is
brewed. Americano and latte finishing always wait for a brewed shot. The scene
shows the barista visiting the machine, kettle, steaming jug and pastry counter,
with separate prepared items on the counter.

Each ticket shows its total price and per-item stage, readiness, freshness and
quality. **Serve ticket** becomes available after every item is ready, the
barista reaches handover and the customer reaches the counter. Delivery removes
the ticket's claimed products and creates one payment and one review. It cannot
be paid twice. The lowest item quality feeds the ticket's product satisfaction.

Raw ingredients for the full ticket are checked before acceptance; shortages
leave the guest queued. The machine needs sufficient condition for all required
shots. Tea and croissants can be prepared even when the espresso machine is
worn out, provided no machine care task is active.

Each finished item ages independently, including while other items are still
being prepared. An intermediate shot also has a 45-second wait limit before
finishing starts. Expiry, cancellation or abandonment cancels the unpaid ticket,
releases its claims and discards its prepared products/unused shots exactly
once. Consumed ingredients are not refunded; partial tickets are not sold.

## Ingredients and supplies

New shifts start with the scenario's bean quantity plus 12 portions each of
water, milk, tea leaves and pastry stock at the preparation area.

| Ingredient | Unit cost | Twelve-portion delivery |
| --- | --- | --- |
| Beans | 1.00 | 12.00 |
| Water | 0.25 | 3.00 |
| Milk | 1.00 | 12.00 |
| Tea leaves | 0.50 | 6.00 |
| Pastry stock | 1.50 | 18.00 |

Select an ingredient under Supplies, order 12 portions and wait 8 seconds.
Deliveries reserve their ingredient's incoming storage space and are prepaid.
Only one delivery can be pending; cancellation refunds its exact price.
Restock moves up to four portions to the preparation area. Storage has 24
portions per ingredient; preparation holds 100 beans or 24 of each other raw
ingredient. Auto supply now covers all five ingredients, orders only affordable
quantities and retries shortages without inventing stock. Stored raw portions
do not expire in this milestone.

## Ownership, persistence and compatibility

Milestone 18 adds [staff management](game-staff.md), timed browser restocking
and format-11 saves. The recipe and ticket contracts in this guide remain valid.

`src/definitions.hpp` owns menu/resource/process definitions and supplier prices.
`src/menu.inc` composes intermediate shot jobs with core multi-item orders.
The engine's inventory, jobs, station claims, worker assignment and output
ownership remain authoritative. Up to three employees share cafe work, with one
preparer owning the active ticket and one service counter.

Saves use **format 11, content version 3, rule revision 3**. Known milestone-17
format-10 shifts migrate explicitly. They retain guest
requests, per-item quality/freshness, intermediate jobs, supply reservations,
workflow progress and the joint ledger. Restore validates a detached candidate,
rebases handles and rebinds travel before continuing.

**Pre-menu formats 1-9 are deliberately incompatible with this catalogue.**
Loading them displays a content-version error and preserves the live shift and
the stored bytes. There is no automatic conversion or automatic overwrite. An
explicit Save shift replaces the existing device slot with the new shift.
The stage-16 legacy migrations described in older documents apply to the old
content family, not to milestone 17.

## Validation commands

The ordinary independent CTest suite includes `tests/cafe_menu_cases.hpp` for all
products, two beverages, latte plus croissant, partial cancellation/expiry,
ingredient shortages, all supplier prices/refunds, canonical saves and time
partitioning. The stress runner's retained-job bound includes intermediate jobs.
The balance policy is `reference-v2-menu-zero-travel-100ms`; it restocks all raw
ingredients. It does not measure browser travel or rendering performance.

With the built site served and Playwright/Chromium or Edge available:

```sh
node tools/menu-smoke.cjs
```

This exercises all five products and a mixed ticket through rendered travel,
save/cancel/restore during partial preparation, exact ticket payments, supply
refunds and genuine historical-save rejection. It runs forced WebGL 2 and
automatic selection and writes screenshots under `build/evidence`. Set
`CAFE_URL`, `NODE_PATH`, `BROWSER_EXECUTABLE` as needed; `CAFE_DISABLE_WEBGPU=1`
tests automatic fallback. Software rendering does not establish hardware WebGPU
or mobile acceptance. No paid generation, credentials or engine pin change is
required.

Local evidence (2026-10-26): Windows MSVC Release CTest 4/4 and Emscripten 6.0.11
CTest 4/4 passed. Eight offline Node tests and all 16 bundled simulator hashes
passed. The menu acceptance ran in headless Edge on forced WebGL 2 and automatic
WebGL fallback, covering all products and partial mixed-ticket restore.
Two 21,600-second replay seeds (123 and 456) matched native/Wasm state and report
results exactly, with scale checks through 1,024 queued jobs. Peak sampled game
saves were 22,497/22,498 bytes; this is a save-size observation, not a memory or
frame-rate claim. See `build/evidence/stage17-stress-parity.json` and
`build/evidence/menu-{webgl2,automatic}.png` for local artifacts.
Linux/cloud, hardware WebGPU and physical mobile acceptance were not run here.
