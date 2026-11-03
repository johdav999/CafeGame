Current status: stages 1-6 are implemented as unreleased candidate source. See [release evidence and open gates](simulator-release.md). The dated stage notes below are historical.

# WebEngine simulator library: v0.1 release plan

Status: proposed architecture and implementation plan; no simulator library APIs
below are implemented by this document. Prepared 2026-10-25. CafeGame is the first
consumer. Implementation belongs in WebEngine; this plan lives with the consumer
until that work starts.

Implementation update (2026-10-25): stage 2's inventory/reservation foundation now
exists in the sibling WebEngine working tree under `simulator/`, with its delivered
contract in `docs/simulator.md` there. Node and browser Wasm checks pass; native
compiler validation and unavailable engine-skill mirrors remain outstanding. No
engine pin update or CafeGame gameplay integration has been made. Later-stage APIs
in this plan remain proposals.

Stage 3 update: the sibling WebEngine working tree now includes production
definitions, station slots, worker assignment, explicit arrival, cancellation and
bounded deadline processing. Its `docs/simulator-production.md` describes the
delivered API and explicit assignment boundary. All 354 contract checks pass in
Node and Edge; native validation remains unavailable. CafeGame has not adopted
these APIs. Customer service, payment and persistence remain later stages.

Stage 4 update: the sibling engine now implements FIFO customer acceptance,
multi-item orders, claimed outputs, patience/abandonment, explicit delivery and
payment receipts. Its `docs/simulator-service.md` governs the delivered API.
Boundary refinement: delivery must occur strictly before expiry; completing at
the deadline does not deliver the order. This prevents budget exhaustion from
extending patience. That delivered rule supersedes the proposed delivery-at-expiry
precedence below. Persistence and CafeGame adoption remain later stages.

## Release objective

Deliver one complete, headless-testable service loop:

**Customer arrives → order accepted → ingredients reserved → worker and station
assigned → preparation completes → delivery confirmed → payment recorded.**

The same portable C++20 rules must run in native tests and browser WebAssembly.
CafeGame demonstrates the loop with its existing WebEngine browser host, WebGPU
and WebGL 2. A minimal Windows host example verifies engine integration on the
other supported platform; CafeGame itself remains a browser application.

## Inspected baseline and reuse decisions

CafeGame pins WebEngine revision `56080eca124c9a62e15b146799a8004bdad5a9b2`
in [CMakeLists.txt](../CMakeLists.txt). The fetched source at
`build/_deps/webengine-src` is the baseline for these findings. The sibling
WebEngine checkout has newer architecture entries (including an RPG foundation);
those are not dependencies available through the current CafeGame pin.

Read alongside [README](../README.md), [design brief](../design.md),
[asset rules](assets.md), and [cloud instructions](cloud.md).
The existing [simulation](../src/simulation.hpp) only owns a three-second brew,
ready flag, served count and five-coin reward. It has no inventory, customers,
workers, persistence or generic simulator infrastructure.

Paths in the following table are relative to the pinned WebEngine source root.

