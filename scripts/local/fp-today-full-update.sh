#!/usr/bin/env bash
set -euo pipefail

AS_OF="${1:-$(TZ=Asia/Hong_Kong date +%F)}"
MSG="${2:-update financial ponds daily modules $AS_OF}"

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "== Financial Ponds full update =="
echo "AS_OF=$AS_OF"

NONCRITICAL_FAILURES=()

record_noncritical_failure() {
  local label="$1"
  local exit_code="$2"
  NONCRITICAL_FAILURES+=("$label exited $exit_code")
  echo "noncritical failure: $label exited $exit_code"
}

run_noncritical() {
  local label="$1"
  shift
  set +e
  "$@"
  local exit_code=$?
  set -e
  if [ "$exit_code" -ne 0 ]; then
    record_noncritical_failure "$label" "$exit_code"
  fi
}

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
npm run etf:flow-leaderboard -- --as-of "$AS_OF"
npm run provider:akshare:history -- --as-of "$AS_OF" || true

echo "== modules =="
npm run flow:review -- --as-of "$AS_OF"
npm run rotation:review -- --as-of "$AS_OF" || true
npm run rotation:history -- --as-of "$AS_OF"
npm run module:review -- --as-of "$AS_OF"
if [ ! -f "snapshots/$AS_OF/graph_scores.json" ]; then
  echo "missing snapshots/$AS_OF/graph_scores.json; running cycle first"
  run_noncritical "cycle $AS_OF" npm run cycle -- "$AS_OF"
fi
run_noncritical "pool:analysis $AS_OF" npm run pool:analysis -- --as-of "$AS_OF"
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
copy_if_exists "tools/financial-pond-framework/model_outputs/$AS_OF/etf_flow_leaderboard.json" "financial-pond/data/etf_flow_leaderboard.json"

echo "== validate/build/test =="
npm run validate:data
npm run build
npm run validate
npm test

echo "== progress summary =="
npm run fp:summary

echo "== noncritical summary =="
if [ "${#NONCRITICAL_FAILURES[@]}" -eq 0 ]; then
  echo "No noncritical module failures recorded."
else
  printf 'Recorded noncritical module failures:\n'
  printf -- '- %s\n' "${NONCRITICAL_FAILURES[@]}"
fi

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
