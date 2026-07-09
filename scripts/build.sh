#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
dist_root="$project_root/dist"

rm -rf "$dist_root"
mkdir -p "$dist_root/server"
node "$project_root/scripts/build-pool-instrument-map.mjs"
node "$project_root/scripts/build-flow-channel.mjs"
node "$project_root/scripts/build-market-signal-channel.mjs"
node "$project_root/scripts/build-signal-quality-report.mjs"
node "$project_root/scripts/build-data-coverage-report.mjs"
node "$project_root/scripts/archive-observation-snapshot.mjs"
node "$project_root/scripts/build-daily-delta-report.mjs"
node "$project_root/scripts/build-evening-observation-summary.mjs"
node "$project_root/scripts/build-candidate-price-basis.mjs"
node "$project_root/scripts/build-candidate-state-model.mjs"
node "$project_root/scripts/build-candidate-outcome-reviews.mjs"
node "$project_root/scripts/archive-observation-snapshot.mjs"
node "$project_root/scripts/build-assets.mjs"
cp "$project_root/worker/index.js" "$dist_root/server/index.js"
cp "$project_root/worker/assets.js" "$dist_root/server/assets.js"

echo "Built $dist_root"
