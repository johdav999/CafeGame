# Asset pipeline

## Menu notebook artwork (2026-10-30)

`assets/ui/menu-cafe.webp` is a 768 × 512, 43,076-byte banner generated with
the built-in ImageGen tool. The full prompt, original master path and packaging
settings are in `assets/ui/menu-cafe.provenance.json`. The notebook reuses
reviewed ImageGen icons for sections and save controls; CSS provides layout
and interaction states. `web/menu-panel.js` relocates existing controls while
preserving their host bindings and simulation ownership. Service continues
while browsing unless the player pauses explicitly.

The focused browser check is `node tools/menu-panel-smoke.cjs`, with Playwright
and the usual `BROWSER_EXECUTABLE` / `CAFE_URL` options. It exercises section
links, save/load and preference persistence, plus 1440, 768 and 390px layouts
on WebGL 2 and automatic backend selection. Evidence goes to
`build/evidence/menu-panel/`; these checks do not establish mobile performance.

## Attractiveness reward effects (2026-10-29)

The HUD counts positive score changes over 400 ms, pulses the value, bounces
the existing heart, and displays three drifting sparkles plus a combined `+N`
for nearby gains. Crossing 50, 75 or 100 adds a soft expanding halo. Initial
state, session replacement and decreases do not celebrate. Reduced motion
(system or game setting) shows the final value and a static gain label.

Visibility correction: the pulse/bounce now lasts 650 ms, 28px sparkles begin
around the heart and remain visible during their outward drift, and the gain
label uses the existing ImageGen paper skin with 18px text for 1.5 seconds.
Rapid gains update that label without rewinding an active bounce. Browser
checks sample actual transforms, opacity, sprite sizes and the label background
in addition to checking totals, resets and reduced motion.

`assets/ui/appeal-sparkle.webp` and `appeal-halo.webp` were generated with the
built-in ImageGen tool, then cropped and resized with alpha preserved. Full
prompt, crop coordinates and hashes are in `assets/ui/appeal-fx-provenance.json`.
No effect artwork is drawn procedurally. Animation is presentation-only in
`web/appeal-fx.js`; C++ emits a session-replacement event to reset its baseline.
Run `node tools/appeal-fx-smoke.cjs` with Playwright and `BROWSER_EXECUTABLE`
configured to check both renderer selections and desktop/mobile viewport layouts.

For the browser activation compatibility fix and sound checks, see
[browser sound activation](audio-activation.md).

The attractiveness gain now plays the requested ElevenLabs chime through the
engine effects bus (cue 12, `audio/appeal.wav`). Positive changes coalesce at
700 ms intervals; initial values, session replacements and decreases stay silent.
Reduced motion retains the chime; effects volume, master mute, gesture activation,
pause and hidden-tab suspension use the existing audio controls. The 1.2-second
mono 16 kHz PCM export is 38,444 bytes, with a 0.4 peak and provider provenance
in `assets/audio/elevenlabs-provenance.json`. Reproduce the offline packaging with
`node tools/prepare-appeal-audio.cjs`; no generation request is made.
Run `node tools/appeal-audio-smoke.cjs` against a built preview to check the
actual engine PCM, rapid gains, resets, reduced motion, pause and mute on both
renderer selections. This check uses model fallbacks and does not establish
speaker/headphone quality or physical-device performance.
Validation on 2026-10-29: Windows browser build, all 21 Node tests, and the
audio smoke on WebGL 2 and automatic selection passed. Both browser runs matched
the engine voice buffer to the packaged chime; evidence is
`build/evidence/appeal-audio.json`. Listening review remains outstanding.

## Cafe architecture

Slots 10 and 11 load `cafe-wall.glb` and `cafe-floor.glb`. The two walls share
one immutable wall mesh; the floor uses one continuous slab to avoid tile seams.
Primitive walls/floor remain available when loading fails, and rejected replacement
data preserves the current mesh. Floor finish purchases still apply a restrained tint.

`tools/prepare-cafe-architecture.py` packages the reviewed Tripo masters with 1024px
JPEG textures at quality 90. It preserves the reviewed geometry and UVs, then
reimports each final GLB and rejects open or non-manifold surfaces. The wall retains
45,744 triangles because its aggressive 3,000-triangle derivative failed visual
review; the floor uses the reviewed 3,000-triangle version. Packaged sizes are
1,366,904 and 333,144 bytes respectively. Architecture has a dedicated 2 MiB limit
in both host and scene loading; other static props retain their 1 MiB limit.

