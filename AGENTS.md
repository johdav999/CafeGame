# CafeGame development

Read README.md and design.md before changing game behavior or visual direction.
This is a C++20/WebAssembly 3D game using the pinned WebEngine browser runtime.
Keep game rules in src/simulation.hpp and game-owned code; use engine APIs rather
than duplicating renderer internals. Keep both WebGPU and WebGL 2 compatibility.

## Cloud tasks (Linux)

The environment setup command is `bash tools/cloud/setup.sh`.
Setup downloads the SDK, engine dependencies and Chromium, and warms a complete build.
For every new shell use `bash tools/cloud/run.sh COMMAND ...` to activate the SDK.
The Linux build is build/cloud/browser; do not reuse build/browser from Windows.

- Full validation: `bash tools/cloud/check.sh`.
- Tool-only changes: `npm test`.
- Build: `bash tools/cloud/run.sh cmake --build build/cloud/browser --target cafe_game -j 2`.
- Preview: `CAFE_SITE_DIR=build/cloud/browser/site npm run dev`.
- Screenshots: build/evidence; browser logs: build/cloud/server.log.

If dependency versions change, rerun setup with network access. Do not claim an
offline dependency update succeeded when downloads were unavailable. Browser
software-rendering checks do not establish hardware WebGPU or mobile performance.

## Assets and changes

Follow design.md and docs/assets.md. Keep provider keys out of source, logs and
browser bundles. Builds/tests need no ElevenLabs or Tripo credentials. Generation
commands default to dry runs; only submit paid generation when explicitly requested.
Do not commit build outputs, SDKs, node_modules, .env files or unapproved drafts.
Preserve unrelated user work. Report the checks actually run and remaining limits.
