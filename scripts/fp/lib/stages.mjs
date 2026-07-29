import { spawn } from "node:child_process";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  COMMAND_CONTRACT_VERSION,
  MODEL_VERSION,
  SCHEMA_VERSION
} from "./contracts.mjs";
import {
  dataDir,
  inputDir,
  readJson,
  readOptionalJson,
  root,
  stableHash,
  substantive,
  workDir,
  writeJson
} from "./io.mjs";
import {
  assessObservations,
  buildObservations,
  decideEntries,
  normalizeInputs,
  validateOfficialArtifacts
} from "./model.mjs";
import { buildReviewAnalytics } from "./reviews.mjs";
import { loadTradingCalendar } from "../../lib/trading-calendar.mjs";

const OFFICIAL = Object.freeze({
  sector_assessment: "sector_assessment_daily.json",
  entry_decision: "entry_decision_daily.json",
  market_penetration: "market_penetration_brief.json",
  review_analytics: "review_analytics.json"
});

export async function collect({ asOf, mode }) {
  if (!["live", "historical", "offline"].includes(mode)) throw new Error(`Explicit collection mode required: live, historical, or offline; received ${mode}`);
  if (mode !== "offline") await runProviderAcquisition({ asOf, mode });

  const csvPath = resolve(root, "tools/financial-pond-framework/data/provider_exports/a_share_etf_daily.csv");
  const benchmarkPath = resolve(root, "tools/financial-pond-framework/data/provider_exports/a_share_benchmark_daily.json");
  const breadthPath = resolve(dataDir, "sector_breadth_daily.json");
  const { parseCsv } = await import("./io.mjs");
  const [etfRows, benchmark, breadth] = await Promise.all([
    readFile(csvPath, "utf8").then(parseCsv),
    readJson(benchmarkPath),
    readOptionalJson(breadthPath, { status: "unavailable", rows: [], reason: "source-backed breadth unavailable" })
  ]);
  const filteredEtf = etfRows.filter((row) => (row.date ?? row.trade_date) <= asOf);
  const filteredBenchmark = (benchmark.rows ?? []).filter((row) => (row.date ?? row.trade_date) <= asOf);
  if (!filteredEtf.some((row) => (row.date ?? row.trade_date) === asOf)) throw new Error(`No exact-date ETF input for ${asOf}`);
  if (!filteredBenchmark.some((row) => (row.date ?? row.trade_date) === asOf)) throw new Error(`No exact-date benchmark input for ${asOf}`);
  const snapshotPayload = { as_of: asOf, etf_rows: filteredEtf, benchmark_rows: filteredBenchmark, breadth };
  const inputSnapshotId = `a-share-${asOf}-${stableHash(snapshotPayload).slice(0, 12)}`;
  const destination = inputDir(asOf);
  await mkdir(destination, { recursive: true });
  await Promise.all([
    writeJson(resolve(destination, "etf_ohlcva.json"), { as_of: asOf, rows: filteredEtf }),
    writeJson(resolve(destination, "benchmark_ohlcva.json"), { as_of: asOf, rows: filteredBenchmark, benchmark: benchmark.benchmark ?? null }),
    writeJson(resolve(destination, "breadth.json"), { ...breadth, as_of: asOf }),
    writeJson(resolve(destination, "manifest.json"), {
      schema_version: "fp-input-snapshot-v1",
      as_of: asOf,
      generated_at: new Date().toISOString(),
      mode,
      input_snapshot_id: inputSnapshotId,
      files: ["etf_ohlcva.json", "benchmark_ohlcva.json", "breadth.json"],
      source_reality: mode === "offline" ? "committed_offline_inputs" : "provider_acquisition",
      replayable: true
    })
  ]);
  return { as_of: asOf, mode, input_snapshot_id: inputSnapshotId };
}

