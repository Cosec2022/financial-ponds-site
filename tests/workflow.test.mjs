import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Financial Ponds workflow uses CI daily runner and publishes news review", async () => {
  const [workflow, frameworkPackage, assetBuilder] = await Promise.all([
    readFile(".github/workflows/daily.yml", "utf8"),
    readFile("tools/financial-pond-framework/package.json", "utf8"),
    readFile("scripts/build-assets.mjs", "utf8")
  ]);
  const scripts = JSON.parse(frameworkPackage).scripts;

  assert.equal(scripts["a-share:daily:ci"], "node src/tools/a_share_daily_ci.mjs");
  assert.equal(scripts["news:review:ci"], "node src/tools/news_daily_review.mjs --ci");
  assert.match(workflow, /node-version: "22"/);
  assert.match(workflow, /npm run a-share:daily:ci -- --as-of "\$AS_OF"/);
  assert.match(workflow, /news_review\.json/);
  assert.match(assetBuilder, /data\/news_review\.json/);
  assert.match(assetBuilder, /data\/pond_map\.json/);
  assert.doesNotMatch(workflow, /npm run a-share:daily\s*$/m);
});