Hashes, provider jobs, references and preparation are recorded in
`assets/models/cafe-architecture-provenance.json`. The source masters remain in
ignored `assets/generated/architecture-20261027/`. Run `npm test` for exported
surface/hash/budget regressions and `node tools/cafe-models-smoke.cjs` for both
browser backends. Surface checks complement visual inspection; they do not prove
absence of every possible shading or UV defect.

The browser plays local approved assets; provider calls run only in Node during development.
Copy `.env.example` to `.env` and supply your own keys. Neither builds nor CI require provider accounts.

## ElevenLabs

The eleven event effects are generated with ElevenLabs sound v2. The ambience
slot now plays both user-supplied recordings, `assets/audio/cafesound1.wav` and
`assets/audio/cafesound2.wav`, in one 15.72-second repeating sequence. Both
transitions use 300 ms crossfades; levels are matched and the original files
remain unchanged. The existing Ambience slider, mute, pause and visibility
controls apply to the complete loop. No provider call or paid generation is used.

Reproduce that runtime loop with `node tools/prepare-cafe-background.cjs`
(Playwright on `NODE_PATH`, optional `BROWSER_EXECUTABLE`). Its source hashes,
normalization and loop metrics are in `assets/audio/cafe-background-provenance.json`.

Reproduce the original ElevenLabs WAV set from retained MP3 drafts with
`node tools/prepare-cafe-audio.cjs` (Playwright on `NODE_PATH`, optional
`BROWSER_EXECUTABLE`). It makes no provider calls. Source requests, hashes and
normalization/loop metrics are in `assets/audio/elevenlabs-provenance.json`.
Run `npm test` for PCM/budget/hash checks and `node tools/audio-smoke.cjs` against
a built preview for event playback and audio lifecycle checks on both backends.
For environments that deny loopback sockets, set `CAFE_LOCAL_FILES=1` to route
the built site through Playwright. Set `CAFE_AUDIO_ONLY=1` to exercise the same
audio/gameplay runtime with existing primitive model fallbacks, independently
of GLB decoder performance. The evidence records both options explicitly.
The headless smoke uses a permissive browser autoplay policy while asserting
the engine's own gesture gate. It does not establish real-device autoplay
permission behavior or audible output quality.
Headphone/speaker listening acceptance remains outstanding.

Integration checks on 2026-10-28: all 17 Node tests and the Windows browser build
passed. The headless WebGL 2 suite exercised all twelve cues and the audio
lifecycle with primitive model fallbacks. Automatic mode loaded all twelve
files, but its headless AudioContext remained suspended; playback in that mode
was not established. See `build/evidence/audio-validation.json` and
`build/evidence/audio-webgl2.json` for the recorded scope and results.

Speech and sound effect requests default to a dry run:

```sh
npm run assets -- speech guest-order "An espresso, please."
npm run assets -- sound espresso-machine "A short espresso machine brewing coffee in a quiet cafe"
```

Add `--execute` to make a paid request. Speech also requires `ELEVENLABS_VOICE_ID`.
MP3 drafts and provenance are written to `assets/generated/`, which is ignored by Git.
Use voices and outputs you have permission to use.

Contracts: [speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert),
[sound effects](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert).

## Tripo3D

```sh
npm run assets -- model espresso-machine "A compact espresso machine, separate object, low poly, brass and dark green"
npm run assets -- model espresso-machine "A compact espresso machine, separate object, low poly, brass and dark green" --execute
npm run assets -- status TASK_ID
```

The tool uses the documented v2 OpenAPI, with explicit `v2.5-20250123` model selection.
Submission writes a receipt with the task ID. Status checks report progress/output without creating another task.
Download the successful GLB output promptly from the returned URL into `assets/generated/`.
The newer v3 API is a separate contract and is not used by this starter.

