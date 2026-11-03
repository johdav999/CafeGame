# CafeGame assets · 2026-10-26

## ElevenLabs sound integration · 2026-10-28

The owner requested generation and integration of twelve ElevenLabs sound effects.
This supersedes the original synthesized audio described below. Manifest audio
IDs 0–3 retain brew, cup, door and ambience; IDs 4–11 add grinder, steam, payment,
ready, pour, pastry, clean and UI. `audio/elevenlabs-provenance.json` records full
generation requests, dates, available provider request IDs, hashes and export metrics.
Original MP3s/receipts and previous local WAV backups remain in ignored
`assets/generated/elevenlabs-cafe-20261028/`.

`tools/prepare-cafe-audio.cjs` decodes the existing recordings offline with Chromium,
downmixes/resamples to the current mono 16 kHz 16-bit PCM contract, removes DC,
trims one-shot silence, fades attack/release and limits RMS/peaks. Ambience uses
a 300 ms overlap at its seam and a lower target level. All assets fit the 1 MiB
loader budget. This is editing of generated recordings; no new audio is synthesized.
The game retains gesture activation, bus controls, pause/visibility suspension
and silent fallback. Machine cues follow running jobs, cleaning follows running
workflow tasks, and transient playback is cleared on scenario/day/load replacement.
No provider requests or credentials enter the browser bundle.

User integration approval is recorded by the manifest. Provider account plan and
distribution entitlement have not been independently verified. Technical PCM and
browser playback checks do not constitute listening review on headphones/speakers.

## Integrated Tripo cafe props

The owner requested generation and then integration of the coffee machine,
espresso cup, straight/corner counters, table and chair. These six `cafe-*.glb`
files use built-in ImageGen references and Tripo v3. Task IDs, reference prompts,
provider settings, source/output hashes and measured budgets are recorded in
`models/cafe-provenance.json`. Account entitlement has not been independently
verified; this record does not grant third-party rights.

`tools/prepare-cafe-models.py` prepares the retained drafts offline in Blender:
Y-up, floor-level pivots, aligned facing, game-sized furniture, at most 9,000
triangles for the machine and 2,800 for repeated props, 1024px machine textures
and 512px prop textures. All GLBs remain below the existing 1 MiB loader limit.
Original masters/references remain ignored in `assets/generated/cafe-set-20261026`.
The game shares mesh resources and keeps primitive fallback geometry, layout
footprints, navigation, serving and cleaning rules. No provider calls run in-game.

## Original neighbours and audio

The original `house-machine.glb`, neighbour models and audio are CafeGame work authored mathematically by
`tools/create-local-assets.cjs`. No provider, downloaded reference, recording,
voice likeness, external texture, paid request or third-party asset was used.
They may be distributed and modified with CafeGame. Re-running the script is
offline and deterministic; it replaces only its named original files/manifest.

Models are glTF 2.0 binary, metres, Y-up, floor-level origins, with embedded
geometry and matte palette materials. The machine origin is its counter base.
The standing/seated neighbours wear terracotta, and staff wear forest with an
oat apron. Working staff raise their arms. These are static pose swaps, not
rigged animation; locomotion remains the engine's character motor. Repeated
meshes are shared, and missing/rejected models retain engine primitives.
There are no textures, skeletons, external URIs or runtime provider services.

Audio is mono 16-bit PCM WAV at 16 kHz: a soft filtered-style hiss/pump cue
(`brew`), decaying ceramic-like tones (`cup`), a soft bell (`door`) and a quiet
synthetic room bed (`ambience`). No speech or music is installed. The ambience
has a short fade at its loop boundary. Files have finite samples, peaks below
0.16 and short attack/release envelopes. They are intentionally simple original
effects; listening on headphones/speakers remains part of device acceptance.

The manifest approves this original asset set for the local release candidate.
QA is recorded in `docs/game-release.md`; hardware/mobile appearance and audio
quality remain release gates where no device evidence has been recorded.
Future Tripo/ElevenLabs content needs its own authorization, provenance and QA;
these local assets grant no authorization for provider requests.

## Tripo surface repair · 2026-10-27

The six `cafe-*.glb` static props were rebuilt from their preserved Tripo masters
after disconnected UV/normal seams were found to open cracks during decimation.
Preparation now reconnects positional seams, recalculates normals and rejects
boundary growth before export. Provider jobs, textures and triangle budgets are
unchanged. Updated hashes and topology measurements are recorded in
`models/cafe-provenance.json`; the diagnosis, exported-geometry regression and
browser evidence are described in [the repair report](../docs/model-surface-repair.md).
No new provider generation was submitted.

