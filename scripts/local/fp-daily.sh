#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$project_root"

export AS_OF="${1:-${AS_OF:-$(TZ=Asia/Hong_Kong date +%F)}}"
export GENERATED_AT="${GENERATED_AT:-$(TZ=UTC date +%Y-%m-%dT%H:%M:%SZ)}"
export REVIEW_NOW="${REVIEW_NOW:-${AS_OF}T16:00:00+08:00}"

node scripts/build-pool-instrument-map.mjs
node scripts/build-flow-channel.mjs
node scripts/build-market-signal-channel.mjs
node scripts/build-signal-quality-report.mjs
node scripts/build-data-coverage-report.mjs
node scripts/archive-observation-snapshot.mjs
node scripts/build-daily-delta-report.mjs
node scripts/build-evening-observation-summary.mjs
node scripts/build-candidate-price-basis.mjs
node scripts/build-candidate-state-model.mjs
node scripts/build-daily-longitudinal-archive.mjs
node scripts/build-candidate-outcome-reviews.mjs
node scripts/build-daily-outcome-label-ledger.mjs
node scripts/build-candidate-review-analytics.mjs
node scripts/build-longitudinal-coverage-report.mjs
node scripts/archive-observation-snapshot.mjs
node scripts/build-market-penetration-brief.mjs
npm run validate:data

echo "Financial Ponds daily persistence complete"
