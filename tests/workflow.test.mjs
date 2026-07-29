import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("official command contract separates collection, modeling, publication, Git, and deployment", async () => {
  const [workflow, packageText, build, today, daily, model, assets] = await Promise.all([
    readFile(".github/workflows/daily.yml", "utf8"),
    readFile("package.json", "utf8"),
    readFile("scripts/build.sh", "utf8"),
    readFile("scripts/fp/run-today.mjs", "utf8"),
    readFile("scripts/fp/run-daily.mjs", "utf8"),
    readFile("scripts/fp/run-model.mjs", "utf8"),
    readFile("scripts/build-assets.mjs", "utf8")
  ]);
  const scripts = JSON.parse(packageText).scripts;
  for (const name of ["fp:collect", "fp:normalize", "fp:observe", "fp:assess", "fp:penetrate", "fp:decide", "fp:review", "fp:persist", "fp:publish", "fp:model", "fp:daily", "fp:replay", "fp:audit", "fp:today"]) {
    assert.ok(scripts[name], `${name} is defined`);
  }
  assert.equal(scripts.build, "bash scripts/build.sh");
  assert.equal(scripts["build:site"], "bash scripts/build-site.sh");
  assert.doesNotMatch(build, /fp-daily|fp:daily|collect|run-model/);
  assert.doesNotMatch(today, /\bgit\b|deploy|wrangler|push|commit|pull/);
  assert.doesNotMatch(model, /https?:|fetch\(|curl|provider:|python/);
  assert.match(daily, /stage_counts/);
  for (const stage of ["collect", "normalize", "observe", "assess", "penetrate", "decide", "review", "persist", "validate", "publish"]) {
    assert.match(daily, new RegExp(`${stage}: 1`));
  }
  for (const artifact of ["daily_manifest.json", "sector_assessment_daily.json", "entry_decision_daily.json", "market_penetration_brief.json", "review_analytics.json"]) {
    assert.match(assets, new RegExp(artifact.replace(".", "\\.")));
  }
});

test("GitHub workflow has one dependent stage chain and an explicit generated-data whitelist", async () => {
  const workflow = await readFile(".github/workflows/daily.yml", "utf8");
  for (const job of ["collect:", "model:", "validate:", "persist:", "deploy:"]) assert.match(workflow, new RegExp(`^  ${job}`, "m"));
  assert.match(workflow, /needs: collect/);
  assert.match(workflow, /needs: \[collect, model\]/);
  assert.match(workflow, /needs: \[collect, validate\]/);
  assert.match(workflow, /needs: persist/);
  assert.equal((workflow.match(/npm run fp:collect/g) ?? []).length, 1);
  for (const stage of ["normalize", "observe", "assess", "penetrate", "decide", "review", "persist", "publish"]) {
    assert.equal((workflow.match(new RegExp(`npm run fp:${stage}`, "g")) ?? []).length, 1, `${stage} occurs once`);
  }
  assert.doesNotMatch(workflow, /git add \.|git add financial-pond\/data\s*$/m);
  assert.match(workflow, /git add financial-pond\/data\/daily_manifest\.json/);
  assert.ok(workflow.indexOf("name: Validate before persistence") < workflow.indexOf("name: Persist and publish validated artifacts"));
  assert.ok(workflow.indexOf("name: Persist and publish validated artifacts") < workflow.indexOf("name: Deploy already validated publication"));
});

test("frontend source reads and validates the manifest before official conclusions", async () => {
  const [app, html] = await Promise.all([
    readFile("financial-pond/app.js", "utf8"),
    readFile("financial-pond/index.html", "utf8")
  ]);
  assert.ok(app.indexOf('readRequired("./data/daily_manifest.json")') < app.indexOf('readOfficial("entry_decision")'));
  assert.match(app, /Mixed as_of dates rejected/);
  assert.match(app, /Manifest does not declare/);
  assert.match(app, /no_qualified_candidate/);
  assert.doesNotMatch(app, /observation_score|rank_change|previous_rank/);
  assert.match(html, /今日 ETF 买入指导/);
  assert.match(html, /不生成可见序号或综合排名/);
  assert.doesNotMatch(html, /第1名|第2名|综合分最高|Top 10/);
});
