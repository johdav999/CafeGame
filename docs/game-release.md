# CafeGame · first playable release candidate

Local candidate, 2026-10-26. Stage 21 source is implemented and rendered journeys
pass on WebGL 2/fallback and Intel hardware WebGPU. Physical-mobile acceptance
remains outstanding. Nothing is published.

## Run

From a source checkout, build with the pinned SDK as described in the root README, then `npm run dev`
and open http://localhost:4173. To force the compatibility renderer, append
`?backend=webgl2`. A packaged candidate contains the site at its root: serve it
over HTTP/HTTPS with `.wasm` mapped to `application/wasm`. For example,
`python -m http.server 4173 --bind 127.0.0.1` from the extracted directory.
Do not open `index.html` directly from the filesystem. No provider keys needed.

## First shift

1. In Serve, choose **Begin guided shift**. This replaces the practice session;
   save from Menu first to preserve it. Open day starts ten active minutes.
2. Read the paper ticket. The large Prepare button starts its whole order.
   Staff walk and perform the equipment steps. Serve the complete ticket when
   staff and customer reach the counter; payment and objective rewards appear.
3. For a shortage, open **Supplies & machine care**. Select the ingredient;
   ready stock belongs to the counter and stored stock belongs to shelves.
   Restock transfers up to four portions with staff travel. If shelves are
   empty, order 12, wait eight simulation seconds, then restock. Auto supply can
   handle these steps while enabled. Cleaning is free; repairs have a cost.
4. Menu contains hiring/priorities/breaks, campaign controls, finances and
   device save/load. Help costs 15.00 plus 1.00 per on-shift minute each.
   Review expenses before hiring. A break stops that worker's wages.
5. Finish or close the day from Menu. Complete remaining orders and let cleanup
   drain. Results explain profit, overhead, goals and any unpaid costs.
   Prepare next day carries your cafe forward. Restart restores the opening
   checkpoint if you need to recover. Save explicitly to keep progress.
6. During preparation, Build shows upgrade prices, earnings/objective gates,
   maintenance tradeoffs, placement/access preview and resale. The speed kit
   costs 30.00 and requires the first objective and 30.00 of ticket earnings.
   Buy only when the cafe is closed and drained. Open day two from Menu.

The first-shift guide follows current game state and can be hidden/reopened.
It never grants resources or skips rules. Practice guest choices are under
Serve's Guests drawer. Detailed presets and diagnostics are optional Developer
tools in Menu; `?tools=1` opens the original full workbench.

## Device sizing and orientation

For desktop debugging, open `preview.html` (for example,
`http://localhost:4173/preview.html`) or choose **Menu → Advanced → Developer
tools → Preview iPhone 16 landscape**. The embedded game runs at 852 × 393 CSS
pixels with phone layout detection. Zoom changes the preview's display size
without changing its viewport or media queries. The safe-area checkbox adds
approximate landscape insets (59px on either side and 21px below). Browser bars,
Safari behavior, touch gestures and phone GPU performance are not emulated.
Renderer query parameters are preserved, e.g. `preview.html?backend=webgl2`.
The preview shares the normal site's local saves and preferences.
Run `node tools/preview-smoke.cjs` to check the preview on both renderer choices;
screenshots are saved under `build/evidence/preview`.

At startup the browser host detects a phone, tablet or desktop using browser
device hints (including iPads using a desktop user agent). `window.cafeDevice`
reports that category, touch support, screen and visible viewport dimensions in
CSS pixels, pixel ratio and current orientation. This is a best-effort category,
not exact hardware identification. Viewport changes update the layout and the
engine continues to own canvas resizing for both renderers.

Mobile play requests landscape at startup, then retries with fullscreen on the
first click/tap where browser permissions require activation. In portrait a
prompt offers **Use landscape** or **Continue in portrait**. Browsers that deny
orientation locking require physical rotation; check the device rotation lock.
The UI fits the visible browser area, reserves safe-area insets, and uses a
compact layout on short landscape screens. The developer workbench keeps its
scrolling layout and does not request fullscreen or orientation changes.

