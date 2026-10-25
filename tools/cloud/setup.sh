#!/usr/bin/env bash
# Ubuntu/Linux setup. Re-running also refreshes a resumed cloud checkout.
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_dir"
[[ "$(uname -s)" == Linux ]] || { echo 'Cloud setup requires Linux.' >&2; exit 1; }
node -e 'if(Number(process.versions.node.split(".")[0]) < 22) throw Error("Select Node.js 22+ in the cloud environment")'
sudo_cmd=()
if [[ $EUID != 0 ]]; then sudo_cmd=(sudo); fi
"${sudo_cmd[@]}" apt-get update
"${sudo_cmd[@]}" apt-get install -y --no-install-recommends ca-certificates git python3 cmake ninja-build g++
sdk_version="$(tr -d '\r\n' < .emscripten-version)"
sdk_dir="$repo_dir/build/cloud/emsdk"
mkdir -p build/cloud
if [[ ! -d "$sdk_dir/.git" ]]; then
  git clone --depth 1 --branch "$sdk_version" https://github.com/emscripten-core/emsdk.git "$sdk_dir"
fi
"$sdk_dir/emsdk" install "$sdk_version"
"$sdk_dir/emsdk" activate "$sdk_version"
source "$sdk_dir/emsdk_env.sh" >/dev/null
npm ci --ignore-scripts
# Isolated tooling avoids adding browser automation to the game's dependencies.
npm install --prefix build/cloud/tools --no-audit --no-fund --ignore-scripts playwright@1.56.1
export PLAYWRIGHT_BROWSERS_PATH="$repo_dir/build/cloud/browsers"
node build/cloud/tools/node_modules/playwright/cli.js install --with-deps chromium
# Use a separate Linux build directory; never reuse a developer's Windows cache.
emcmake cmake -S . -B build/cloud/browser -G Ninja -DCMAKE_BUILD_TYPE=Release
# A complete build warms Emscripten system libraries and the WebGPU port too.
cmake --build build/cloud/browser --target cafe_game -j "${CAFE_BUILD_JOBS:-2}"
bash tools/cloud/check.sh