Contracts: [generation](https://platform.tripo3d.ai/docs/generation),
[task schema](https://platform.tripo3d.ai/docs/schema).

## Approval and runtime integration

Inspect generated assets in Blender before promotion. Use metres, Y-up, a floor-level origin,
consistent scale, embedded GLB textures and a modest triangle/texture budget for browser delivery.
Remove hidden geometry, check normals and collision proxies, and record provider/model/prompt/date,
task ID and usage rights beside the promoted asset.

Promote approved models into `assets/models/` and audio into `assets/audio/`; register paths in
`assets/manifest.json`. Commit approved small assets; use Git LFS or external hosting for large libraries.
Rebuild to copy assets into the browser site. Keep credentials and expiring provider URLs out of the manifest.

The first playable candidate loads approved local entries from the manifest.
The browser validates bounded GLB/PCM payloads, then publishes through the public
engine glTF importer and `SoundAsset`/`AudioSystem`/`BrowserAudioBackend` APIs.
Failed models retain primitives; failed sounds remain silent. Activation occurs
synchronously on a user gesture. The engine audio adapter is staged at build time.
Only models, audio, manifest and provenance are copied; generated drafts are excluded.

The initial set is original offline geometry and synthesized audio from
`tools/create-local-assets.cjs`, not provider output. See
[provenance](../assets/provenance.md) and [release/device QA](game-release.md).
Re-run that authoring script only when intentionally replacing the named original
assets and manifest. Future provider assets retain the review requirements above.

## ImageGen + Tripo v3 + headless Blender

For the image-reference workflow, use the repository-local
[tripo skill](../.agents/skills/tripo/SKILL.md).
The existing Node starter commands above remain the legacy v2 path.
The Python skill uses Tripo v3, defaults to a dry run, supports resumable jobs,
and can clean downloaded static models with a separate headless Blender process.
Use `--execute` only for requested paid generation. Credentials come from
`TRIPO_API_KEY` or optional Windows DPAPI storage; do not put new keys in dotenv files.
See [the skill instructions](../.agents/skills/tripo/SKILL.md) for commands,
reference provenance, cleanup QA and promotion requirements.
Run `python -m unittest discover -s tests -v` for the Python tools, plus `npm test`.

## Animated barista

Manifest model slot 4 uses `models/Barista-animated.glb`, fitted from the supplied
Barista mesh and Mixamo Idle/Walking FBX files. Its adjacent provenance JSON records
the authoring checks. Runtime textures are reduced to 1024 pixels (3.6 MB GLB,
12 MiB decoded texture data) while preserving all geometry and animation data.
Each staff actor owns an engine `SkeletalMeshComponent`:
Idle loops while stationary, Walking loops during motor movement, with a 0.15-second
crossfade and facing set from horizontal velocity. Playback uses the application
clock, so pausing the shift also pauses animation. Travel remains motor-driven.

The character slot permits up to 8 MiB and requires a skin plus both named clips
before publishing a replacement. Other asset limits remain 1 MiB. A failed initial
load retains the primitive staff visual; a rejected replacement retains the current
model. Run `node tools/barista-smoke.cjs` against a built preview (`CAFE_URL`, optional
`BROWSER_EXECUTABLE`, and Playwright on `NODE_PATH`). It checks both renderer choices,
moving/stationary transitions, pose updates, pause/resume, and invalid replacement,
and writes screenshots and diagnostics under `build/evidence/`.

## Animated guest

Manifest slot 1 loads `models/Guest-animated.glb`: an ImageGen-referenced Tripo guest
with a fitted 65-joint Mixamo rig, supplied Idle/Walking motion, and a matching
game-authored Seated pose. Each guest has independent playback through the engine
skeletal component; navigation controls travel and dining faces the table rotation.
The guest shares the 8 MiB character limit and requires all three named clips before
publication. Invalid replacement preserves the current character.

The model has 11,166 triangles and three embedded 1024-pixel textures. Coincident
export seams were welded before binding; the resulting mesh has zero boundary or
non-manifold edges. Reimport checks also verify closed geometry in sampled posed
frames, finite animation, loop closure, and normalized weights with at most four
influences. Front/back/side/underside and deformation previews are retained under
`assets/generated/guest-terracotta/`, alongside the editable Blender master.
Provider task, prompt, source hashes, cost and validation are recorded in
`assets/models/Guest-animated.provenance.json`. Fingers follow the hand bones.

Run `node tools/guest-smoke.cjs` against the built preview with the same browser
environment options as the barista check. It exercises walking, waiting, dining,
pause, invalid replacement, save/load and departure on both renderer choices.
This check passed on Edge WebGL 2 and WebGPU on 2026-10-27; evidence is in
`build/evidence/guest-browser.json`. This does not establish mobile performance.

### Additional animated guests

Slots 12–14 add `Guest-sage-animated.glb` (silver-haired guest in sage),
`Guest-forest-animated.glb` (curly-haired guest in a green cardigan), and
`Guest-oat-animated.glb` (dark-haired guest in an oat overshirt). All three were
generated from separate built-in ImageGen references with Tripo v3, fitted to the
supplied Mixamo skeleton in Blender, and carry Idle, Walking and Seated clips.
Guest IDs cycle through the original and these three appearances; selection
survives save/load without changing the save format. Each actor owns its playback.
Unavailable variants fall back to the original guest. Invalid replacements retain
the current asset, and each new slot uses the existing 8 MiB character limit.

Each new mesh has about 12,000 triangles, 65 joints and three embedded 1024-pixel
textures. Reimport checks cover normalized weights, at most four influences,
finite poses, closed loops and closed posed topology. The forest guest needed a
localized repair of a tiny overlapping triangle fan at the cardigan hem. Adjacent
provenance JSON files record source hashes, prompts, fits, repairs and validation;
editable Blender masters and review images remain in ignored
`assets/generated/guest-{sage,forest,oat}/`.

Run `node tools/guest-variants-smoke.cjs` with the same browser environment as the
guest check to exercise the four-appearance roster and each new mesh's full
service lifecycle on both renderer choices. It writes
`build/evidence/guest-variants-browser.json` and walking/seated screenshots.
All six lifecycle runs passed on Edge WebGL 2 and WebGPU on 2026-10-27, including
the four-appearance roster, pause/resume, invalid replacement, save/load and
departure. Native Windows host and physical-mobile performance remain untested.

## Plants and pots (2026-10-28)

Seven reviewed Tripo models occupy manifest IDs 15–21: snake, rubber, jade and
monstera foliage, plus terracotta, fluted oat and sage pots. Each GLB is under
165 KB and 3,000 triangles, with embedded 512-pixel textures. Shared meshes
support 12 combinations without extra downloads. References, full ImageGen
prompts, jobs and raw models are in assets/generated/plants-20261028; production
receipts are in assets/models/cafe-plants-provenance.json. The reproducible local
budget/export/review step is tools/prepare-cafe-plants.py.

Final exports passed closed-surface checks and were reviewed from six Blender
angles and in-game on WebGL 2 and WebGPU. A tiny extraneous sage-rim flap was
removed before export; no holes were filled. The fourth forest/brass pot request
returned HTTP 403 without a task ID and was not retried or integrated.

Validation: 16 offline Node tests, the focused native simulation test, browser
build and all 12 browser style/save combinations passed. This does not establish
mobile or hardware performance.

## Pastry display (2026-10-28)

The counter pastry placeholder is replaced by a Tripo two-tier oak display with
croissants, cinnamon buns, forest-green backing and brass tray lips. Manifest
slot 22 uses cafe-pastry-display.glb; the existing primitive remains the fallback
when loading fails. Game rules, saves and pastry stock are unchanged.

The built-in ImageGen reference and complete prompt are retained under
assets/generated/pastry-display-20261028/references. The first attempt failed
with HTTP 403; the authorized retry succeeded after API credits were added.
Task c7d64e78-2ff3-447b-a3cf-345de93ddba9 produced the raw model. Preparation is
reproducible with tools/prepare-pastry-display.py after the skill's seam-welded
10-percent cleanup. Six inspected extra surface flaps were removed without
hole filling. The display is 0.55 metres tall with 4,474 triangles and embedded
1024px textures. Production hashes and authoring details are in
assets/models/cafe-pastry-display-provenance.json.

Pastry validation: browser build passed; all 18 Node tests passed, including
closed-surface and provenance checks for the pastry display. The exact final
466,920-byte model passed browser loading, invalid-replacement rejection and
visual inspection at default, orbit, overhead and close camera views on WebGL 2
and WebGPU. Evidence: build/evidence/pastry-display-browser.json and
build/evidence/pastry-display-*.png. Close-up faceting remains from reduction;
no unexplained surface holes or flicker were observed. No mobile performance
claim is made.

## Storage shelves (2026-10-28)

The fixed storeroom now uses two instances of the new Tripo shelving unit. The
purchasable Storage shelf uses the same shared model and follows the existing
placement, rotation, resale and save/load behavior. Prices, footprints and
inventory capacities are unchanged; separate stock-indicator bags remain above
the fixed shelves. Primitive fallbacks remain available on asset load failure.

Manifest slot 23 is cafe-storage-shelves.glb. Authoring uses the saved built-in
ImageGen reference and prompt under assets/generated/storage-shelves-20261028.
The authorized retry task is 4942da49-7a3d-4c88-871e-e78ca1e0c49f. Preparation is
reproducible with tools/prepare-storage-shelves.py after seam-welded 18-percent
cleanup. Three inspected source flaps, one tiny isolated triangle and loose
edges were removed without hole filling. The 1.6m-tall export has 7,408 triangles
and 1024px embedded textures; metadata is in
assets/models/cafe-storage-shelves-provenance.json.

Storage validation: browser build and all 19 Node tests passed. The exact
554,556-byte export was inspected from six Blender views and in-game on WebGL 2
and WebGPU. Purchase, four rotations, resale, save/restore and invalid-model
replacement rejection passed on both backends with no browser errors. Evidence:
build/evidence/storage-shelves/report.json and rotation screenshots. Some close-up
faceting remains from reduction; no unexplained gaps or flicker were observed.
No physical-mobile or hardware performance results are claimed.

## Window wall (2026-10-28)

Manifest slot 24 replaces the solid back wall and flat window placeholders with
three shared Tripo window bays. Each bay has recessed oak casing, six glazed
panes, mullions, a projecting sill, oat plaster and green wainscoting. The side
wall remains the existing architecture asset. Failed imports retain the original
back wall and panes; invalid replacements retain the already loaded model.

The built-in ImageGen reference and full prompt are preserved under
assets/generated/window-wall-20261028. Tripo task
e6cdee99-58fa-40e6-a2ea-c1f41ddc9b41 used 60 credits. The source had three tiny
stray fins and six missing glazing centers. tools/repair-cafe-window-wall.py
removes the fins and reconstructs only the inspected glazing contours using the
original ImageGen glass artwork. tools/prepare-cafe-window-wall.py welds seams
before reduction, normalizes the bay to 4 × 4 × 0.42m, flattens joining strips and
glazing, and corrects pane normals. Raw and intermediate files remain preserved.

The final 1,109,960-byte GLB has 18,000 triangles and embedded 1024px textures.
Its reimported surfaces have zero boundary or non-manifold edges. Regression
checks also shoot through all six pane centers because a closed frame alone
cannot establish the presence of glass. Production hashes, generation details,
repair measurements and review evidence are recorded in
assets/models/cafe-window-wall-provenance.json.

The exact final export was inspected from six Blender views and at default,
close, left, right and overhead game views on WebGL 2 and WebGPU. Some stylized
joinery irregularity remains at close range; no unexplained holes or flicker
were observed. Evidence: build/evidence/window-wall/report.json and screenshots.
These checks do not establish mobile or hardware performance.

## Character color correction (2026-10-28)

Animated baristas and guests previously inherited MeshComponent's blue instance
tint `(0.3, 0.65, 0.9)`. The engine multiplies this tint by the imported material
and texture, suppressing red and giving skin, grey hair and clothing a cyan cast.
The static-character fallback already assigned its own tint, while the skeletal
path omitted it. CafeWalker now explicitly initializes the skeletal component
with white `(1, 1, 1)`, preserving the authored texture colors under the existing
warm sunlight and ambient fill. No texture, lighting or engine changes are needed.

The character color review tool is tools/character-colors-smoke.cjs. Its isolated
browser sessions exercise the default three-guest roster, the fourth oat variant
and the barista on WebGL 2 and WebGPU, with before/after screenshots under
build/evidence/character-colors. These checks establish rendered appearance and
asset loading, not hardware or mobile performance.


## Achievement medallions (2026-10-29)

18 separate built-in ImageGen calls produced one transparent badge for every
lifetime achievement, aligned by the stable goal IDs in src/journal.inc. The
reviewed forest enamel, brass-rim and ribbon artwork is packaged as
assets/ui/achievements/badge-0.webp through badge-17.webp, with a 384px maximum
dimension, preserved generated alpha and 703,908 bytes total. Each badge has
a distinct central motif. Prompts, original paths, copied masters, hashes and
final dimensions are recorded in assets/ui/achievements/provenance.json.
Masters remain in the ignored assets/generated/achievements-20261029 directory.

The achievement modal and shelf reuse the existing ImageGen panel.webp and
button.webp skins. CSS supplies layout, focus and interaction states; no badge
artwork or textures were drawn procedurally. tools/prepare-achievement-badges.py
performs format/size packaging and refuses to overwrite reviewed outputs.
