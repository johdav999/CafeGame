#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_dir"
bash tools/cloud/run.sh npm test
mkdir -p build/cloud
g++ -std=c++20 -Wall -Wextra -Werror -Isrc tests/simulation_test.cpp -o build/cloud/simulation-test
build/cloud/simulation-test
bash tools/cloud/run.sh cmake --build build/cloud/browser --target cafe_game -j "${CAFE_BUILD_JOBS:-2}"
export CAFE_SITE_DIR="$repo_dir/build/cloud/browser/site"
export PORT="${CAFE_TEST_PORT:-4183}"
export CAFE_URL="http://127.0.0.1:$PORT"
# Cloud runners have no guaranteed GPU. Exercise automatic WebGL fallback too.
export CAFE_DISABLE_WEBGPU=1
node tools/serve.mjs >build/cloud/server.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true; wait "$server_pid" 2>/dev/null || true' EXIT
for attempt in {1..30}; do
  kill -0 "$server_pid" 2>/dev/null || { cat build/cloud/server.log; exit 1; }
  if node -e 'fetch(process.env.CAFE_URL).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))'; then break; fi
  sleep 1
done
bash tools/cloud/run.sh node tools/browser-smoke.cjs
