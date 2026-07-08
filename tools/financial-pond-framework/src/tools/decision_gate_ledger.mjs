// FP-GATE-01 Decision Gate Ledger
// Input: ETF readiness, watchlist state, attribution, provider flow, daily modules,
// data reality, provider history, and optional graph snapshot.
// Output: decision_gate_ledger.json and decision_gate_ledger.md
// Boundary: explains why execution language remains blocked. It is not a trading instruction.

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MODULE_ID = "decision_gate_ledger_v0_10_46";

export async function runDecisionGateLedger({ rootDir = defaultRootDir, asOf }) {
  const resolvedAsOf = asOf ?? new Date().toISOString().slice(0, 10);
  const inputs = await readInputs({ rootDir, asOf: resolvedAsOf });
  const payload = buildDecisionGateLedger({ asOf: resolvedAsOf, inputs });
  const outDir = path.join(rootDir, "model_outputs", payload.as_of);
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "decision_gate_ledger.json");
  const mdPath = path.join(outDir, "decision_gate_ledger.md");
  await atomicWriteFile(jsonPath, jsonContent(payload));
  await atomicWriteFile(mdPath, buildMarkdown(payload));
  return { payload, jsonPath, mdPath };
}

export async function readInputs({ rootDir = defaultRootDir, asOf }) {
  const modelDir = path.join(rootDir, "model_outputs", asOf);
  const [etfReadiness, watchlist, attribution, flowLeaderboard, dailyAnalysis, rotationHistory, moduleReview, flowReview, dataRealityAudit, providerHistory, graphSnapshot] = await Promise.all([
    readJsonIfExists(path.join(modelDir, "etf_decision_readiness.json")),
    readJsonIfExists(path.join(modelDir, "sector_watchlist_state.json")),
    readJsonIfExists(path.join(modelDir, "sector_signal_attribution.json")),
    readJsonIfExists(path.join(modelDir, "etf_flow_leaderboard.json")),
    readJsonIfExists(path.join(modelDir, "daily_sector_analysis.json")),
    readJsonIfExists(path.join(modelDir, "sector_rotation_history.json")),
    readJsonIfExists(path.join(modelDir, "sector_module_review.json")),
    readJsonIfExists(path.join(modelDir, "sector_flow_review.json")),
    readJsonIfExists(path.join(modelDir, "data_reality_audit.json")),
    readJsonIfExists(path.join(rootDir, "model_outputs", "provider_history", "akshare_provider_history.json")),
    readJsonIfExists(path.join(rootDir, "snapshots", asOf, "graph_scores.json"))
  ]);
  return { etfReadiness, watchlist, attribution, flowLeaderboard, dailyAnalysis, rotationHistory, moduleReview, flowReview, dataRealityAudit, providerHistory, graphSnapshot };
}

export function buildDecisionGateLedger({ asOf, inputs }) {
  const guidanceState = inputs.etfReadiness?.guidance_state ?? inputs.watchlist?.guidance_state ?? inputs.dailyAnalysis?.gate_summary?.guidance_state ?? "unknown";
  const gates = buildGates({ inputs, guidanceState });
  const blockers = gates.filter((gate) => gate.status === "block");
  const warnings = gates.filter((gate) => gate.status === "warn");
  const passes = gates.filter((gate) => gate.status === "pass");
  const providerReady = gateStatus(gates, "provider_run") === "pass"
    && gateStatus(gates, "provider_history") === "pass"
    && gateStatus(gates, "estimated_flow_coverage") === "pass"
    && gateStatus(gates, "true_flow_coverage") === "pass";
  const executionBlocked = guidanceState !== "decision_support_ready" && guidanceState !== "execution_ready";

  return {
    module_id: MODULE_ID,
    as_of: inputs.etfReadiness?.as_of ?? inputs.dailyAnalysis?.as_of ?? asOf,
    generated_at: new Date().toISOString(),
    status: "gate_ledger_available",
    guidance_state: guidanceState,
    execution_state: executionBlocked ? "blocked" : "review_ready",
    headline: buildHeadline({ guidanceState, blockers, warnings, providerReady, executionBlocked }),
    gates,
    blockers: blockers.map(summaryGate),
    warnings: warnings.map(summaryGate),
    passes: passes.map(summaryGate),
    state_consistency: {
      provider_ready_but_execution_blocked: providerReady && executionBlocked,
      reading: providerReady && executionBlocked
        ? "Provider flow, history, estimated-flow coverage, and true-flow coverage are ready, but execution language remains blocked by non-provider gates."
        : "Provider and execution states are aligned with the current gate set."
    },
    next_unlock_sequence: nextUnlockSequence({ gates, inputs }),
    manual_review_boundary: "Explains readiness only; no execution instruction."
  };
}

