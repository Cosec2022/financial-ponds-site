import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { loadConfig } from "../tools/financial-pond-framework/src/core/config_loader.mjs";
import { buildRegistry } from "../tools/financial-pond-framework/src/core/registry.mjs";
import { buildGraph } from "../tools/financial-pond-framework/src/core/graph_engine.mjs";
import { calculateScores } from "../tools/financial-pond-framework/src/core/scoring_engine.mjs";
import { observationsToScoreMap } from "../tools/financial-pond-framework/src/contracts/observation_schema.mjs";
import { evaluateSectorFlows } from "../tools/financial-pond-framework/src/model/flow_engine.mjs";
import { buildSectorRotationIntelligence } from "../tools/financial-pond-framework/src/tools/sector_rotation_intelligence.mjs";
import { buildMarketPenetrationBrief } from "../scripts/lib/market-penetration-brief.mjs";
import { filterNewsForSectorScoring, normalizeNewsInputPolicy } from "../tools/financial-pond-framework/src/news/news_input_policy.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(repoRoot, "tests/fixtures/news-narrative-full-chain");
const asOf = "2026-07-10";

test("legacy RSS and Google News narratives are display-only across the full model chain", async (t) => {
  const [a, b] = await Promise.all([readFixture("a.json"), readFixture("b.json")]);
  const graphA = await graphOutput(a);
  const graphB = await graphOutput(b);
  assertCanonicalEqual(graphA, graphB, "graph score");

  const sectorA = await sectorOutput(a);
  const sectorB = await sectorOutput(b);
  assertCanonicalEqual(sectorA.model, sectorB.model, "sector score, flow score, policy contribution, rotation, market signal, and flow");
  assertCanonicalEqual(sectorA.rotation, sectorB.rotation, "rotation");
  assert.equal(sectorA.narrative_context.every((row) => row.display_only === true), true);

  assert.equal(filterNewsForSectorScoring(a.news_input_policy, allNarratives(a)).length, 0);
  for (const mode of [undefined, null, "", "unknown", "illegal", 1]) {
    assert.equal(filterNewsForSectorScoring({ news_input_mode: mode }, allNarratives(a)).length, 0, `news_input_mode=${String(mode)} fails closed`);
  }
  assert.equal(filterNewsForSectorScoring({ news_input_mode: "verified_fact_channel" }, allNarratives(a)).length, 0, "no verified-fact fallback");
  assert.equal(normalizeNewsInputPolicy({ news_input_mode: "illegal" }).news_input_mode, "narrative_display_only");

  const briefA = brief(a);
  const briefB = brief(b);
  assert.equal(briefA.verified_facts.length, 0);
  assert.equal(briefA.media_narratives.length, 2, "narratives remain visible in the Market Penetration Brief");
  assert.equal(briefA.unsupported_narratives.every((row) => row.evidence_status === "media_narrative"), true);
  assert.equal(briefA.verified_facts.some((row) => row.hypothesis), false, "hypotheses never enter verified facts");
  assertCanonicalEqual(stripBriefNarratives(briefA), stripBriefNarratives(briefB), "brief model facts");

  const tempRoot = await mkdtemp(path.join(tmpdir(), "financial-pond-news-invariance-"));
  t.after(() => rm(tempRoot, { recursive: true, force: true }));
  const outputsA = await fullCandidateChain(tempRoot, a);
  const outputsB = await fullCandidateChain(tempRoot, b);
  assertCanonicalEqual(outputsA, outputsB, "candidate components/final scores, qualification, rank, Top 5, major-wave/right-side state, review, benchmark, and analytics eligibility");
});

async function graphOutput(fixture) {
  const rootDir = path.join(repoRoot, "tools/financial-pond-framework");
  const config = await loadConfig(rootDir);
  const registry = buildRegistry(config);
  const base = await baseObservations();
  const inputScores = observationsToScoreMap([...base, ...filterNewsForSectorScoring(fixture.news_input_policy, allNarratives(fixture))]);
  const scored = calculateScores({ registry, graph: buildGraph(config.edges), inputScores, scoringConfig: config.scoring });
  return [...scored.results.values()].map(({ id, score, confidence, contributors }) => ({ id, score, confidence, contributors }));
}

async function sectorOutput(fixture) {
  const rootDir = path.join(repoRoot, "tools/financial-pond-framework");
  const [catalog, flowConfig, risk, base] = await Promise.all([
    json(path.join(rootDir, "config/sector_catalog/a_share_industry_etfs.json")),
    json(path.join(rootDir, "config/model/flow_engine_v0_9.json")),
    json(path.join(rootDir, "config/model/flexible_risk_factors.json")),
    baseObservations()
  ]);
  const model = evaluateSectorFlows({ observations: [...base, ...filterNewsForSectorScoring(fixture.news_input_policy, allNarratives(fixture))], sectorCatalog: catalog, flowConfig, flexibleRiskFactors: risk });
  const rotation = buildSectorRotationIntelligence({ sectorReview: { as_of: asOf, ...model, data_availability: { mode: "mock_only" } }, newsReview: { collection: { fallback_used: false } } });
  return { model, rotation, narrative_context: allNarratives(fixture).map((row) => ({ node_id: row.node_id, display_only: true })) };
}