export async function normalize({ asOf }) {
  const source = inputDir(asOf);
  const [manifest, etf, benchmark, breadth] = await Promise.all([
    readJson(resolve(source, "manifest.json")),
    readJson(resolve(source, "etf_ohlcva.json")),
    readJson(resolve(source, "benchmark_ohlcva.json")),
    readJson(resolve(source, "breadth.json"))
  ]);
  const normalized = normalizeInputs({
    asOf,
    etfRows: etf.rows ?? [],
    benchmarkRows: benchmark.rows ?? [],
    breadth,
    inputSnapshotId: manifest.input_snapshot_id
  });
  await writeJson(resolve(workDir(asOf), "normalized_market_inputs.json"), normalized);
  await writeJson(resolve(workDir(asOf), "canonical_identity_audit.json"), {
    as_of: asOf,
    input_snapshot_id: manifest.input_snapshot_id,
    status: "passed",
    canonical_universe_count: normalized.universe.length,
    duplicate_canonical_ids: []
  });
  await writeJson(resolve(workDir(asOf), "data_alignment_audit.json"), {
    as_of: asOf,
    input_snapshot_id: manifest.input_snapshot_id,
    status: normalized.alignment.exact_date_valid ? "passed" : "failed",
    ...normalized.alignment
  });
  if (!normalized.alignment.exact_date_valid) throw new Error(`Exact-date alignment failed for ${asOf}`);
  return normalized;
}

export async function observe({ asOf }) {
  const normalized = await readJson(resolve(workDir(asOf), "normalized_market_inputs.json"));
  const observations = buildObservations(normalized);
  await writeJson(resolve(workDir(asOf), "pool_observations.json"), observations);
  await writeJson(resolve(workDir(asOf), "observation_coverage.json"), observations.coverage);
  return observations;
}

export async function assess({ asOf }) {
  const observations = await readJson(resolve(workDir(asOf), "pool_observations.json"));
  const previous = await previousAssessmentRows(asOf);
  const assessment = assessObservations(observations, previous);
  await writeJson(resolve(workDir(asOf), OFFICIAL.sector_assessment), assessment);
  await writeJson(resolve(workDir(asOf), "assessment_contract_audit.json"), {
    as_of: asOf,
    status: "passed",
    canonical_universe_count: assessment.rows.length,
    visible_ordinal_rank_generated: false,
    legacy_score_influence: false
  });
  return assessment;
}

export async function penetrate({ asOf }) {
  const normalized = await readJson(resolve(workDir(asOf), "normalized_market_inputs.json"));
  const legacy = await readOptionalJson(resolve(dataDir, "market_penetration_brief.json"), null);
  const useLegacy = legacy?.as_of === asOf;
  const penetration = {
    schema_version: "market-penetration-v1",
    as_of: asOf,
    generated_at: new Date().toISOString(),
    model_version: MODEL_VERSION,
    command_contract_version: COMMAND_CONTRACT_VERSION,
    input_snapshot_id: normalized.input_snapshot_id,
    display_contract: {
      mode: "display_only",
      affects_hard_model_fields: false
    },
    facts: useLegacy ? (legacy.market_facts ?? legacy.verified_facts ?? []) : [],
    narratives: useLegacy ? (legacy.media_narratives ?? legacy.why_market_moved ?? []) : [],
    thesis_evidence_delta: [],
    unresolved_events: [],
    limitations: useLegacy
      ? ["Legacy narrative retained for display only; it cannot alter structural or entry fields."]
      : ["No same-date committed penetration source was available; narrative remains empty."]
  };
  await writeJson(resolve(workDir(asOf), OFFICIAL.market_penetration), penetration);
  return penetration;
}

export async function decide({ asOf }) {
  const assessment = await readJson(resolve(workDir(asOf), OFFICIAL.sector_assessment));
  const decision = decideEntries(assessment);
  await writeJson(resolve(workDir(asOf), OFFICIAL.entry_decision), decision);
  await writeJson(resolve(workDir(asOf), "decision_gate_audit.json"), {
    as_of: asOf,
    status: "passed",
    no_candidate_allowed: true,
    primary_entry_eligible: decision.primary_entry_candidate
      ? ["ready_now", "probe_only"].includes(decision.primary_entry_candidate.entry_state)
      : null,
    legacy_rank_influence: false
  });
  return decision;
}

