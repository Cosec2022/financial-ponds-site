import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "financial-pond", "data");
const historyDir = resolve(dataDir, "history", "observations");
const allowedStates = new Set(["Noise", "Pulse", "Early Right", "Major Candidate", "Confirmed Trend", "Overheated", "Cooling", "Failed"]);
const allowedRiskGates = new Set(["pass", "caution", "block", "insufficient_data"]);

const [ledger, scores, summary, priceBasis] = await Promise.all([
  readJson("observation_candidate_ledger.json"),
  readJson("pool_observation_scores.json"),
  readJson("evening_observation_summary.json"),
  readJsonOptional("candidate_price_basis.json", { rows: [] })
]);
const archives = await readArchives();
const generatedAt = new Date().toISOString();
const scoreByKey = new Map((scores.rows ?? []).map((row) => [`${scores.as_of}|${row.pool_id}`, row]));
const basisByKey = new Map((priceBasis.rows ?? []).map((row) => [`${row.candidate_as_of}|${row.pool_id}`, row]));
const readCache = {
  pool_market_signals: await readJson("pool_market_signals.json"),
  pool_instrument_map: await readJson("pool_instrument_map.json"),
  pool_signal_quality: await readJson("pool_signal_quality.json"),
  pool_delta_signals: await readJson("pool_delta_signals.json")
};

const enrichedRows = (ledger.rows ?? []).map(enrichCandidate);
const stateByKey = new Map(enrichedRows.map((row) => [`${row.as_of}|${row.pool_id}`, row]));
const scoreRows = (scores.rows ?? []).map((row) => {
  const state = stateByKey.get(`${scores.as_of}|${row.pool_id}`);
  return state ? applyStateFields(row, state) : row;
});
const topRows = (summary.top_observation_pools ?? []).map((row) => {
  const state = stateByKey.get(`${summary.as_of}|${row.pool_id}`);
  return state ? applyStateFields(row, state) : row;
});
const cautionRows = (summary.caution_pools ?? []).map((row) => {
  const state = stateByKey.get(`${summary.as_of}|${row.pool_id}`);
  return state ? applyStateFields(row, state) : row;
});
const priceBasisRows = (priceBasis.rows ?? []).map((row) => {
  const state = stateByKey.get(`${row.candidate_as_of}|${row.pool_id}`);
  return state ? {
    ...row,
    candidate_score: state.observation_score,
    candidate_state: state.candidate_state,
    overheat_score: state.overheat_score,
    major_wave_score: state.major_wave_score,
    risk_gate_status: state.risk_gate_status,
    state_reason: state.state_reason,
    overheat_reason: state.overheat_reason,
    major_wave_reason: state.major_wave_reason,
    risk_gate_reason: state.risk_gate_reason
  } : row;
});
const stateCounts = countBy(enrichedRows, "candidate_state");
const riskCounts = countBy(enrichedRows, "risk_gate_status");
const output = {
  module_id: "candidate_state_model_v0_10_61",
  as_of: ledger.as_of,
  generated_at: generatedAt,
  status: "state_model_available",
  candidate_count: enrichedRows.length,
  states_distribution: stateCounts,
  risk_gate_distribution: riskCounts,
  rows: enrichedRows.map((row) => ({
    as_of: row.as_of,
    pool_id: row.pool_id,
    pool_name: row.pool_name,
    candidate_state: row.candidate_state,
    overheat_score: row.overheat_score,
    major_wave_score: row.major_wave_score,
    risk_gate_status: row.risk_gate_status,
    state_reason: row.state_reason,
    overheat_reason: row.overheat_reason,
    major_wave_reason: row.major_wave_reason,
    risk_gate_reason: row.risk_gate_reason,
    boundary: "observe_only; right-side model classification only"
  })),
  model_notes: [
    "Classification uses only candidate-date artifacts and prior archives.",
    "Outcome reviews are not used to classify current candidates.",
    "Overheat penalties do not remove candidates; they label late-stage risk.",
    "Major wave score expresses observation quality, not a trading instruction."
  ]
};

