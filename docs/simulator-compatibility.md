# Stage 16: compatibility, performance and long replay

CafeGame now writes envelope **9**, with content version 1 and rule revision 1.
Core Runtime snapshots remain schema 1, and the renderer dependency pin is unchanged.
This adds explicit compatibility decisions and repeatable scale/stress tools; it
does not make a hardware performance or final release acceptance claim.

## Content and save compatibility

The last 16 bytes of a format-9 save are little-endian uint64 words containing
content version and fingerprint. The first 88 bytes and the existing payload
sections keep their offsets. A bounded preflight checks magic, supported envelope,
content version and fingerprint before the detached joint game restore runs.
Invalid input never replaces the current game, emits historical payments or changes
the device save. Successful restore rebases identities and rebuilds browser travel.

`currentContent()` hashes canonical resource/process definitions (including bundle
quantities, durations and capabilities), profile patience/weights/takeaway behavior
and `ruleRevision`. Strings are length-prefixed UTF-8, numbers explicit little-endian
uint64 words, using FNV-1a 64. Display names and preset initial conditions are not
saved-shift rules. Fingerprints are identifiers/checksums, not authentication or
cryptographic integrity protection. A deliberately modified local save is not an
anti-cheat boundary.

When changing game policy in simulation.hpp or a policy .inc file, bump ruleRevision
in src/compatibility.hpp if the interpretation of existing saved state changes.
Catalog/profile changes alter the fingerprint automatically. Bump contentVersion
for a new content compatibility family. Both mismatched versions and fingerprints
reject until an explicit, reviewed migration is implemented. Never change the
frozen `legacyContent` identity to make unknown old content appear compatible.
The loader reports different messages for malformed data, future save formats,
content versions and rule/catalog mismatches. `inspectSave` is a metadata preflight,
not complete body validation; `Simulation::restore` performs both and returns a
LoadResult. The existing bool load API remains available.

## Explicit migration table

Only the frozen default historical rules may import envelopes 1..8. Old core
catalogs and every reconstructed subsystem still pass full validation. These old
formats carry no content stamp: import assumes the historical default policy.
An old custom fork with identical serialized definitions cannot retroactively
prove its original prices/weights. New format-9 saves remove that ambiguity for
declared revisions and fingerprinted definitions.

| Source | Added during candidate migration to 9 |
| --- | --- |
| 1 | Queue/counter guest claims, staff workflows, empty supplies, opening-cash ledger, quality, default layout, manual demand and content stamp |
| 2 | Staff workflows and all later missing sections |
| 3 | Empty supplies and all later missing sections |
| 4 | Opening-cash accounting and later missing sections; old deliveries remain free |
| 5 | Fresh machine/quality migration and later missing sections |
| 6 | Default tables/open state and manual demand |
| 7 | Manual traffic, deterministic seed and neutral historical reviews |
| 8 | Content stamp; existing demand, reviews and timers are retained |
| 9 | Exact content check and joint validation; no migration |
| Unknown | Rejected, including unknown content under a known envelope |

Historical formats without demand do not gain retroactive reviews. Existing
60-second regular deadlines from early formats remain unchanged; a schema-9 guest
flag explicitly retains that budget for later roundtrips. For format 1 the loader
uses the historical 60-second budget when consistent with its deadline/current
clock, otherwise accepts the known 120-second transitional layout. Later legacy
formats infer 60 seconds only when the deadline predates the 120-second origin.
No original arrival timestamp existed in these formats; the documented budget is
used to reconstruct it. All reconstructed arrival/deadline bounds are validated.

Browser migration happens only when Load shift is requested. It upgrades in memory,
leaves the original localStorage slot unchanged and asks the player to Save shift
to keep the upgrade. The native console uses the same compatibility messages.
No implicit migration is applied to unknown edited catalogs or rule families.

Tests include a frozen schema-8 mid-brew Quiet shift captured from the stage-15
native console, SHA256 3f938fe8c17365fff529ba6d315118838575464c94e4ae5e37dc011a983a5cae,
plus prior format fixtures, an authentic 60-second format-1 core, malformed/truncated
input, future schemas and content mismatches. The fixture is embedded as hex in
tests/fixtures/schema8.hpp so native and Wasm execute identical bytes without IO.

## Portable mechanisms and runtime cost