Run `node tools/viewport-smoke.cjs` with Playwright and optionally
`BROWSER_EXECUTABLE`. It reads `build/browser/site` (override with `CAFE_SITE_DIR`)
through local browser request interception, exercises both renderer selections,
desktop/tablet/phone layouts, resizing and denied orientation/fullscreen APIs,
and saves evidence to `build/evidence/viewport`. Emulation does not establish
physical-device rotation support, GPU performance or mobile acceptance.

## Controls and accessibility

The service readability update adds icon tickets and customer patience badges,
linked customer selection and a persistent action bar. See
[customer/service controls and remaining production work](service-ui.md).

Serve / Build / Menu are keyboard tabs (Left/Right/Home/End). All primary
controls target 44 CSS pixels. Menu → Sound & accessibility offers UI scaling,
reduced motion, mute, effects and ambience volume. Preferences stay on this
device separately from the shift save. No music or speech is installed.

Focus the scene and use arrow keys to orbit, WASD to pan, +/− to zoom, R to
reset. Drag or Shift-drag does orbit/pan; wheel zooms only with scene focus.
On touchscreens, drag with one finger to orbit. Spread two fingers on the
scene to zoom in, or pinch them together to zoom out. Both touches must start
on the scene. A pinch preserves any furniture placement preview and does not
trigger service taps or place furniture when a finger lifts.
Camera instructions are in Menu → Sound & accessibility. Orbit, tilt,
pan and zoom are bounded to keep the cutaway room visible. Camera controls
remain available while paused. Camera state is transient.

`node tools/touch-zoom-smoke.cjs` exercises browser touch events and the actual
camera projection on WebGL 2 and automatic backend selection. It checks zoom
direction and limits, one-finger orbit/taps, placement preservation, gesture
cancellation and paused zoom. Evidence is in `build/evidence/touch-zoom/`;
physical iOS/Android touch and GPU acceptance remain separate checks.

Pause freezes gameplay, wages, freshness and audio. A hidden tab suspends the
engine; returning needs another gesture to resume audio. Browser audio policy
may require a click/key. Written tickets, patience, task state and confirmation
remain usable when sound is muted or unavailable. Failed models keep primitive
fallbacks; failed effects remain silent. Missing assets do not block service.

## Content and ownership

The renderer pin remains `56080eca124c9a62e15b146799a8004bdad5a9b2`.
Plant styles use save envelope 15 / content 5 / rule revision 5; format 14 saves
migrate with default styles. Game rules are unchanged. Engine glTF import, shared immutable meshes, character motors,
camera and AudioSystem/BrowserAudioBackend supply the public integration.
The audio adapter is copied from the pinned engine at build time.

Five original small GLBs and four original synthesized WAVs are local files
listed in `assets/manifest.json`; see `assets/provenance.md`. Character poses
swap between standing, seated and working; staff have a contrasting apron.
Windows, rounded chair backs, soft tabletops and gentle steam establish the
morning palette. Furniture and missing assets retain public engine geometry.
These are lightweight authored assets, not Tripo/ElevenLabs outputs. Future paid
generation needs separate authorization. No provider request was made here.

## Package and evidence

After a successful browser build, `npm run release` creates a dated ZIP under
`build/releases` with run notes and SHA-256/file sizes. It uses an explicit
allowlist and excludes provider drafts, credentials and development dependencies.
The build/site and ZIP remain ignored local outputs. Deployment is separate.

