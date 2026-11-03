---
name: tripo
description: Generate 3D models with Tripo3D AI from ImageGen references, resume existing jobs, and clean static models using headless Blender. Use for Tripo asset authoring in this repository, not runtime provider integration or character rigging.
---

Use Python 3.10+ and `scripts/tripo.py` relative to this skill. The API client uses only the standard library; cleanup requires Blender 4.2+ with glTF/FBX import and glTF export. Always pass the intended Git repository root with `--repo`. These scripts are authoring tools, never runtime dependencies.

Read repository art direction and asset guidance before generating: RPGGame uses `docs/art/` and CafeGame uses `design.md` and `docs/assets.md`. Keep drafts, references, job records and cleanup outputs inside ignored `assets/generated/`. Review scale, materials, complexity and usage rights before promoting to versioned assets. Do not change game code or the engine submodule as part of generation alone.

## Reference and generation

For each new model, use the imagegen skill and built-in ImageGen tool to create a reference first. Show one complete isolated subject in a clear three-quarter view, neutral diffuse lighting, plain background or real transparency. Keep silhouette and important parts visible; avoid labels, cropped parts and multi-view sheets. Preserve the project's palette and proportions. Use supplied references with ImageGen when preserving an identity.

Save the image in the repository and inspect its pixels before submission. Correct defects with ImageGen edits. Save the ImageGen prompt and reference sources in a text/JSON file and pass `--reference-notes`; the helper retains those notes, image path and SHA256 in provenance. Keep the reference outside the new job directory. If ImageGen is unavailable, follow that skill's fallback rules; do not silently substitute Tripo text-to-model. Resume existing jobs without generating a replacement reference.

Example from the repository root (replace the subject and intended height):

```powershell
python .agents/skills/tripo/scripts/tripo.py generate --repo . --image assets/generated/references/pot.png --reference-notes assets/generated/references/pot.json --output assets/generated/pot/raw/model.glb --clean-output assets/generated/pot/clean/model.glb --height 0.3
```

This validates locally and defaults to a dry run. Add `--execute` only for a user-requested generation. Installing/testing the skill does not authorize paid samples. A request for a described model authorizes that generation; preserve the requested count. `--dry-run` explicitly selects the same no-network behavior. The raw output's parent directory must not exist yet.

Defaults match the supplied reference: geometry `v3.1-20260211`, Ultra geometry, 50,000 requested faces, PBR textures, texture `v3.5-20260815` at detailed tier, Remove Lighting off, AI Complete off. Provider tiers do not guarantee exact texture dimensions or polygon counts; inspect delivered results. Boolean flags support `--foo`/`--no-foo`. `--no-texture` disables PBR unless explicitly overridden; PBR without texture is rejected. Quads require `.fbx` raw output. Cleanup exports triangles in GLB. AI Complete is input autofix, not mesh repair. Use `--help` for overrides.

Prefer `--image` (PNG/JPEG, at most 20 MiB). `--image-url` is only for a selected ImageGen reference that cannot be uploaded locally; retain a repository copy and record its hash in reference notes. Remote URLs are omitted from logs/provenance. No text-to-model option exists in this helper.

## Credentials and recovery

Run `status --repo .` to check local configuration without contacting Tripo or revealing the key. Prefer `TRIPO_API_KEY` injected into the authoring process; it takes precedence. Optional Windows storage uses the supplied DPAPI implementation at ignored `.secrets/tripo.dpapi`, tied to this Windows login. Setup runs in the user's own interactive terminal:

```powershell
python .agents/skills/tripo/scripts/tripo.py configure --repo .
```

Never request keys in chat, print secret files, pass command-line keys, or commit `.secrets`. DPAPI does not protect against other processes under the same login. Non-Windows/CI use environment injection. Builds/tests need no credentials.

The helper reserves a job directory before submission, persists the task ID immediately and never retries task creation. If submission fails ambiguously, inspect provider history before resubmitting; an interrupted request may have consumed credits. For a known task:

```powershell
python .agents/skills/tripo/scripts/tripo.py resume --repo . --job assets/generated/pot/raw/job.json --clean-output assets/generated/pot/clean/model.glb --height 0.3
```

Polling defaults to 20 minutes (`--wait-seconds`). Download promptly because result URLs expire. Downloads carry no Authorization header. Provenance records the request, task ID, timestamps, credits and SHA256, omitting signed output URLs and credentials. Rights remain unverified until entitlement evidence is recorded.

## Headless cleanup and review

`--clean-output` runs cleanup after a successful download. If cleanup fails after download, rerun the local `clean` command, not generation/resume:

```powershell
python .agents/skills/tripo/scripts/tripo.py clean --repo . --input assets/generated/pot/raw/model.glb --output assets/generated/pot/clean/model.glb --height 0.3
```

Set `--blender <executable>` or `BLENDER_EXE` if Blender is not on PATH. Blender runs in a separate background process with factory settings; the live session is untouched. Raw input is preserved and existing outputs are refused. Cleanup removes loose vertices/edges and degenerate geometry, recalculates face normals, centers horizontally, and puts the base at the origin. `--height` optionally normalizes overall height in metres; otherwise scale is preserved. Export is Y-up GLB with materials/UVs retained. Armatures, animation, shape keys and modifiers are rejected rather than damaged.

Welding and reduction are opt-in: `--merge-distance` is in imported source units, and `--decimate-ratio` is in (0, 1]. Before reduction, reconnect coincident UV/normal seam vertices using a reviewed, source-scale merge distance while retaining per-corner UVs. Decimating disconnected seam patches can open holes across otherwise closed surfaces. The helper refuses reduction with remaining coincident seam splits and rejects increased boundary counts or boundary length. Retry from the raw source with a smaller reduction or corrected weld; never repeatedly decimate an already damaged mesh. Welding can alter nearby thin parts and reduction can damage silhouettes; inspect the result. This is not automatic retopology, hole filling, rigging, or semantic removal of hidden parts.

Read `<output>.qa.json` for before/after triangle/vertex counts, non-manifold edges, dimensions, image sizes and hashes. Inspect the actual GLB in Blender or the target viewer for silhouette, UVs, materials, normals and scale before promotion. Report automated checks separately from visual/GPU checks.

### Surface integrity acceptance

Read [surface-integrity.md](references/surface-integrity.md) before mesh reduction or investigating holes, speckles or missing faces. Apply its final-export review after every geometry optimization, including project-specific budget scripts run after this helper. A successful provider job, clean Blender preview, low triangle count or passing file checks does not approve the final runtime asset. Do not promote a model with unexplained holes or flickering surfaces. Keep it as a draft and report the failed check if a local repair cannot pass review. Generation cannot guarantee defect-free geometry; this acceptance gate prevents known defects from being shipped.

## Maintenance

Untouched supplied code and workflow notes are in [references](references/original-workflow.md), including `original_tripo.py` and `original_test_tripo.py`. The two supplied workflow attachments were identical. `scripts/credentials.py` adapts the inline credential reference with buffer cleanup on failure. Operational scripts include dry-run defaults, validation and headless cleanup extensions.

API contracts checked 2026-10-26: [image-to-model](https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard), [upload](https://developers.tripo3d.ai/en/docs/files), [task query](https://developers.tripo3d.ai/en/docs/task-query). Recheck official schemas when extending API fields.

Run `python -m unittest discover -s tests -v` from either repository; also run CafeGame's `npm test`. To exercise Blender with a synthetic local fixture, set `TRIPO_TEST_BLENDER` to its executable and run the Python suite. No test submits paid requests. Keep the skill/scripts/tests synchronized between RPGGame and CafeGame when changing this shared workflow.
