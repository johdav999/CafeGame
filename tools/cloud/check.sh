#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_dir"
bash tools/cloud/run.sh npm test
mkdir -p build/cloud
cmake -S tests -B build/cloud/simulation -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build/cloud/simulation --parallel 2
ctest --test-dir build/cloud/simulation --output-on-failure
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
bash tools/cloud/run.sh node tools/demand-smoke.cjs
bash tools/cloud/run.sh node tools/authoring-smoke.cjs
bash tools/cloud/run.sh node tools/compatibility-smoke.cjs
bash tools/cloud/run.sh node tools/menu-smoke.cjs
bash tools/cloud/run.sh node tools/staff-smoke.cjs
build/cloud/simulation/cafe_campaign build/evidence > build/evidence/campaign-cloud.json
bash tools/cloud/run.sh node tools/campaign-smoke.cjs
bash tools/cloud/run.sh node tools/equipment-smoke.cjs
bash tools/cloud/run.sh node tools/presentation-smoke.cjs
bash tools/cloud/run.sh node tools/presentation-assets-smoke.cjs
bash tools/cloud/run.sh node tools/service-ui-smoke.cjs
node tools/stress.mjs --host build/cloud/simulation/cafe_stress --seconds 21600 --seeds 123,456 --scale 1024 --output build/evidence/stress-cloud.json