async function fullCandidateChain(tempRoot, fixture) {
  const root = path.join(tempRoot, fixture === null ? "unused" : fixture.rss_google_news_narratives.length ? "a" : "b");
  await cp(repoRoot, root, { recursive: true, filter: (source) => !source.includes("/.git") && !source.includes("/node_modules") && !source.includes("/dist") });
  const observationDir = path.join(root, "tools/financial-pond-framework/observations", asOf);
  await mkdir(observationDir, { recursive: true });
  await writeFile(path.join(observationDir, "news_observations.json"), `${JSON.stringify({ observations: allNarratives(fixture) }, null, 2)}\n`);
  await run("bash", ["scripts/local/fp-daily.sh", asOf], root);
  const persistenceFiles = [
    "financial-pond/data/history/daily/index.json",
    "financial-pond/data/history/latest_observation_pointer.json",
    "financial-pond/data/outcome_labels.json",
    "financial-pond/data/candidate_outcome_reviews.json"
  ];
  const persistenceBeforeSiteBuild = await Promise.all(persistenceFiles.map((file) => readFile(path.join(root, file), "utf8")));
  await run("npm", ["run", "build:site"], root);
  assert.deepEqual(
    await Promise.all(persistenceFiles.map((file) => readFile(path.join(root, file), "utf8"))),
    persistenceBeforeSiteBuild,
    "site build does not mutate daily history, outcome ledger, pointer, or review data"
  );
  const names = ["pool_observation_scores.json", "evening_observation_summary.json", "observation_candidate_ledger.json", "candidate_state_model.json", "candidate_outcome_reviews.json", "candidate_due_review_verification.json", "candidate_review_history.json", "candidate_review_analytics.json"];
  const output = Object.fromEntries(await Promise.all(names.map(async (name) => [name, await json(path.join(root, "financial-pond/data", name))])));
  return canonicalModelOutput(output);
}

function canonicalModelOutput(output) {
  return withoutGeneratedAt(output);
}

async function baseObservations() {
  const rootDir = path.join(repoRoot, "tools/financial-pond-framework");
  const node = await json(path.join(rootDir, "observations/2026-07-08/node_observations.json"));
  return node.observations;
}

function brief(fixture) {
  return buildMarketPenetrationBrief({
    asOf,
    generatedAt: "2026-07-10T12:00:00.000Z",
    marketSignals: { rows: [{ pool_id: "a_share_semiconductor", pool_name: "Semiconductor", instrument_code: "512480", price_close: 1.2, price_date: asOf, momentum_value: 3, momentum_status: "derived_from_market", source_file: "fixture.csv" }] },
    marketReport: { as_of: asOf },
    newsReview: { as_of: asOf, status: "news_available", collection: { fallback_used: false }, top_events: fixture.rss_google_news_narratives.map((row) => ({ title: row.title, description: row.hypothesis, link: `https://fixture.invalid/${row.node_id}`, published_at: "2026-07-10T08:00:00Z" })) },
    sourceRegistry: { sources: [] }
  });
}

function stripBriefNarratives(value) {
  const { media_narratives, unsupported_narratives, repeated_or_stale_items, ...model } = value;
  return model;
}

function allNarratives(fixture) {
  return [...fixture.rss_google_news_narratives, ...fixture.archived_legacy_news_observations];
}

async function readFixture(name) { return json(path.join(fixtureDir, name)); }
async function json(file) { return JSON.parse(await readFile(file, "utf8")); }
function assertCanonicalEqual(actual, expected, label) { assert.equal(JSON.stringify(sortKeys(withoutGeneratedAt(actual))), JSON.stringify(sortKeys(withoutGeneratedAt(expected))), label); }
function sortKeys(value) { if (Array.isArray(value)) return value.map(sortKeys); if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])])); return value; }
function withoutGeneratedAt(value) { if (Array.isArray(value)) return value.map(withoutGeneratedAt); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "generated_at").map(([key, child]) => [key, withoutGeneratedAt(child)])); return value; }
function run(command, args, cwd) { return new Promise((resolve, reject) => { const child = spawn(command, args, { cwd, env: { ...process.env, AS_OF: asOf, GENERATED_AT: "2026-07-10T08:45:00.000Z", REVIEW_NOW: "2026-07-10T16:00:00+08:00" }, stdio: "pipe" }); let stderr = ""; child.stderr.on("data", (chunk) => { stderr += chunk; }); child.on("error", reject); child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} failed (${code}): ${stderr}`))); }); }