| Existing facility and inspected source | v0.1 decision |
| --- | --- |
| `Application`, `ApplicationFrameCallbacks`, simulation clocks (`include/engine/application.hpp`); CafeGame already uses `callbacks.simulate` | Host supplies elapsed simulation time. Reuse pause/suspension and frame lifecycle; add no wall clock, thread or second application scheduler. |
| Scene-scoped, generation-checked `ActorId` (`include/engine/actor.hpp`); `Scene::runtimeIdentity()` explicitly is not persisted | Reuse handles for presentation bindings only. Simulation needs separate saved identities that survive scene replacement. Do not introduce another scene/entity system. |
| Optional library helper `webengine_add_module` (`cmake/WebEngineModule.cmake`) and standalone `modules/CMakeLists.txt` | Follow target/alias and standalone-build conventions without requiring module registration for simple direct use. |
| AI state machines and queued occurrences (`include/engine/ai.hpp`, `docs/ai-events.md`) | These are AI facilities, not an inventory transaction bus. Expose a small typed simulator event outbox; translate selected events to AI in the host if useful. Do not create a general event framework. |
| Navigation, AI controllers and crowd coordination (`include/engine/ai_controller.hpp`, `include/engine/crowd_navigation.hpp`, `include/engine/dynamic_navigation.hpp`) | Host maps worker travel requests onto existing navigation. Core accepts explicit arrival/failure results and has no positions, paths or physics objects. |
| `SceneArchive`, `ComponentCodecs`, opaque `SceneDocument::applicationData` (`include/engine/scene_archive.hpp`) | Existing scene persistence can carry simulator bytes in a host envelope. Do not depend on scene archives from the headless core or serialize runtime handles. |
| Quest-specific bounded snapshots/codecs (`include/engine/quests/snapshot.hpp`) | Follow validated, staged restore conventions. Quest schemas are not a generic simulator save codec; do not reuse their domain types or require Quests. |
| `WebEngine::Browser`, `WebEngine::Desktop`, host-owned GUI (`docs/consumer-hosts.md`, `include/engine/gui.hpp`) | Reuse rendering, GUI and host lifecycle. Keep debug widgets and actor bindings outside the core. Preserve release/rebind-before-destruction contracts. |

Before implementation, recheck these paths at the chosen engine commit. Any pin
update is a separate reviewed integration change, with fresh online setup and
consumer validation. No renderer, physics, navigation or generic serializer rewrite
is part of this release.

## Boundaries and build packaging

Proposed target: `engine_simulator`, alias `WebEngine::Simulator`, namespace
`engine::simulator`. These names are proposals, not existing engine exports.

The target depends only on the C++20 standard library. Root engine configuration
opts in through `WEBENGINE_BUILD_SIMULATOR` (default OFF); tests and examples have
separate default-OFF options. Direct `add_subdirectory(WebEngine/simulator)` builds
the standalone library without configuring the engine root or fetching graphics,
physics or platform dependencies. Follow the existing module helper's contract.

Do not require Modules, Quests, RPG, AI, GUI or `engine_core`. Reuse their relevant
public APIs at the host boundary. If compiled-module discovery becomes necessary,
add an optional wrapper later rather than forcing every consumer through it.

| Layer | Responsibility |
| --- | --- |
| Immutable definitions | Resources, recipes/processes, station capabilities; validated before publication. |
| Simulator runtime | Own inventory, reservations, station slots, workers, jobs, customers, orders, time, receipt IDs and bounded event output. |
| Game-owned session | Define menu, prices, patience, arrival schedule, wallet, progression, abandonment policy and save envelope. Own one runtime and its immutable definitions. |
| Host adapters | Queue input, supply time, report movement/delivery, map IDs to actors, project read-only state to HUD, play audio, store bytes. |

Keep CafeGame policy in `src/simulation.hpp` and other game-owned source. The
library never knows espresso, cafe colors, coin rewards or provider credentials.
ElevenLabs and Tripo remain offline asset tools. Builds and tests need no keys.

## Minimal domain and public API conventions

Use explicit classes/value types and camelCase methods, consistent with inspected
engine headers. Public headers must not expose browser, renderer, SDL or platform
types. No mutable access to internal containers; queries return values or views
valid only until the next mutation. Expected failures use typed result/error values
with diagnostics; invalid commands leave authoritative state unchanged.

- **Identity:** strong resource/process definition keys and distinct runtime IDs
  for inventory, reservation, station, worker, job, customer and order. Definition
  keys are stable namespaced strings. Saved object IDs are monotonic integers,
  never reused within a session; reject exhaustion. Public runtime handles also
  carry an instance/restore epoch so old commands cannot target restored objects.
  Persist IDs and next-ID counters, not the transient epoch or scene handles.
- **Definitions:** a runtime retains shared immutable validated definitions.
  Resource quantities are checked nonnegative integers with checked arithmetic.
  An inventory has explicit per-resource capacity; omit weight, volume, decay,
  item instances and item quality in v0.1.