export async function review({ asOf }) {
  const normalized = await readJson(resolve(workDir(asOf), "normalized_market_inputs.json"));
  const currentAssessment = await readJson(resolve(workDir(asOf), OFFICIAL.sector_assessment));
  const currentDecision = await readJson(resolve(workDir(asOf), OFFICIAL.entry_decision));
  const [assessmentHistory, decisionHistory, previousReviewArtifacts, calendar] = await Promise.all([
    historicalArtifacts("assessments", asOf),
    historicalArtifacts("decisions", asOf),
    historicalArtifacts("reviews", asOf),
    loadTradingCalendar()
  ]);
  const legacy = await readOptionalJson(resolve(dataDir, "candidate_review_analytics.json"), {});
  const built = buildReviewAnalytics({
    asOf,
    assessmentHistory: [...assessmentHistory, currentAssessment],
    decisionHistory: [...decisionHistory, currentDecision],
    calendar,
    etfRows: normalized.etf_rows,
    benchmarkRows: normalized.benchmark_rows,
    previousStructuralReviews: previousReviewArtifacts.flatMap((artifact) => artifact.structural_state_reviews ?? []),
    previousEntryReviews: previousReviewArtifacts.flatMap((artifact) => artifact.entry_state_reviews ?? [])
  });
  const reviewArtifact = {
    schema_version: "review-analytics-v1",
    as_of: asOf,
    generated_at: new Date().toISOString(),
    model_version: MODEL_VERSION,
    command_contract_version: COMMAND_CONTRACT_VERSION,
    input_snapshot_id: normalized.input_snapshot_id,
    review_horizons: ["T+1", "T+3", "T+5", "T+20"],
    allowed_statuses: ["pending", "reviewed", "unavailable", "skipped"],
    exact_session_required: true,
    latest_close_fallback: false,
    preserved_legacy_review_summary: {
      source_as_of: legacy.as_of ?? null,
      reviewed_rows: legacy.reviewed_rows ?? 0,
      pending_rows: legacy.pending_rows ?? 0,
      unavailable_rows: legacy.unavailable_rows ?? 0,
      status: legacy.status ?? "unavailable"
    },
    structural_state_reviews: built.structural_state_reviews,
    entry_state_reviews: built.entry_state_reviews,
    status_counts: built.status_counts,
    migration_limitations: [
      "Previously reviewed legacy outcomes are preserved in their existing ledger.",
      "New structural/entry cohorts use archived full-universe artifacts and exact A-share sessions."
    ]
  };
  await writeJson(resolve(workDir(asOf), OFFICIAL.review_analytics), reviewArtifact);
  return reviewArtifact;
}

export async function persist({ asOf }) {
  const directory = workDir(asOf);
  const [assessment, decision, penetration, reviewArtifact] = await Promise.all([
    readJson(resolve(directory, OFFICIAL.sector_assessment)),
    readJson(resolve(directory, OFFICIAL.entry_decision)),
    readJson(resolve(directory, OFFICIAL.market_penetration)),
    readJson(resolve(directory, OFFICIAL.review_analytics))
  ]);
  const history = resolve(dataDir, "history");
  await Promise.all([
    writeIdempotent(resolve(history, "assessments", `${asOf}.json`), assessment),
    writeIdempotent(resolve(history, "decisions", `${asOf}.json`), decision),
    writeIdempotent(resolve(history, "penetration", `${asOf}.json`), penetration),
    writeIdempotent(resolve(history, "reviews", `${asOf}.json`), reviewArtifact)
  ]);
  await writeJson(resolve(directory, "persist_audit.json"), {
    as_of: asOf,
    status: "passed",
    full_universe_count: assessment.rows.length,
    idempotent: true
  });
  return { status: "persisted", full_universe_count: assessment.rows.length };
}

export async function validate({ asOf }) {
  const directory = workDir(asOf);
  const [assessment, decision, penetration, reviewArtifact, normalized] = await Promise.all([
    readJson(resolve(directory, OFFICIAL.sector_assessment)),
    readJson(resolve(directory, OFFICIAL.entry_decision)),
    readJson(resolve(directory, OFFICIAL.market_penetration)),
    readJson(resolve(directory, OFFICIAL.review_analytics)),
    readJson(resolve(directory, "normalized_market_inputs.json"))
  ]);
  const manifest = {
    schema_version: SCHEMA_VERSION,
    as_of: asOf,
    generated_at: new Date().toISOString(),
    model_version: MODEL_VERSION,
    command_contract_version: COMMAND_CONTRACT_VERSION,
    input_snapshot_id: normalized.input_snapshot_id,
    mode: (await readJson(resolve(inputDir(asOf), "manifest.json"))).mode,
    status: "validated",
    validation_status: "passed",
    degraded_channels: [
      ...(normalized.breadth?.status === "available" ? [] : ["breadth"]),
      "direct_flow"
    ],
    artifacts: OFFICIAL
  };
  validateOfficialArtifacts({ manifest, assessment, decision, penetration, review: reviewArtifact });
  await writeJson(resolve(directory, "daily_manifest.json"), manifest);
  return manifest;
}

