#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_dir"
sdk_dir="$repo_dir/build/cloud/emsdk"
if [[ ! -f "$sdk_dir/emsdk_env.sh" ]]; then
  echo 'Run bash tools/cloud/setup.sh first.' >&2
  exit 1
fi
source "$sdk_dir/emsdk_env.sh" >/dev/null
export NODE_PATH="$repo_dir/build/cloud/tools/node_modules${NODE_PATH:+:$NODE_PATH}"
export PLAYWRIGHT_BROWSERS_PATH="$repo_dir/build/cloud/browsers"
if [[ $# == 0 ]]; then
  echo 'Usage: bash tools/cloud/run.sh COMMAND [ARGUMENTS...]' >&2
  exit 2
fi
exec "$@"