await writeJson("observation_candidate_ledger.json", {
  ...ledger,
  module_id: "observation_candidate_ledger_v0_10_61",
  generated_at: generatedAt,
  rows: enrichedRows
});
await writeJson("pool_observation_scores.json", {
  ...scores,
  module_id: "pool_observation_scores_v0_10_61",
  generated_at: generatedAt,
  rows: scoreRows
});
await writeJson("evening_observation_summary.json", {
  ...summary,
  module_id: "evening_observation_summary_v0_10_61",
  generated_at: generatedAt,
  top_observation_pools: topRows,
  caution_pools: cautionRows,
  key_findings: [
    ...(summary.key_findings ?? []),
    `Right-side states: ${Object.entries(stateCounts).map(([state, count]) => `${state} ${count}`).join(", ")}.`
  ],
  boundary_notes: [...new Set([...(summary.boundary_notes ?? []), "Right-side state is observation-only and excludes future outcomes."])]
});
await writeJson("candidate_price_basis.json", {
  ...priceBasis,
  module_id: "candidate_price_basis_v0_10_61",
  generated_at: generatedAt,
  rows: priceBasisRows
});
await writeJson("candidate_state_model.json", output);
console.log(`Candidate state model written: candidates=${enrichedRows.length}, states=${JSON.stringify(stateCounts)}`);

function enrichCandidate(candidate) {
  const artifacts = artifactsFor(candidate.as_of);
  const score = scoreByKey.get(`${candidate.as_of}|${candidate.pool_id}`) ?? candidate;
  const market = findRow(artifacts.pool_market_signals, candidate.pool_id);
  const mapping = findRow(artifacts.pool_instrument_map, candidate.pool_id);
  const quality = findRow(artifacts.pool_signal_quality, candidate.pool_id);
  const delta = findRow(artifacts.pool_delta_signals, candidate.pool_id);
  const basis = basisByKey.get(`${candidate.as_of}|${candidate.pool_id}`);
  const ranking = rankFor(candidate.as_of, candidate.pool_id);
  const momentum = numberOrNull(market?.momentum_value);
  const turnover = numberOrNull(market?.turnover);
  const amount = numberOrNull(market?.amount ?? market?.liquidity_value);
  const amountMedian = median((artifacts.pool_market_signals?.rows ?? []).map((row) => numberOrNull(row.amount ?? row.liquidity_value)).filter((value) => value !== null && value > 0));
  const topSessions = recentTopSessions(candidate.as_of, candidate.pool_id);
  const overheat = overheatScore({ candidate, score, market, momentum, turnover, amount, amountMedian, ranking, topSessions });
  const risk = riskGate({ candidate, mapping, quality, market, basis, overheat });
  const major = majorWaveScore({ candidate, score, market, mapping, quality, delta, basis, overheat, risk, momentum });
  const state = classifyState({ candidate, score, market, mapping, quality, delta, basis, overheat, major, risk, momentum });
  const reasons = reasonsFor({ candidate, score, market, mapping, quality, delta, basis, overheat, major, risk, state, momentum, turnover, topSessions });
  return {
    ...candidate,
    candidate_state: state,
    overheat_score: overheat,
    major_wave_score: major,
    risk_gate_status: risk,
    state_reason: reasons.state_reason,
    overheat_reason: reasons.overheat_reason,
    major_wave_reason: reasons.major_wave_reason,
    risk_gate_reason: reasons.risk_gate_reason
  };
}

function overheatScore({ candidate, score, market, momentum, turnover, amount, amountMedian, ranking, topSessions }) {
  let value = 0;
  if (momentum !== null && Math.abs(momentum) >= 8) value += 32;
  else if (momentum !== null && Math.abs(momentum) >= 5) value += 22;
  else if (momentum !== null && Math.abs(momentum) >= 3) value += 10;
  if (turnover !== null && turnover >= 10) value += 20;
  else if (turnover !== null && turnover >= 6) value += 10;
  if (amount !== null && amountMedian && amount > amountMedian * 4) value += 14;
  else if (amount !== null && amountMedian && amount > amountMedian * 2) value += 8;
  if (topSessions >= 3) value += 14;
  else if (topSessions >= 2) value += 8;
  if (ranking <= 2 && momentum !== null && Math.abs(momentum) >= 5) value += 10;
  if (candidate.flow_status !== "source_backed" && momentum !== null && Math.abs(momentum) >= 6) value += 8;
  if (score.delta_flag === "new_signal" && momentum !== null && Math.abs(momentum) >= 5) value += 8;
  if (market?.liquidity_direction === "above_median" && momentum !== null && Math.abs(momentum) >= 8) value += 6;
  return clampRound(value, 0, 100);
}

