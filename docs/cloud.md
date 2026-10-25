# Codex cloud setup

The repo supplies a Linux setup and validation path for cloud coding tasks.
It installs Emscripten from .emscripten-version, fetches the pinned WebEngine,
builds the game, installs Chromium/Playwright, and runs the existing acceptance checks.
No provider credentials are required.

## Environment configuration

Connect the GitHub repository `johdav999/CafeGame` and select Node.js 22 or later
in an Ubuntu-based environment with apt and root or passwordless sudo access.
Set the setup command to:

```bash
bash tools/cloud/setup.sh
```

For a cached environment's maintenance command use the same command. It is
repeatable, retains SDK/build caches, reconfigures the current checkout, and
installs any changed dependencies while network access is available.
Allow time for the first complete engine compilation. CAFE_BUILD_JOBS defaults
to 2 to limit memory pressure; increase it for larger runners.

These are repository scripts, not an automatically discovered Codex settings file.
They must be attached to your account's environment. Account-side configuration
is separate from committing these files.

Setup needs package repositories, GitHub/codeload, Emscripten download hosts,
the npm registry, and Playwright browser download hosts. Preserve the environment's
managed proxy and CA settings. After successful setup, ordinary edits and rebuilds
use cached dependencies; changes to dependency pins can require another online setup.

The documented repository-based Codex Cloud flow runs setup in a separate shell,
so exports alone do not carry into later agent commands. The run.sh wrapper sources
the SDK each time. See [official cloud environment documentation](https://learn.chatgpt.com/docs/environments/cloud-environment).

## Task commands

```bash
bash tools/cloud/run.sh cmake --build build/cloud/browser --target cafe_game -j 2
bash tools/cloud/check.sh
CAFE_SITE_DIR=build/cloud/browser/site npm run dev
```

The preview server binds to loopback on port 4173. Use the cloud environment's
supported browser/port forwarding; your Windows localhost is a different machine.
check.sh owns and stops its temporary test server on port 4183, configurable via
CAFE_TEST_PORT. Screenshots land in build/evidence.

Headless Chromium uses software rendering with WebGPU disabled via CAFE_DISABLE_WEBGPU=1.
The smoke check covers the rendered
coffee, brewing, pause/resume, rewards and JavaScript errors on forced WebGL 2
and automatic WebGL fallback. It does not validate hardware WebGPU performance.

## Secrets

Do not add audio/model provider keys for routine coding tasks. If a later task
explicitly generates assets, configure credentials using that environment's
supported secret mechanism and check whether they are available during the agent
phase. Never persist a setup-only secret into tracked files or shell startup files.
