#!/usr/bin/env bash
set -euo pipefail

MSG="${1:-update financial ponds data}"

cd "$(git rev-parse --show-toplevel)"

echo "== git pull =="
git pull origin main

echo "== detect AS_OF =="
AS_OF=$(node -e "console.log(require('./financial-pond/data/sector_flow_review.json').as_of)")
echo "AS_OF=$AS_OF"

echo "== regenerate maturity + daily analysis =="
cd tools/financial-pond-framework
npm run project:maturity -- --as-of "$AS_OF"
npm run daily:sector-analysis -- --as-of "$AS_OF"
cd ../..

echo "== publish generated JSON =="
cp "tools/financial-pond-framework/model_outputs/$AS_OF/module_maturity_audit.json" financial-pond/data/module_maturity_audit.json
cp "tools/financial-pond-framework/model_outputs/$AS_OF/daily_sector_analysis.json" financial-pond/data/daily_sector_analysis.json

echo "== validate/build/test =="
npm run validate:data
npm run build
npm run validate
npm test

echo "== git status =="
git status --short

if [ -z "$(git status --short)" ]; then
  echo "No changes to commit."
  exit 0
fi

echo "== commit + push =="
git add .
git commit -m "$MSG"
git push origin main

echo "== done =="
git log --oneline --decorate -3