function majorWaveScore({ candidate, score, market, mapping, quality, delta, basis, overheat, risk, momentum }) {
  let value = 0;
  if (quality?.evidence_quality === "high") value += 20;
  else if (quality?.evidence_quality === "medium") value += 13;
  else if (quality?.evidence_quality === "low") value += 5;
  if (["direct_index", "direct_etf"].includes(mapping?.mapping_status)) value += 16;
  else if (mapping?.mapping_status === "sector_proxy") value += 7;
  if (available(candidate.flow_status)) value += 11;
  if (available(candidate.momentum_status)) value += 11;
  if (available(candidate.liquidity_status)) value += 11;
  if (momentum !== null && momentum > 0 && momentum <= 5) value += 13;
  else if (momentum !== null && momentum > 5 && momentum <= 8) value += 7;
  else if (momentum !== null && momentum < 0 && candidate.direction === "outward") value += 4;
  if (market?.liquidity_direction === "above_median") value += 9;
  if (["improved_data", "new_signal", "confidence_change"].includes(delta?.review_flag)) value += 7;
  if (numberOrZero(candidate.capped_confidence) >= 0.6) value += 8;
  if (basis?.baseline_available) value += 5;
  if (risk === "pass") value += 8;
  if (risk === "caution") value += 2;
  if (overheat >= 70) value -= 22;
  else if (overheat >= 45) value -= 10;
  if (quality?.proxy_risk === "high") value -= 12;
  else if (quality?.proxy_risk === "medium") value -= 7;
  return clampRound(value, 0, 100);
}

function riskGate({ candidate, mapping, quality, market, basis, overheat }) {
  if (!available(candidate.momentum_status) && !available(candidate.liquidity_status)) return "insufficient_data";
  if (["unmapped", "unavailable"].includes(mapping?.mapping_status) || quality?.evidence_quality === "unavailable") return "block";
  if (basis && basis.baseline_available === false) return "block";
  if (quality?.proxy_risk === "high" || overheat >= 70) return "caution";
  if (market?.momentum_status === "missing" || market?.liquidity_status === "missing") return "insufficient_data";
  if (quality?.evidence_quality === "low" || overheat >= 45 || mapping?.mapping_status === "sector_proxy") return "caution";
  return "pass";
}

function classifyState({ candidate, score, quality, delta, overheat, major, risk, momentum }) {
  if (!allowedRiskGates.has(risk)) return "Noise";
  if (risk === "block") return "Failed";
  if (risk === "insufficient_data") return "Noise";
  if (overheat >= 70) return "Overheated";
  if (momentum !== null && momentum < -2 && candidate.direction !== "outward") return "Cooling";
  if (major >= 78 && candidate.observation_tier === "strong_observe" && risk === "pass") return "Confirmed Trend";
  if (major >= 62 && ["strong_observe", "moderate_observe"].includes(candidate.observation_tier)) return "Major Candidate";
  if (major >= 45 && ["improved_data", "new_signal", "confidence_change"].includes(delta?.review_flag)) return "Early Right";
  if (overheat >= 45 || numberOrZero(score.final_score ?? candidate.observation_score) >= 55) return "Pulse";
  return "Noise";
}

