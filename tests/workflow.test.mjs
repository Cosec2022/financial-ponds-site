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
  assert.equal(scripts["signal:attribution"], "node src/tools/sector_signal_attribution.mjs");
  assert.equal(scripts["watchlist:state"], "node src/tools/sector_watchlist_state.mjs");
  assert.equal(scripts["decision:gates"], "node src/tools/decision_gate_ledger.mjs");
  assert.equal(scripts["data:audit"], "node src/tools/data_reality_audit.mjs");
  assert.equal(scripts["daily:sector-analysis"], "node src/tools/daily_sector_analysis.mjs");
  assert.equal(scripts["project:maturity"], "node src/tools/module_maturity_audit.mjs");
  assert.equal(siteScripts["validate:data"], "node scripts/validate-published-data.mjs");
  assert.match(workflow, /node-version: "22"/);
  assert.match(workflow, /fetch-depth: 30/);
  assert.match(workflow, /contents: write/);
  assert.doesNotMatch(workflow, /npm ci/);
  assert.doesNotMatch(workflow, /\bnpm install\b/);
  assert.match(workflow, /npm run a-share:daily:ci -- --as-of "\$AS_OF"/);
  assert.doesNotMatch(workflow, /npm run cycle -- "\$AS_OF"/);
  assert.match(workflow, /npm run pool:analysis -- --as-of "\$AS_OF"/);
  assert.ok(workflow.indexOf("npm run data:audit") > workflow.indexOf("npm run pool:analysis"));
  assert.ok(workflow.indexOf("npm run daily:sector-analysis") > workflow.indexOf("npm run data:audit"));
  assert.ok(workflow.indexOf("npm run signal:attribution") > workflow.indexOf("npm run daily:sector-analysis"));
  assert.ok(workflow.indexOf("npm run watchlist:state") > workflow.indexOf("npm run signal:attribution"));
  assert.ok(workflow.indexOf("npm run decision:gates") > workflow.indexOf("npm run watchlist:state"));
  assert.ok(workflow.indexOf("npm run project:maturity") > workflow.indexOf("npm run decision:gates"));
  assert.ok(workflow.indexOf("npm run validate:data") < workflow.indexOf("npm run build"));
  assert.match(workflow, /general_pool_analysis\.json/);
  assert.match(workflow, /sector_rotation_intelligence\.json/);
  assert.match(workflow, /sector_rotation_history\.json/);
  assert.match(workflow, /sector_module_review\.json/);
  assert.match(workflow, /etf_decision_readiness\.json/);
  assert.match(workflow, /data_reality_audit\.json/);
  assert.match(workflow, /daily_sector_analysis\.json/);
  assert.match(workflow, /module_maturity_audit\.json/);
  assert.match(workflow, /etf_flow_leaderboard\.json/);
  assert.match(workflow, /sector_signal_attribution\.json/);
  assert.match(workflow, /sector_watchlist_state\.json/);
  assert.match(workflow, /decision_gate_ledger\.json/);
  assert.match(workflow, /Persist published data/);
  assert.match(workflow, /git add tools\/financial-pond-framework\/data\/provider_exports\/\*\.csv/);
  assert.match(workflow, /git add tools\/financial-pond-framework\/model_outputs\/provider_runs\/akshare_etf_bridge_\*\.json/);
  assert.match(workflow, /git add tools\/financial-pond-framework\/model_outputs\/provider_validation\/akshare_etf_bridge_validation\.json/);
  assert.match(workflow, /git add tools\/financial-pond-framework\/model_outputs\/provider_inspection\/akshare_etf_bridge_inspection\.json/);
  assert.match(workflow, /npx wrangler@4\.102\.0 deploy/);
  assert.match(workflow, /news_review\.json/);
  assert.match(assetBuilder, /data\/sector_rotation_intelligence\.json/);
  assert.match(assetBuilder, /data\/general_pool_analysis\.json/);
  assert.match(assetBuilder, /data\/sector_rotation_history\.json/);
  assert.match(assetBuilder, /data\/sector_module_review\.json/);
  assert.match(assetBuilder, /data\/etf_decision_readiness\.json/);
  assert.match(assetBuilder, /data\/data_reality_audit\.json/);
  assert.match(assetBuilder, /data\/daily_sector_analysis\.json/);
  assert.match(assetBuilder, /data\/module_maturity_audit\.json/);
  assert.match(assetBuilder, /data\/sector_signal_attribution\.json/);
  assert.match(assetBuilder, /data\/sector_watchlist_state\.json/);
  assert.match(assetBuilder, /data\/decision_gate_ledger\.json/);
  assert.match(assetBuilder, /data\/news_review\.json/);
  assert.match(assetBuilder, /data\/pond_map\.json/);
  assert.match(dataValidator, /sector_module_review\.json/);
  assert.match(dataValidator, /etf_decision_readiness\.json/);
  assert.match(dataValidator, /data_reality_audit\.json/);
  assert.match(dataValidator, /daily_sector_analysis\.json/);
  assert.match(dataValidator, /module_maturity_audit\.json/);
  assert.match(dataValidator, /sector_signal_attribution\.json/);
  assert.match(dataValidator, /sector_watchlist_state\.json/);
  assert.match(dataValidator, /decision_gate_ledger\.json/);
  assert.match(dataValidator, /Published Financial Ponds data complete/);
  assert.doesNotMatch(workflow, /npm run a-share:daily\s*$/m);
});
