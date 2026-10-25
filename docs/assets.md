# Asset pipeline

The browser plays local approved assets; provider calls run only in Node during development.
Copy `.env.example` to `.env` and supply your own keys. Neither builds nor CI require provider accounts.

## ElevenLabs

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

The current scene uses engine primitives. The manifest is a content inventory for future loading,
not an automatic importer. `engine_assets_browser` and `engine_audio_browser` are linked as preparation:
load GLB bytes through `MeshComponent::loadGlb`; instantiate `BrowserAudioBackend` and the engine
audio system when adding playback, including activation on a user gesture. No generated assets
or runtime playback are wired into this initial prototype.