Include engine/simulator/compatibility.hpp for ContentHash, ContentStamp,
checkContent and checkpointHash. These are optional standard-C++20-only values.
The engine does not own Cafe envelopes, migration policy, files, scenes or clocks.
Runtime::metrics() returns O(1), allocation-free retained-record and event counts
with configured Limits. Counts include terminal records until the owner retires
them; they are not process memory/RSS readings. The browser inspector/export shows
save/content identity, record occupancy and current job/customer limits.

Runtime::advance scans for due production/expiry transitions. A clock-only step
publishes time without cloning the state or allocating. Due transitions keep the
existing staged candidate, deadline/ID tie ordering, transition budget and outbox
backpressure. assign with no queued jobs also avoids a full state copy. Generic
contracts cover zero/due deadlines, full outboxes, expiry, stale IDs, saturation,
restore and retirement. This does not remove the O(retained records) deadline scan
or the staged copy cost for real mutations. No broad high-concurrency guarantee is
claimed; retire terminal jobs/customers/reservations and drain events explicitly.

## Long stress, replay and scale reports

Build the independent tests targets; CTest runs one simulated hour automatically.
For longer experiments:

```sh
npm run stress -- --seconds 21600 --seeds 123,456 --scale 1024 --output build/evidence/stress.json
npm run stress -- --host build/simulation-stage15-native/Release/cafe_stress.exe --compare build/simulation-wasm/cafe_stress.cjs --seconds 86400 --seeds 123,456 --scale 1024 --output build/evidence/stress-parity.json
```

The wrapper discovers common native/cloud/Wasm paths or accepts --host/--compare.
Bounds are 60..86400 whole seconds, 1..8 nonzero uint32 seeds and maximum scale
16,64,256 or1024. No output file is written unless --output is supplied. Each host
has a ten-minute execution timeout. The console form is
`cafe_stress SECONDS SEED MAX_SCALE_RECORDS`.

`stress-v1-zero-travel-100ms` uses the stage-15 reference service policy with
scripted breaks, cancellations, supply/maintenance interruptions, temporary
closures and drained layout edits. Two independent games receive the same commands
and 100 ms steps. Every 997 ticks, and at the end, their canonical saves must match;
one game restores its checkpoint, checks roundtrip equality and rejects stale
handles. The final states and a rolling checksum must match. This tests deterministic
logical state, not a recorded network protocol or a rendered pathfinding benchmark.

On every tick, core customers/jobs/orders/receipts must stay at most eight,
reservations at most one, events drained, tasks at most 32 and ledger entries at
most 128. Snapshot samples must stay within 128 KiB. These are current Cafe ownership
budgets, not generic engine maxima. Reports contain peaks, checkpoint count,
rolling/final checksums, final metrics and measured p50/p95 1000-tick batch times.
Batch time includes both sessions and checkpoint validation; it is not rendered
frame latency.

Generic scale cases create 16/64/256/1024 queued jobs, exercise configured-limit
rejection without partial mutation, measure 1000 clock-only ticks, restore/rebase,
run four production slots and explicitly retire all jobs. They verify stock and
held-capacity conservation and zero retained terminal records at completion.
Reports record enqueue, idle and production microseconds plus canonical snapshot
bytes. Timing samples have no machine-independent pass/fail threshold. Comparisons
exclude wall timings and require exact deterministic values, bounds and checksums.

CI keeps native balance/stress artifacts for Ubuntu and Windows. Cloud/check.sh
includes the compatibility browser smoke and six-hour stress report. Those jobs
must actually run before claiming cloud acceptance. Local dated evidence and
hardware/mobile limitations are recorded in simulator-release.md.
# Current content family

Milestones 17-20 supersede this document's stage-16 game envelope: CafeGame uses
schema 14 / content 5, migrates known menu schema-10 and staff schema-11 shifts into sandbox mode, preserves campaign schema-12 saves and rejects pre-menu
schemas 1-9 without replacing live or stored state. See [equipment persistence](game-equipment.md). The stage-16 migration and
validation notes above are historical; core simulator schema 1 is unchanged.



Rules revision 13 keeps schema 19 and explicitly accepts the same catalog under
rules revision 12. The visitor record/claim bound grows from eight to nine.
Existing guests remain intact, while future normal admissions use the new
attractiveness-derived cap. Unknown rule identities remain rejected.