function buildGates({ inputs, guidanceState }) {
  const readinessGates = inputs.etfReadiness?.gates ?? {};
  const share = readinessGates.share_change_diagnostics ?? {};
  const providerHistory = share.provider_history ?? inputs.providerHistory?.provider_history ?? inputs.providerHistory ?? {};
  const watchGroups = inputs.watchlist?.groups ?? {};
  const attributionConflicts = inputs.attribution?.conflicts ?? [];
  const conflictReviewCount = watchGroups.conflict_review?.length ?? 0;
  const confirmedWatchCount = watchGroups.confirmed_watch?.length ?? 0;
  const manualSeed = hasManualSeed(inputs.moduleReview) || readinessGates.valuation_fundamental_source === "manual_seed";
  const dataReality = inputs.dataRealityAudit?.overall_reality ?? readinessGates.flow_source_reality ?? "unknown";
  const nonReal = ["mixed_non_real", "mixed_observed_mock", "mock", "fixture", "manual_seed", "derived_from_non_real"].includes(dataReality);
  const sampleDays = readinessGates.sample_days ?? inputs.rotationHistory?.sample_days ?? 0;
  const minSampleDays = readinessGates.min_sample_days ?? inputs.rotationHistory?.min_required_days_for_trend ?? 3;
  const hasSnapshot = Boolean(inputs.graphSnapshot?.results?.length);

  return [
    gate("provider_run", "Provider run", readinessGates.provider_run === "real_ok" ? "pass" : "block",
      readinessGates.provider_run === "real_ok" ? "Real provider run is present for the selected date." : "Real provider run is missing or not confirmed.",
      { provider_run: readinessGates.provider_run ?? "unknown" },
      "Keep the provider run in the daily path."),
    gate("provider_history", "Provider history", providerHistory?.date_count >= 2 || inputs.providerHistory?.status === "flow_gate_ready" ? "pass" : "block",
      "Provider history must include current and previous dates for share-change flow.",
      { dates: providerHistory?.available_dates ?? inputs.providerHistory?.dates ?? [], status: inputs.providerHistory?.status ?? null },
      "Maintain provider CSV history across daily runs."),
    gate("estimated_flow_coverage", "Estimated-flow coverage", (share.estimated_flow_rows ?? 0) >= 11 ? "pass" : "block",
      `${share.estimated_flow_rows ?? 0}/11 representative rows have estimated_flow.`,
      { estimated_flow_rows: share.estimated_flow_rows ?? 0, total_rows: share.total_rows ?? null },
      "Regenerate provider flow observations if coverage drops."),
    gate("true_flow_coverage", "True-flow coverage", (readinessGates.true_flow_coverage ?? 0) >= 1 ? "pass" : (readinessGates.true_flow_coverage ?? 0) >= 0.6 ? "warn" : "block",
      `True-flow coverage is ${readinessGates.true_flow_coverage ?? "unknown"}.`,
      { true_flow_coverage: readinessGates.true_flow_coverage ?? null },
      "Keep representative ETF mappings and provider observations complete."),
    gate("attribution_conflict", "Attribution conflicts", attributionConflicts.length ? "warn" : "pass",
      attributionConflicts.length ? `${attributionConflicts.length} attribution conflict(s) require review.` : "No attribution conflicts are currently recorded.",
      { conflict_count: attributionConflicts.length, conflict_ids: attributionConflicts.map((item) => item.id) },
      "Resolve or annotate attribution conflicts before relaxing readiness."),
    gate("watchlist_conflict_review", "Watchlist conflict review", conflictReviewCount ? "warn" : "pass",
      conflictReviewCount ? `${conflictReviewCount} watchlist row(s) are in conflict_review.` : "No watchlist rows are in conflict_review.",
      { conflict_review_count: conflictReviewCount, sectors: watchGroups.conflict_review ?? [] },
      "Review conflict rows before changing model thresholds."),
    gate("confirmed_watch_available", "Confirmed watch rows", confirmedWatchCount ? "pass" : "warn",
      confirmedWatchCount ? `${confirmedWatchCount} confirmed_watch row(s) are available.` : "No confirmed_watch rows are available.",
      { confirmed_watch_count: confirmedWatchCount, sectors: watchGroups.confirmed_watch ?? [] },
      "Keep confirmed rows separate from conflict and single-line evidence rows."),
    gate("valuation_fundamental_reality", "Valuation and fundamental reality", manualSeed ? "block" : "pass",
      manualSeed ? "Valuation or fundamental modules still depend on manual seed inputs." : "Valuation and fundamental modules are not marked as manual seed.",
      { valuation_fundamental_source: readinessGates.valuation_fundamental_source ?? "unknown" },
      "Connect reviewed valuation and fundamental sources."),
    gate("rotation_visibility", "Rotation visibility", sampleDays >= minSampleDays ? "pass" : "warn",
      `Rotation sample depth is ${sampleDays}/${minSampleDays}.`,
      { sample_days: sampleDays, min_sample_days: minSampleDays, trend_state: inputs.rotationHistory?.trend_state ?? null },
      "Continue daily history accumulation."),
    gate("pool_graph_snapshot", "Pool graph snapshot", hasSnapshot ? "pass" : "warn",
      hasSnapshot ? "Graph snapshot is available for pool-level explanation." : "Graph snapshot is missing for the selected date.",
      { snapshot_available: hasSnapshot },
      "Run cycle before pool analysis if the snapshot is absent."),
    gate("data_reality_audit", "Data reality audit", nonReal ? "block" : inputs.dataRealityAudit ? "pass" : "unknown",
      nonReal ? "Data reality still contains non-real, mixed, or manual layers." : inputs.dataRealityAudit ? "Data reality audit is available and not marked non-real." : "Data reality audit is not available.",
      { overall_reality: dataReality, market_use_confidence: readinessGates.market_use_confidence ?? null },
      "Remove or label non-real layers before execution language can unlock."),
    gate("execution_language_safety", "Execution language safety", guidanceState === "decision_support_ready" || guidanceState === "execution_ready" ? "pass" : "block",
      `Current guidance_state is ${guidanceState}; execution language remains blocked.`,
      { guidance_state: guidanceState },
      "Only change this gate after all blocker gates pass.")
  ];
}