- **Inventory:** query total/reserved/available quantities; reserve an entire input
  bundle atomically; commit once or release. No partial successful reservation.
  Reserve output capacity before production starts to avoid consuming ingredients
  for output that cannot be stored.
- **Stations/processes:** processes specify input/output bundles, positive duration
  and required capabilities. Stations expose a bounded count of exclusive slots.
  One job uses one slot and one worker; parallel work uses distinct slots.
- **Jobs/workers:** explicit queued, assigned, running and terminal states. Workers
  have capability sets and availability. Assign FIFO by creation sequence with
  stable ID tie-breaks; scan past ineligible jobs without changing their priority.
  Bound work per update and expose capacity/budget failures.
- **Customers/orders:** FIFO service queue; a customer has at most one active order.
  Orders may request multiple quantities, but each requested item maps to a direct
  process. No recursive recipe planning or supply chains. Order state distinguishes
  accepted, preparing, ready, delivered, abandoned and failed outcomes.
- **Payment:** successful delivery creates one stable receipt with the game-supplied
  integer minor-unit amount. Library validates arithmetic and delivery uniqueness;
  game owns the wallet, prices, currency interpretation, taxes and refunds.
- **Diagnostics:** read-only counts, states, blocked reasons and reservation owners;
  a bounded typed event outbox records transitions. There is no global bus and no
  retained arbitrary callback invoked while mutating state.

Set configurable finite limits for records, recipe entries, queued commands,
events and snapshot bytes. Capacity exhaustion returns a visible result before
partial publication. Reserve space for required events before committing a command;
never drop payment receipts silently. Retire terminal records only after consumers
acknowledge them; pending receipts remain queryable until acknowledged.

## Ownership, time and transition rules

One application-owned runtime is mutated on one owner thread. It owns its records
and reservations; IDs are references, not owning pointers. Its destructor clears
all records without dispatching callbacks. Host bindings borrow the runtime and
must be destroyed or disconnected before it. Input and asynchronous movement
responses carry the current epoch and job assignment token; reject stale results.

Core time uses integer milliseconds. The host converts `frame.simulation.delta`
with a retained fractional remainder; pause or hidden-tab suspension advances no
time and performs no catch-up on resume. Save the remainder in the host envelope.
Reject negative, nonfinite or overflowing input before mutation. Durations are
absolute deadlines on the core timeline, not repeated floating-point subtraction.

Process deadlines chronologically. At an identical timestamp use: queued host
commands in submission order, production completions by job ID, patience expiry
by order ID, then assignment. Delivery submitted at the expiry boundary wins;
completion alone does not imply delivery. Document this order in tests. Large
advances return the amount consumed plus remaining time when the event-work budget
is reached; callers retain that remainder. Do not silently skip deadlines or run
an unbounded catch-up loop. Determinism covers equal definitions and timestamped
commands in this discrete core, not engine physics or GPU output.

Reservation ownership follows the job, including while a worker travels. Acquisition
of inputs, output capacity, worker and station is atomic. Preparation begins only
after explicit arrival; headless examples can acknowledge arrival immediately.
Movement failure cancels assignment with an explicit retry/cancel policy, never
an implicit infinite retry. Slot or worker removal first cancels its affected jobs.

| Transition | Required resource behavior |
| --- | --- |
| Cancel queued/assigned job, before start | Release all inputs, capacity, station and worker reservations; consume nothing. |
| Start | Commit inputs once, retain reserved output capacity and station/worker ownership. |
| Complete | Publish outputs once, release capacity and station/worker, mark job terminal. |
| Cancel after start | No automatic ingredient refund. Release unused output capacity and assignments; game policy explicitly chooses cancellation or finishing for stock. |
| Customer abandons | Cancel unstarted jobs; apply the declared finish-or-cancel policy to started jobs. Release order claims on existing outputs back to stock. No payment. |
| Delivery | Atomically consume order-owned output claims, mark delivered and create one receipt. Repeated confirmation returns an already-terminal result. |

