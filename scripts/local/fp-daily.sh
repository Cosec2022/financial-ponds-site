#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$project_root"

export AS_OF="${1:-$(date +%F)}"

node scripts/build-flow-channel.mjs
node scripts/build-market-signal-channel.mjs
node scripts/build-data-coverage-report.mjs
node scripts/archive-observation-snapshot.mjs
node scripts/build-daily-delta-report.mjs
npm run validate:data

echo "Financial Ponds daily persistence complete"