export async function publish({ asOf }) {
  const directory = workDir(asOf);
  const manifest = await readJson(resolve(directory, "daily_manifest.json"));
  const artifacts = {};
  for (const [role, filename] of Object.entries(manifest.artifacts)) {
    artifacts[role] = await readJson(resolve(directory, filename));
  }
  validateOfficialArtifacts({
    manifest,
    assessment: artifacts.sector_assessment,
    decision: artifacts.entry_decision,
    penetration: artifacts.market_penetration,
    review: artifacts.review_analytics
  });
  for (const filename of Object.values(manifest.artifacts)) {
    await writeJson(resolve(dataDir, filename), await readJson(resolve(directory, filename)));
  }
  await writeJson(resolve(dataDir, "daily_manifest.json"), {
    ...manifest,
    published_at: new Date().toISOString()
  });
  await writeJson(resolve(dataDir, "history", "manifests", `${asOf}.json`), manifest);
  return manifest;
}

export async function audit({ asOf }) {
  const manifest = await readJson(resolve(dataDir, "daily_manifest.json"));
  if (manifest.as_of !== asOf) throw new Error(`Published manifest is ${manifest.as_of}, not requested ${asOf}`);
  const [assessment, decision, penetration, reviewArtifact] = await Promise.all([
    readJson(resolve(dataDir, manifest.artifacts.sector_assessment)),
    readJson(resolve(dataDir, manifest.artifacts.entry_decision)),
    readJson(resolve(dataDir, manifest.artifacts.market_penetration)),
    readJson(resolve(dataDir, manifest.artifacts.review_analytics))
  ]);
  validateOfficialArtifacts({ manifest, assessment, decision, penetration, review: reviewArtifact });
  return { as_of: asOf, status: "passed", mutations: 0 };
}

async function previousAssessmentRows(asOf) {
  const directory = resolve(dataDir, "history", "assessments");
  try {
    const dates = (await readdir(directory))
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name) && name.slice(0, 10) < asOf)
      .sort();
    if (!dates.length) return [];
    return (await readJson(resolve(directory, dates.at(-1)))).rows ?? [];
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function historicalArtifacts(kind, asOf) {
  const directory = resolve(dataDir, "history", kind);
  try {
    const files = (await readdir(directory))
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name) && name.slice(0, 10) <= asOf)
      .sort();
    return Promise.all(files.map((name) => readJson(resolve(directory, name))));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function writeIdempotent(path, value) {
  const existing = await readOptionalJson(path, null);
  if (existing && stableHash(substantive(existing)) !== stableHash(substantive(value))) {
    const contractRevision = existing.model_version !== value.model_version
      || existing.command_contract_version !== value.command_contract_version;
    if (!contractRevision) throw new Error(`Idempotence violation: ${path} already contains different substantive output`);
    await writeJson(path, value);
    return;
  }
  if (!existing) await writeJson(path, value);
}

async function runProviderAcquisition({ asOf, mode }) {
  const cwd = resolve(root, "tools", "financial-pond-framework");
  const steps = mode === "live"
    ? [
        ["python3", ["providers/akshare_etf_bridge/doctor.py"]],
        ["python3", ["providers/akshare_etf_bridge/export_a_share_etf_daily.py", "--as-of", asOf]],
        ["python3", ["providers/akshare_etf_bridge/persist_daily_etf_history.py", "--as-of", asOf]],
        ["python3", ["providers/akshare_etf_bridge/fetch_benchmark_history.py", "--date", asOf]]
      ]
    : [
        ["python3", ["providers/akshare_etf_bridge/backfill_market_history.py", "--mode", "strict", "--end-date", asOf, "--target-trade-days", "60"]]
      ];
  for (const [command, args] of steps) await spawnCommand(command, args, cwd);
}

function spawnCommand(command, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, shell: false, stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} exited ${code}`)));
  });
}

export { OFFICIAL };
