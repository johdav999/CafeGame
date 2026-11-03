# G4: summer menu and cold preparation

Garden selection adds three recipes and three delivered ingredients to the
existing café. The base café retains its classic catalog. In a campaign, open
the courtyard and complete first paid service and mixed-order goals to unlock
berry cake and the cold station. The station also requires 40.00 in lifetime
ticket sales before purchase. Installing it unlocks iced coffee and lemonade.
These are ordinary in-game purchases; ownership verification remains G7.

| Recipe | Price | Preparation | Freshness |
| --- | --- | --- | --- |
| Iced coffee | 7.50 | Beans → espresso shot, 3 seconds; shot + water + ice → cold assembly, 1.5 seconds | 60 seconds |
| Lemonade | 6.50 | Water + ice + lemon base → cold assembly, 1.2 seconds | 90 seconds |
| Berry cake | 5.50 | Delivered cake stock → plate, 0.5 seconds | 120 seconds |

The existing speed kit reduces the intermediate shot to 1.8 seconds with its
normal wear and repair tradeoff. Iced coffee inherits shot quality; lemonade
and plated cake begin at full quality. Freshness begins per finished item.
Intermediate espresso expires after 45 seconds while waiting for cold assembly.
Expiry cancels the unpaid ticket and discards prepared items once.

The cold station costs 40.00 and refunds 20.00. Its 3 × 2 grid-cell footprint
(1.5 × 1 m), clear access cell and routes use the existing editor. It provides
one exclusive `garden:cold` slot. Shared preparation stations cannot substitute
for it. Workers retain the existing preparation roles, priorities and breaks;
their destination shows cold preparation during cold work. Building and resale
require closed, drained service or eligible campaign preparation/breaks.

| Ingredient | Unit cost | Delivery of 12 | Working capacity | Stored capacity |
| --- | --- | --- | --- | --- |
| Ice | 0.50 | 6.00 | 24 | 24, or 48 with shelf |
| Lemon base | 1.00 | 12.00 | 24 | 24, or 48 with shelf |
| Cake stock | 2.00 | 24.00 | 24 | 24, or 48 with shelf |

Deliveries take eight seconds and reserve storage capacity. Cancellation refunds
the order. Staff restock up to four portions using the normal travel and
1.5-second task. Ice does not melt. Automatic supply waits for summer unlocks
and installed cold equipment before buying cold-drink ingredients. Cake stock
can be ordered once summer progress permits cake. Supplies, equipment costs,
sales and waste flow through the existing ledger and day results.

One- and two-item tickets can mix the eight recipes. All raw inputs, including
separate beans for two coffee drinks, are checked before preparation. Production
uses existing job, equipment and inventory reservations. A complete iced-coffee
and cake ticket pays 13.00 exactly once. Automatic menu rotation includes summer
recipes only when their progress and equipment requirements are met. The base
journal's five-recipe variety/unlock goals retain their original scope; summer
tickets still count as tickets, mixed orders and satisfaction visits.

Garden workshop starts with the cold station purchased through the ledger,
960.00 remaining cash and twelve working portions of each summer ingredient.
It exposes all three recipes and supports the normal supplier controls.

Saves use schema **23**, base content/rules **20**, Garden content **4**. Engine
core wire format stays **1**. Known old base saves keep the classic catalog.
Selected G1–G3 saves first validate against their original catalog and envelope,
then extend a detached session with six resource IDs, three processes, three
empty raw-storage slots and cold worker capability. Existing jobs, inventory
holds, receipts, wages, claims and opening checkpoints survive; migration grants
neither equipment nor stock. Frozen schema-19, schema-21 and active schema-22
fixtures protect the historical formats. New fields cannot grant ownership.

The bundled simulator gains three bounded, atomic public authoring APIs:
`extendResources`, `extendInventory`, and `extendWorker`. They preserve existing
identities and active work, reject duplicates/foreign handles and emit no
gameplay events. Multi-step café catalog expansion occurs only on a detached
candidate. Source hashes cover these reviewed additions. The renderer pin is
unchanged.

Summer UI reuses reviewed generic menu icons; cups, plated food and the station
use existing scene assets/fallbacks. Final summer artwork remains G6; no paid
generation is part of G4.

Validation entry points: `cafe_summer_menu`, `cafe_garden_foundation`,
`cafe_garden_service`, existing simulation/campaign tests, and
`tools/summer-menu-smoke.cjs`. Browser reports and desktop/narrow screenshots
are written under `build/evidence/garden-summer-browser`. The browser check
supplies and restocks all three ingredients, cancels/refunds ice delivery,
serves all three recipes, restores intermediate work and checks one settlement
for iced coffee plus cake. `CAFE_GARDEN_OWNED=0` checks refusal without changing
the active café or device bytes. Development ownership fixtures remain excluded
from release packages.

Windows validation (2026-10-30): six focused native CTests and 21 Node tests
passed; the summer suite also ran under Wasm/Node with matching checkpoint
hashes (`17355932347820840806` for the three single recipes,
`12451968612277555023` for the mixed ticket). This includes earned campaign
unlocks, closing/restart and outdoor tray/delivery restore. Supplier and summer
stock fields appear in exported shift/balance JSON.

The owned Edge smoke passed forced WebGL 2 and automatic renderer selection;
both selected software WebGL 2. Each run served three tickets for 25.00 total,
restored eight interruption stages and recorded no page errors. Desktop and
390-pixel screenshots were inspected; the narrow layout had no horizontal
overflow. These runs do not establish hardware WebGPU, physical mobile or
Linux/cloud performance. The normal build keeps development ownership off;
the owned development preview is retained in `build/garden-preview/site`.
The normal-build browser checks also passed both renderer selections: the G4
mixed save was refused, current cash/tickets stayed unchanged, and the exact
device-save bytes remained intact (`unavailable.json`).
