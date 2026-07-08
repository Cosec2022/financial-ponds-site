#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
dist_root="$project_root/dist"

rm -rf "$dist_root"
mkdir -p "$dist_root/server"
node "$project_root/scripts/build-flow-channel.mjs"
node "$project_root/scripts/build-data-coverage-report.mjs"
node "$project_root/scripts/build-assets.mjs"
cp "$project_root/worker/index.js" "$dist_root/server/index.js"
cp "$project_root/worker/assets.js" "$dist_root/server/assets.js"

echo "Built $dist_root"