`node tools/presentation-smoke.cjs` exercises the normal interface. It writes
dated evidence to `build/evidence/release-presentation.json` and desktop/narrow
screenshots. Its software runs use DPR 0.5 and 1000×760 CSS pixels for the
journey; these are reduced-resolution functional checks. Set
`CAFE_HARDWARE_GPU=1` for the 1280×800 journey without software-rendering launch
flags; inspect adapter identity before counting it as hardware.
`node tools/presentation-device-probe.cjs` records adapter/browser identity.
`node tools/presentation-assets-smoke.cjs` checks real engine bus gains,
gesture unlock, pause/resume, rejected replacements, repeated shutdown and a
paid service with models, sounds and the audio adapter all unavailable.
Cloud runs force WebGL fallback. Existing rule/regression tools
use the explicit developer workbench; the presentation journey does not.

The design targets remain 60 FPS desktop and 30 FPS lower-power devices. A
software-rendered desktop/emulated narrow test cannot establish either target
on hardware or physical mobile. Initial scene/load measurements include browser
and local-server overhead; they are observations, not network-load guarantees.
Record the exact browser, device, adapter, frame samples, load time and package
sizes before final release acceptance. See the dated validation record below.

## Known limits

Static pose changes replace a full character animation rig. Audio is simple
original synthesis; device listening/mix approval remains necessary. The ordinary
HUD is compact, while opening management/build drawers takes additional space.
Narrow layouts preserve a scene above a scrolling bottom panel. Touch button
operation is implemented, but physical touch/device performance requires testing.
Campaign rules, stock and prices retain the stage-20 bounds. No deployment,
multiple locations, multiplayer or runtime AI-provider integration is included.

## Validation · 2026-10-26

- Browser Release build passed with the renderer pin unchanged. The complete
  normal-UI journey passed on forced WebGL 2 and automatic WebGL fallback using
  SwiftShader, then on actual Intel hardware WebGPU (non-fallback adapter,
  gen-12lp in the device probe), Edge 156.0.4314.42 on Windows.
- Each journey completed six paid tickets, a counter-stock shortage/restock,
  machine cleaning, hiring, day close/results, day two, a speed upgrade, explicit
  save/load, camera controls, keyboard tabs, preferences and a 390×844 CSS-pixel
  narrow layout. Desktop and narrow screenshots were visually inspected.
- Hardware journey: 1280×800, DPR 1, 3,162 RAF interval samples; median 16.7 ms
  (about 60 FPS), p95 16.8 ms. First game-state frame 832.3 ms. The engine's
  final GPU window reported mean 0.971 ms, p95 1.049 ms. These local-server
  observations include warmup/jitter and cover this small scene, not every
  future upgrade/guest load or network condition.
- Software journeys used DPR 0.5 at 1000×760. Their post-reload narrow samples
  (44/48 intervals at 186×173 render pixels) had median 50 ms, p95 200/233.3 ms.
  They are functional checks and do not meet or establish device FPS targets.
- Five GLBs plus four PCM WAVs total 437,252 bytes. Main Wasm is 3,236,817 bytes;
  the separately staged asset decoder Wasm is 800,165 bytes. ZIP/file hashes are
  written by the release packaging command; sizes are uncompressed here.
- Focused failure/audio checks passed: gesture activation, actual bus gain after
  mute and volume changes, pause/gesture resume, corrupt GLB/NaN PCM rejection,
  idempotent shutdown followed by visibility events, and a paid service with
  all models/sounds and the audio adapter unavailable. No browser page errors.
- `npm test`: 8/8 passed. All 16 bundled simulator hashes verified;
  `git diff --check` passed. Prior milestone-20 native and Wasm suites passed
  6/6 each; stage 21 changes presentation/host integration, not saved rules.
  Linux/cloud validation was not executed on this Windows host.

Raw local evidence: `build/evidence/release-presentation.json`,
`release-presentation-hardware.json`, `release-device-probe.json`,
`stage21-assets.log`, `stage21-build.log`, and `release-*.png`.
The narrow browser viewport is emulation. Physical mobile rendering, touch,
load/FPS and listening checks remain unvalidated; final milestone acceptance is
pending those checks. Hardware results do not establish other desktop devices.
