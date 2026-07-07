import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Financial Ponds workflow uses CI daily runner and publishes complete decision data", async () => {
  const [workflow, frameworkPackage, sitePackage, assetBuilder, dataValidator] = await Promise.all([
    readFile(".github/workflows/daily.yml", "utf8"),
    readFile("tools/financial-pond-framework/package.json", "utf8"),
    readFile("package.json", "utf8"),
    readFile("scripts/build-assets.mjs", "utf8"),
    readFile("scripts/validate-published-data.mjs", "utf8")
  ]);
  const scripts = JSON.parse(frameworkPackage).scripts;
  const siteScripts = JSON.parse(sitePackage).scripts;

  assert.equal(scripts["a-share:daily:ci"], "node src/tools/a_share_daily_ci.mjs");
  assert.equal(scripts["news:review:ci"], "node src/tools/news_daily_review.mjs --ci");
  assert.equal(scripts["pool:analysis"], "node src/tools/general_pool_analysis.mjs");
  assert.equal(scripts["rotation:review"], "node src/tools/sector_rotation_intelligence.mjs");
  assert.equal(scripts["rotation:history"], "node src/tools/sector_rotation_history.mjs");
  assert.equal(scripts["module:review"], "node src/tools/sector_module_review.mjs");
  assert.equal(scripts["etf:readiness"], "node src/tools/etf_decision_readiness.mjs");
  assert.equal(scripts["data:audit"], "node src/tools/data_reality_audit.mjs");
  assert.equal(siteScripts["validate:data"], "node scripts/validate-published-data.mjs");
  assert.match(workflow, /node-version: "22"/);
  assert.match(workflow, /contents: write/);
  assert.doesNotMatch(workflow, /npm ci/);
  assert.doesNotMatch(workflow, /\bnpm install\b/);
  assert.match(workflow, /npm run a-share:daily:ci -- --as-of "\$AS_OF"/);
  assert.doesNotMatch(workflow, /npm run cycle -- "\$AS_OF"/);
  assert.match(workflow, /npm run pool:analysis -- --as-of "\$AS_OF"/);
  assert.ok(workflow.indexOf("npm run data:audit") > workflow.indexOf("npm run pool:analysis"));
  assert.ok(workflow.indexOf("npm run validate:data") < workflow.indexOf("npm run build"));
  assert.match(workflow, /general_pool_analysis\.json/);
  assert.match(workflow, /sector_rotation_intelligence\.json/);
  assert.match(workflow, /sector_rotation_history\.json/);
  assert.match(workflow, /sector_module_review\.json/);
  assert.match(workflow, /etf_decision_readiness\.json/);
  assert.match(workflow, /data_reality_audit\.json/);
  assert.match(workflow, /Persist published data/);
  assert.match(workflow, /npx wrangler@4\.102\.0 deploy/);
  assert.match(workflow, /news_review\.json/);
  assert.match(assetBuilder, /data\/sector_rotation_intelligence\.json/);
  assert.match(assetBuilder, /data\/general_pool_analysis\.json/);
  assert.match(assetBuilder, /data\/sector_rotation_history\.json/);
  assert.match(assetBuilder, /data\/sector_module_review\.json/);
  assert.match(assetBuilder, /data\/etf_decision_readiness\.json/);
  assert.match(assetBuilder, /data\/data_reality_audit\.json/);
  assert.match(assetBuilder, /data\/news_review\.json/);
  assert.match(assetBuilder, /data\/pond_map\.json/);
  assert.match(dataValidator, /sector_module_review\.json/);
  assert.match(dataValidator, /etf_decision_readiness\.json/);
  assert.match(dataValidator, /data_reality_audit\.json/);
  assert.match(dataValidator, /Published Financial Ponds data complete/);
  assert.doesNotMatch(workflow, /npm run a-share:daily\s*$/m);
});
