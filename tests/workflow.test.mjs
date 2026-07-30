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
  for (const job of ["pr_offline_validate:", "collect:", "model:", "validate:", "persist:", "deploy:"]) assert.match(workflow, new RegExp(`^  ${job}`, "m"));
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
  assert.match(workflow, /^\s+git config user\.email "41898282\+github-actions\[bot\]@users\.noreply\.github\.com"$/m);
  assert.doesNotMatch(workflow, /4189822\+github-actions\[bot\]@users\.noreply\.github\.com/);
  assert.ok(workflow.indexOf("name: Validate before persistence") < workflow.indexOf("name: Persist and publish validated artifacts"));
  assert.ok(workflow.indexOf("name: Persist and publish validated artifacts") < workflow.indexOf("name: Deploy already validated publication"));
});

test("scheduled validate rebuilds Worker output after restoring the real artifact workspace", async () => {
  const workflow = await readFile(".github/workflows/daily.yml", "utf8");
  const validateJob = jobBlock(workflow, "validate");
  const inputPath = "financial-pond/history/market-inputs/${{ env.AS_OF }}";
  const modelPath = ".fp-work/${{ env.AS_OF }}";
  assert.match(validateJob, new RegExp(escapeRegExp(inputPath)));
  assert.match(validateJob, new RegExp(escapeRegExp(modelPath)));
  assert.ok(validateJob.indexOf(inputPath) < validateJob.indexOf("npm run build"));
  assert.ok(validateJob.indexOf(modelPath) < validateJob.indexOf("npm run build"));
  assert.ok(validateJob.indexOf("npm run fp:validate") < validateJob.indexOf("npm run build"));
  assert.ok(validateJob.indexOf("npm run build") < validateJob.indexOf("npm test"));
  assert.doesNotMatch(validateJob, /fp:collect|provider|pip install|git (add|commit|push)|deploy|wrangler/i);
});

test("pull-request checks are offline and cannot reach providers, Git persistence, or deployment", async () => {
  const workflow = await readFile(".github/workflows/daily.yml", "utf8");
  assert.match(workflow, /^  pull_request:\n    branches: \[main\]/m);
  const prJob = jobBlock(workflow, "pr_offline_validate");
  for (const command of [
    "npm test",
    "npm run build",
    "npm run validate",
    "npm run validate:data",
    "npm run validate:history-quality",
    "npm run fp:replay -- --as-of 2026-07-28"
  ]) assert.match(prJob, new RegExp(escapeRegExp(command)));
  assert.ok(prJob.indexOf("npm run build") < prJob.indexOf("npm test"), "clean PR runners build Worker output before Worker tests");
  assert.match(prJob, /permissions:\n      contents: read/);
  assert.match(prJob, /git diff --exit-code -- financial-pond\/data financial-pond\/history\/market-inputs/g);
  assert.doesNotMatch(prJob, /fp:collect|provider|pip install|git (add|commit|push)|deploy|wrangler|CLOUDFLARE|secrets\./i);

  for (const job of ["collect", "model", "validate", "persist", "deploy"]) {
    assert.match(jobBlock(workflow, job), /if: \$\{\{ github\.event_name != 'pull_request' \}\}/);
  }
  assert.match(jobBlock(workflow, "collect"), /if: \$\{\{ github\.event_name == 'schedule' \|\| inputs\.mode != 'offline' \}\}/);
  assert.match(jobBlock(workflow, "collect"), /if \[\[ -z "\$MODE" \]\]; then MODE="live"; fi/);
});

test("frontend source reads and validates the manifest before official conclusions", async () => {
  const [app, html] = await Promise.all([
    readFile("financial-pond/app.js", "utf8"),
    readFile("financial-pond/index.html", "utf8")
  ]);
  assert.ok(app.indexOf('readRequired("./data/daily_manifest.json")') < app.indexOf('readOfficial("entry_decision")'));
  assert.match(app, /Mixed as_of dates rejected/);
  assert.match(app, /Manifest does not declare/);
  assert.match(app, /evaluatePublicationFreshness/);
  assert.match(app, /Bundle 同步/);
  assert.match(app, /publicationFreshness\.state/);
  assert.match(app, /no_qualified_candidate/);
  assert.doesNotMatch(app, /observation_score|rank_change|previous_rank/);
  assert.match(html, /今日 ETF 买入指导/);
  assert.match(html, /不生成可见序号或综合排名/);
  assert.doesNotMatch(html, /第1名|第2名|综合分最高|Top 10/);
});

function jobBlock(workflow, name) {
  const start = workflow.indexOf(`  ${name}:`);
  assert.notEqual(start, -1, `${name} job exists`);
  const next = workflow.slice(start + 2).search(/\n  [a-zA-Z0-9_]+:\n/);
  return next === -1 ? workflow.slice(start) : workflow.slice(start, start + 2 + next);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