Completed outputs must remain claimed by their order until delivery or abandonment;
another order cannot consume them. Normal cancellation is idempotent: it cannot
double release, refund, complete or pay. Failed validation publishes no partial
state. Do not allow reentrant mutation from policy evaluation; pass validated
policy data to commands instead.

## Persistence and payment consistency

Provide a small domain-specific versioned snapshot and bounded canonical codec,
not a general serialization framework. Encode fixed-width values explicitly rather
than raw C++ memory. Save definitions fingerprint/schema version, time, IDs,
quantities, reservations/claims, assignments, jobs, deadlines, orders and pending
receipts. v0.1 needs no random generator; arrivals are game-supplied. If randomness
is later introduced, its algorithm/version/state becomes part of the save contract.

Load into a candidate runtime, validate limits, versions, references, ownership,
totals, capacities and legal transitions, then publish atomically. Unsupported
versions or mismatched definitions leave live state intact. Initial support is
version 1 only; future migration is explicit. Restore emits no historical effects,
rebases the transient epoch and clears old host commands. Rebuild actor bindings
and travel requests; do not interpret a missing actor as completed travel.

The game save envelope includes both runtime snapshot and wallet/processed receipt
IDs. Apply a receipt to the wallet idempotently, then acknowledge it; save both
together at an owner-thread boundary. Receipt retry after restore must not pay
twice. This is local save consistency, not an external payment service or a promise
of distributed exactly-once delivery. The host owns durable byte storage, storage
errors and atomic publication; scene archives may carry the envelope as opaque
application data where useful.

## Proposed file layout

Paths below are future additions, not files created by this planning task.

```text
WebEngine/
  simulator/CMakeLists.txt              # standalone entry, optional root inclusion
  include/engine/simulator.hpp          # convenience public include
  include/engine/simulator/
    types.hpp definitions.hpp inventory.hpp
    production.hpp service.hpp runtime.hpp snapshot.hpp
  src/simulator/
    definitions.cpp inventory.cpp production.cpp service.cpp
    runtime.cpp snapshot.cpp
  tests/simulator_tests.cpp             # focused contracts; split as it grows
  examples/simulator/
    CMakeLists.txt headless.cpp          # external minimal consumer
    session.hpp browser_main.cpp windows_main.cpp
  docs/simulator.md                     # delivered API only
  docs/simulator-validation.md          # actual platform evidence

CafeGame/
  src/simulation.hpp                   # cafe session and policies
  src/browser_main.cpp                 # existing time/input/storage boundary
  src/cafe_scene.*                      # existing presentation projection
  tests/simulation_test.cpp             # cafe-specific acceptance
  tools/browser-smoke.cjs               # visible service-loop acceptance
```

Engine implementation must also update its architecture, feature documentation
and engine-skill copies as required by its repository instructions. No such
implementation or architecture change is made by this consumer-side plan.

## Delivery stages and acceptance gates

| Stage | Deliverable | Required evidence |
| --- | --- | --- |
| 1: this plan | Boundaries, lifecycle, reuse audit and release criteria | Source references and document links checked; no implementation claims. |
| 2: foundation | Standalone target, identities, inventory, reservations | Fresh standalone native and Wasm consumer; no graphics/dependency discovery; atomic reservation, capacity, overflow and stale-ID tests. |
| 3: production | Processes, jobs, worker assignment and station slots | Contention, cancellation at every stage, removal, stale arrival, bounded catch-up and equivalent elapsed-time partition tests. |
| 4: service | Customers, queues, order claims and receipts; headless loop | Multi-item orders, fairness, insufficient stock, abandonment, repeated delivery, event limits and reservation cleanup tests. |
| 5: integration | Snapshot codec, CafeGame service loop, diagnostic view and minimal Windows host | Mid-production save/restore, invalid restore preservation, receipt retry, restored travel and native/browser gameplay checks. |
| 6: release | API guide, standalone example, changelog, CI and known limits | Clean consumer builds, headless native/Wasm parity fixtures and recorded browser/Windows evidence. |