function reasonsFor({ candidate, market, mapping, quality, basis, overheat, major, risk, state, momentum, turnover, topSessions }) {
  const overheatReasons = [];
  if (momentum !== null && Math.abs(momentum) >= 8) overheatReasons.push("large short-term move");
  else if (momentum !== null && Math.abs(momentum) >= 5) overheatReasons.push("elevated short-term move");
  if (turnover !== null && turnover >= 10) overheatReasons.push("turnover spike");
  if (topSessions >= 2) overheatReasons.push("recent top persistence");
  if (candidate.flow_status !== "source_backed" && momentum !== null && Math.abs(momentum) >= 6) overheatReasons.push("strength without hard flow");

  const majorReasons = [];
  if (quality?.evidence_quality) majorReasons.push(`${quality.evidence_quality} evidence`);
  if (["direct_index", "direct_etf"].includes(mapping?.mapping_status)) majorReasons.push("direct mapped instrument");
  if (available(candidate.momentum_status) && available(candidate.liquidity_status)) majorReasons.push("market confirmation present");
  if (market?.liquidity_direction === "above_median") majorReasons.push("liquidity support");
  if (basis?.baseline_available) majorReasons.push("baseline ready");

  const riskReasons = [];
  if (risk === "pass") riskReasons.push("direct evidence and capped confidence usable");
  if (risk === "caution") {
    if (overheat >= 45) riskReasons.push("overheat guardrail active");
    if (mapping?.mapping_status === "sector_proxy") riskReasons.push("proxy evidence");
    if (quality?.proxy_risk === "high") riskReasons.push("high proxy risk");
  }
  if (risk === "block") riskReasons.push("mapping or baseline unavailable");
  if (risk === "insufficient_data") riskReasons.push("market confirmation incomplete");

  return {
    state_reason: `${state}: ${majorReasons.slice(0, 2).join("; ") || "limited signal evidence"}.`,
    overheat_reason: overheatReasons.length ? overheatReasons.slice(0, 3).join("; ") : "No strong overheat flag.",
    major_wave_reason: majorReasons.length ? `${majorReasons.slice(0, 4).join("; ")}; score ${major}.` : `Limited major-wave support; score ${major}.`,
    risk_gate_reason: riskReasons.join("; ") || "Risk gate reviewed."
  };
}

function rankFor(asOf, poolId) {
  const rows = candidateRowsFor(asOf).slice().sort((a, b) => b.observation_score - a.observation_score);
  const index = rows.findIndex((row) => row.pool_id === poolId);
  return index >= 0 ? index + 1 : rows.length + 1;
}

function recentTopSessions(asOf, poolId) {
  return recentAsOfs(asOf).reduce((count, date) => {
    const top = candidateRowsFor(date).slice().sort((a, b) => b.observation_score - a.observation_score).slice(0, 5);
    return count + (top.some((row) => row.pool_id === poolId) ? 1 : 0);
  }, 0);
}

function recentAsOfs(asOf) {
  return [asOf, ...[...archives.keys()].filter((date) => date < asOf).sort((a, b) => b.localeCompare(a)).slice(0, 4)];
}

function candidateRowsFor(asOf) {
  if (asOf === ledger.as_of) return (scores.rows ?? []).filter((row) => row.observation_score !== undefined);
  return archives.get(asOf)?.pool_observation_scores?.rows ?? [];
}

function artifactsFor(asOf) {
  if (asOf === ledger.as_of) {
    return {
      pool_market_signals: readCache.pool_market_signals,
      pool_instrument_map: readCache.pool_instrument_map,
      pool_signal_quality: readCache.pool_signal_quality,
      pool_delta_signals: readCache.pool_delta_signals
    };
  }
  return archives.get(asOf) ?? {};
}

function applyStateFields(row, state) {
  return {
    ...row,
    candidate_state: state.candidate_state,
    overheat_score: state.overheat_score,
    major_wave_score: state.major_wave_score,
    risk_gate_status: state.risk_gate_status,
    state_reason: state.state_reason,
    overheat_reason: state.overheat_reason,
    major_wave_reason: state.major_wave_reason,
    risk_gate_reason: state.risk_gate_reason
  };
}

function findRow(file, poolId) {
  return (file?.rows ?? []).find((row) => row.pool_id === poolId) ?? {};
}

function available(status) {
  return ["source_backed", "estimated_from_source", "derived_from_market", "real_provider", "real_provider_derived"].includes(status);
}

function countBy(rows, field) {
  return rows.reduce((counts, row) => {
    counts[row[field]] = (counts[row[field]] ?? 0) + 1;
    return counts;
  }, {});
}

async function readArchives() {
  const result = new Map();
  try {
    const entries = await readdir(historyDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !/^\d{4}-\d{2}-\d{2}\.json$/.test(entry.name)) continue;
      const archive = await readJsonPath(resolve(historyDir, entry.name));
      result.set(archive.as_of, archive);
    }
  } catch {
    // History is optional for first-run classification.
  }
  return result;
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clampRound(value, min, max) {
  return Number(Math.max(min, Math.min(max, value)).toFixed(4));
}

async function readJson(file) {
  return readJsonPath(resolve(dataDir, file));
}

async function readJsonPath(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readJsonOptional(file, fallback) {
  try {
    return await readJson(file);
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await writeFile(resolve(dataDir, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