function gate(gateId, label, status, reading, evidence, nextAction) {
  return { gate_id: gateId, label, status, reading: sanitize(reading), evidence, next_action: sanitize(nextAction) };
}

function summaryGate(gate) {
  return {
    gate_id: gate.gate_id,
    label: gate.label,
    status: gate.status,
    reading: gate.reading,
    next_action: gate.next_action
  };
}

function gateStatus(gates, id) {
  return gates.find((gate) => gate.gate_id === id)?.status ?? "unknown";
}

function hasManualSeed(moduleReview) {
  return (moduleReview?.sectors ?? []).some((row) => {
    const modules = row.modules ?? {};
    return modules.valuation?.status === "manual_seed" || modules.fundamental?.status === "manual_seed";
  });
}

function nextUnlockSequence({ gates, inputs }) {
  const sequence = [];
  for (const id of ["data_reality_audit", "valuation_fundamental_reality", "attribution_conflict", "watchlist_conflict_review", "execution_language_safety"]) {
    const item = gates.find((gate) => gate.gate_id === id);
    if (item && item.status !== "pass") sequence.push({ gate_id: item.gate_id, label: item.label, next_action: item.next_action });
  }
  const progressUnlock = inputs.etfReadiness?.progress?.next_unlock;
  if (progressUnlock && !sequence.some((item) => item.label === progressUnlock.label)) {
    sequence.push({ gate_id: progressUnlock.milestone_id ?? "readiness_next_unlock", label: progressUnlock.label, next_action: sanitize(progressUnlock.reading ?? "") });
  }
  return sequence;
}

function buildHeadline({ guidanceState, blockers, warnings, providerReady, executionBlocked }) {
  const consistency = providerReady && executionBlocked ? "provider gates pass but execution remains blocked" : "provider and execution gates are aligned";
  return `Decision gate ledger: ${blockers.length} block, ${warnings.length} warn; ${consistency}; guidance_state=${guidanceState}.`;
}

function sanitize(value) {
  return String(value ?? "")
    .replaceAll("买入", "执行")
    .replaceAll("买 ETF", "执行 ETF")
    .replaceAll("buy", "execute")
    .replaceAll("sell", "reduce")
    .replaceAll("position", "allocation");
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function buildMarkdown(payload) {
  const lines = [
    `# Decision Gate Ledger ${payload.as_of}`,
    "",
    `Guidance state: ${payload.guidance_state}`,
    `Execution state: ${payload.execution_state}`,
    "",
    payload.headline,
    "",
    "Readiness explanation only. Not a trading instruction.",
    "",
    "| Gate | Status | Reading | Next action |",
    "| --- | --- | --- | --- |"
  ];
  for (const gate of payload.gates) {
    lines.push(`| ${gate.label} | ${gate.status} | ${gate.reading} | ${gate.next_action} |`);
  }
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--as-of") args.asOf = argv[index + 1];
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = await runDecisionGateLedger({ rootDir: defaultRootDir, asOf: args.asOf });
  console.log(`Decision gate ledger written: ${result.jsonPath}`);
  console.log(`Decision gate ledger report written: ${result.mdPath}`);
  console.log(result.payload.headline);
}