## Tripo guest with Mixamo rig · 2026-10-27

`models/Guest-animated.glb` was generated from the original built-in ImageGen
reference using Tripo v3.1, with explicit user approval for paid generation.
The provider reported 60 credits. It was normalized, seam-welded, fitted to the
user-supplied Mixamo rig, and animated with supplied Idle/Walking clips plus a
game-authored seated pose. Mesh checks found zero open boundary and non-manifold
edges after welding, including sampled exported animation poses. Full source
hashes, reference prompt, provider task and QA are in
`models/Guest-animated.provenance.json`. This entry supersedes the original
untextured-neighbor description for manifest slot 1.

## Tripo architecture integration · 2026-10-27

Manifest slots 10 and 11 use the user-requested Tripo wall and oak floor generated
from built-in ImageGen references. Integration adds no provider calls or charges.
The final wall preserves its reviewed 45,744 triangles; the floor preserves its
reviewed 3,000 triangles. JPEG packaging at quality 90 reduces the reviewed GLBs
from 3,581,908 / 3,448,812 bytes to 1,366,904 / 333,144 bytes respectively.
Both retain 1024px textures. Final exports reimport with zero open or non-manifold
positional edges and have front/back/top/underside Blender review captures.
The game uses shared walls and a continuous floor without repeating slab seams.

Provider tasks, prompts, hashes and packaging are in
`models/cafe-architecture-provenance.json`. Reproduction is in
`tools/prepare-cafe-architecture.py`. Browser model-load and camera review evidence
for WebGPU and WebGL 2 is in `build/evidence/architecture-browser.log` and
`cafe-models-*.png`; Blender captures are in `architecture-views/`.
Browser checks use a 0.5 render scale and do not establish full-resolution or
physical-mobile performance. Account entitlement remains recorded as unverified;
the owner explicitly requested generation and integration.

## Three additional Tripo/Mixamo guests · 2026-10-27

The user requested three additional generated, rigged and animated guests.
Separate built-in ImageGen references produced the sage, forest and oat guests;
Tripo v3 tasks consumed 60 credits each (180 total). The supplied Neutral Idle and
Walking Mixamo FBX files provide motion on individually fitted 65-joint rigs.
A matching Seated pose is authored in Blender. Fingers follow the hand bones.

Manifest slots 12–14 use `Guest-sage-animated.glb`,
`Guest-forest-animated.glb` and `Guest-oat-animated.glb`. Each has about 12,000
triangles, three 1024px textures, normalized weights and closed animation loops.
The forest mesh required local repair of an overlapping triangle fan at the
cardigan hem. All final exports passed posed topology checks with zero open or
non-manifold edges. Adjacent `.provenance.json` files contain prompts, reference
and source hashes, provider task IDs, fit coordinates, repair details and results.
References, editable Blender masters and review images remain under ignored
`assets/generated/`. Tripo entitlement and supplied Mixamo rights have not been
independently verified. No additional paid regeneration was submitted.

## Tripo plants and pots — 2026-10-28

Four foliage variants (snake, rubber, jade, monstera) and three pot variants
(terracotta, oat, sage) were generated from individually reviewed built-in
ImageGen references at the owner's request. Full prompts and references are
preserved in assets/generated/plants-20261028/references. Production model
hashes, task IDs, requests and cleanup metrics are recorded in
assets/models/cafe-plants-provenance.json. Final exports were visually reviewed
from six angles and in the game on WebGL 2 and WebGPU. The requested fourth
forest pot returned HTTP 403 at submission and was not retried. Provider account
entitlement has not been independently verified.

## Tripo pastry display — 2026-10-28

One pastry display was generated with Tripo v3.1 from the saved built-in ImageGen
reference. The successful retry task is c7d64e78-2ff3-447b-a3cf-345de93ddba9.
Reference image and complete prompt: assets/generated/pastry-display-20261028/references.
Raw output and cleanup remain in that ignored directory; final hashes, settings
and repair details accompany assets/models/cafe-pastry-display-provenance.json.
Generation and integration were requested by the owner; provider account
entitlement has not been independently verified.

## Tripo storage shelves — 2026-10-28

One storage shelving unit was generated from the saved built-in ImageGen
reference and prompt in assets/generated/storage-shelves-20261028/references.
Task 4942da49-7a3d-4c88-871e-e78ca1e0c49f succeeded on the authorized retry after
API credits were replenished. The original failed receipt is preserved.
Raw output and cleanup remain in the ignored authoring directory. Production
hashes, settings and local repairs accompany cafe-storage-shelves-provenance.json.
Generation and integration were requested by the owner; account entitlement has
not been independently verified.