Release acceptance requires a scripted scenario with one station, one worker and
two customers competing for finite ingredients, plus interruption/save cases.
Assert conservation of stock, no leaked reservation/slot, no duplicate production
or reward, and stable outcomes for identical commands. Compare canonical state and
event traces between native and Wasm, excluding transient runtime epochs.

CafeGame must keep its cozy art direction and accessible text-based order feedback.
Use its current HTML HUD first; engine examples can use `GuiSystem`. Display order,
job, stock and blocked reason without forcing a new GUI system into the library.
Run CafeGame's documented cloud validation after integration; verify forced WebGL 2
and actual WebGPU separately where hardware permits. A software fallback check
does not establish hardware WebGPU, physical mobile support or performance.

## Explicitly deferred

Advanced staff AI, behavior trees, shifts/skills, placement/building tools,
seating/path occupancy simulation, recursive supply chains, deliveries/restocking,
spoilage, complex accounting, progression, multiplayer and offline catch-up are
outside v0.1. Navigation, rendering, audio and physics remain engine responsibilities.
Do not add a general ECS, scheduler, scripting system, event bus or serialization
framework. Publishing a release/tag and updating CafeGame's engine pin are later
delivery steps, not outcomes of this document.

## Stage 5 implementation

Snapshot persistence and CafeGame adoption are implemented; see [integration and evidence](simulator-saves.md). This supersedes the earlier stage-status notes. Native console host source is included; native execution evidence remains outstanding.

## Stage 7: movement and interaction adapters

Implemented as a follow-on to the v0.1 plan: portable travel tickets and guarded completion in WebEngine, scene actor/interaction bindings in CafeGame, visible barista/customer travel and fresh navigation after load. See [movement contract and evidence](simulator-movement.md). Stages 8-10 are delivered follow-ons documented below.

## Stage 8: spatial occupancy

Implemented as an optional portable OccupancyPool with compact FIFO queues and stable exclusive seats/access points. CafeGame starts with three guests and supports queue refill, exclusive service, dining and departure cleanup. See [contract and validation](simulator-occupancy.md).

## Stage 9: workflows and staff

Implemented as an optional TaskBoard above production jobs, with dependencies, role/shift matching, priorities and interruption. CafeGame uses linked service tasks and lower-priority table cleaning. See [workflow integration](simulator-workflows.md).

## Stage 10: supply and restocking

Implemented as a follow-on: atomic inventory transfers and optional SupplyBoard with reserved incoming capacity, delivery deadlines, cancellation, typed restore and automatic reorder policies. CafeGame uses finite starting stock and envelope schema 4. See [supply integration](simulator-supply.md).

## Stage 11: economy

Implemented as a follow-on: optional portable Ledger with bounded journal, integer postings, source sequence watermarks, prepared publication and typed restore. CafeGame adds paid supplies/refunds, staffed-time wages, wage arrears and a finance panel in envelope schema 5. See [economy integration](simulator-economy.md).

## Stage 12: quality and maintenance

Implemented as optional Freshness/Condition value mechanisms and atomic stock disposal. CafeGame adds timed cup expiry, visible machine wear/dirt, cleaning and paid repair tasks, refunds and schema-6 joint persistence. See [quality integration](simulator-quality.md). The remaining agreed stages are recorded in [the roadmap](simulator-roadmap.md).


Stage 13 delivers optional grid layout validation, enabled occupancy indices and CafeGame placement/commerce/navigation integration. See [layout contracts](simulator-layout.md). Core snapshot schema and renderer pin are unchanged.


Stage 14 delivers optional demand timing/randomness/scoring and CafeGame profile, traffic and review integration. See [demand contracts](simulator-demand.md). Core snapshots and the renderer pin remain unchanged.
