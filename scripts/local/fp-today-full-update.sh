#!/usr/bin/env bash
set -euo pipefail

AS_OF="${1:-$(TZ=Asia/Hong_Kong date +%F)}"
MSG="${2:-update financial ponds daily modules $AS_OF}"

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "== Financial Ponds full update =="
echo "AS_OF=$AS_OF"

echo "== pull =="
git pull origin main

echo "== provider =="
cd tools/financial-pond-framework
python3 -m pip show akshare >/dev/null 2>&1 || python3 -m pip install -r providers/requirements.txt

npm run provider:akshare:doctor
npm run provider:akshare -- --as-of "$AS_OF"
npm run provider:akshare:validate
npm run provider:akshare:inspect
npm run provider:akshare:to-flow -- --as-of "$AS_OF"
npm run provider:akshare:history -- --as-of "$AS_OF" || true

echo "== modules =="
npm run flow:review -- --as-of "$AS_OF"
npm run rotation:review -- --as-of "$AS_OF" || true
npm run rotation:history -- --as-of "$AS_OF"
npm run module:review -- --as-of "$AS_OF"
npm run pool:analysis -- --as-of "$AS_OF" || true
npm run etf:readiness -- --as-of "$AS_OF"
npm run daily:sector-analysis -- --as-of "$AS_OF"
npm run project:maturity -- --as-of "$AS_OF"
npm run data:audit -- --as-of "$AS_OF" || true

cd "$ROOT"

echo "== publish json =="
copy_if_exists() {
  local src="$1"
  local dst="$2"
  if [ -f "$src" ]; then
    cp "$src" "$dst"
    echo "copied $src -> $dst"
  else
    echo "missing optional $src"
  fi
}

copy_if_exists "tools/financial-pond-framework/model_outputs/$AS_OF/sector_flow_review.json" "financial-pond/data/sector_flow_review.json"
copy_if_exists "tools/financial-pond-framework/model_outputs/$AS_OF/sector_rotation_history.json" "financial-pond/data/sector_rotation_history.json"
copy_if_exists "tools/financial-pond-framework/model_outputs/$AS_OF/sector_module_review.json" "financial-pond/data/sector_module_review.json"
copy_if_exists "tools/financial-pond-framework/model_outputs/$AS_OF/etf_decision_readiness.json" "financial-pond/data/etf_decision_readiness.json"
copy_if_exists "tools/financial-pond-framework/model_outputs/$AS_OF/daily_sector_analysis.json" "financial-pond/data/daily_sector_analysis.json"
copy_if_exists "tools/financial-pond-framework/model_outputs/$AS_OF/module_maturity_audit.json" "financial-pond/data/module_maturity_audit.json"

echo "== validate/build/test =="
npm run validate:data
npm run build
npm run validate
npm test

echo "== progress summary =="
node <<'NODE'
const fs = require('fs');

function read(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

const readiness = read('./financial-pond/data/etf_decision_readiness.json');
const daily = read('./financial-pond/data/daily_sector_analysis.json');
const maturity = read('./financial-pond/data/module_maturity_audit.json');

const asOf = readiness?.as_of || daily?.as_of || 'unknown';
const providerObsPath = `./tools/financial-pond-framework/model_outputs/${asOf}/akshare_provider_flow_observations.json`;
const providerObs = read(providerObsPath);

console.log(JSON.stringify({
  as_of: asOf,
  provider_readiness: providerObs?.readiness || readiness?.gates?.provider_flow_readiness || 'unknown',
  provider_history: providerObs?.share_change_diagnostics?.provider_history || providerObs?.provider_history || null,
  share_change: providerObs?.share_change_diagnostics || readiness?.gates?.share_change_diagnostics || null,
  etf_guidance_state: readiness?.guidance_state,
  true_flow_coverage: readiness?.gates?.true_flow_coverage,
  daily_headline: daily?.headline,
  priority_watch: daily?.tiers?.priority_watch?.map(x => ({
    id: x.sector_id,
    name: x.name,
    score: x.score,
    current_flow_score: x.current_flow_score,
    rotation: x.rotation_diagnostic?.label || x.rotation_diagnostic?.status || null
  })),
  confirm_next: daily?.tiers?.confirm_next?.map(x => x.name || x.sector_id),
  avoid_watch_count: daily?.tiers?.avoid_watch?.length,
  maturity: maturity ? {
    average: maturity.overall?.average_progress,
    decision_path: maturity.overall?.decision_path_progress,
    low_maturity_count: maturity.overall?.low_maturity_count,
    mainline: maturity.recommended_mainline?.label
  } : null
}, null, 2));
NODE

echo "== git =="
git status --short

if [ -n "$(git status --short)" ]; then
  git add .
  git commit -m "$MSG"
  git push origin main
else
  echo "No changes to commit."
fi

git log --oneline --decorate -5
