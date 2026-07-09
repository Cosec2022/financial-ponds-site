import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "financial-pond", "data");
const historyDir = resolve(dataDir, "history", "observations");
const ledger = await readJson(resolve(dataDir, "observation_candidate_ledger.json"));
const schedule = await readJson(resolve(dataDir, "candidate_review_schedule.json"));
const currentMarket = await readJson(resolve(dataDir, "pool_market_signals.json"));
const currentMapping = await readJson(resolve(dataDir, "pool_instrument_map.json"));
const archives = await readArchives();
const generatedAt = new Date().toISOString();
const currentMarketByPool = new Map((currentMarket.rows ?? []).map((row) => [row.pool_id, row]));
const currentMappingByPool = new Map((currentMapping.rows ?? []).map((row) => [row.pool_id, row]));

const rows = (ledger.rows ?? []).map(buildBasis).sort((a, b) =>
  a.candidate_as_of.localeCompare(b.candidate_as_of) || a.pool_id.localeCompare(b.pool_id)
);
const currentRows = rows.filter((row) => row.candidate_as_of === ledger.as_of);
const availableCount = currentRows.filter((row) => row.baseline_available).length;
const mappedCount = currentRows.filter((row) => !["unmapped", "unavailable"].includes(row.mapping_status)).length;
const nextDue = nextDueReview(schedule);
const report = {
  module_id: "review_readiness_report_v0_10_61",
  as_of: ledger.as_of,
  generated_at: generatedAt,
  candidate_count: currentRows.length,
  next_due_date: nextDue.date,
  next_due_horizon: nextDue.horizon,
  next_due_candidate_count: nextDue.count,
  baseline_available_count: availableCount,
  baseline_missing_count: currentRows.length - availableCount,
  mapped_candidate_count: mappedCount,
  unmapped_candidate_count: currentRows.length - mappedCount,
  expected_reviewable_count: currentRows.filter((row) => row.baseline_available && !["unmapped", "unavailable"].includes(row.mapping_status)).length,
  expected_unavailable_count: currentRows.filter((row) => !row.baseline_available || ["unmapped", "unavailable"].includes(row.mapping_status)).length,
  readiness_state: readinessState(availableCount, currentRows.length),
  missing_basis_examples: currentRows.filter((row) => !row.baseline_available).slice(0, 5).map((row) => ({
    pool_id: row.pool_id,
    pool_name: row.pool_name,
    instrument_code: row.instrument_code,
    reason: row.boundary
  })),
  boundary_notes: [
    "observe_only",
    "Readiness describes price-basis availability only.",
    "A baseline price does not create a future outcome.",
    "Missing close, amount, volume, or turnover values remain null."
  ]
};
const output = {
  module_id: "candidate_price_basis_v0_10_61",
  as_of: ledger.as_of,
  generated_at: generatedAt,
  rows
};

await writeJson(resolve(dataDir, "candidate_price_basis.json"), output);
await writeJson(resolve(dataDir, "review_readiness_report.json"), report);
console.log(`Candidate price basis written: available=${availableCount}, missing=${report.baseline_missing_count}, state=${report.readiness_state}`);

function buildBasis(candidate) {
  const archive = archives.get(candidate.as_of);
  const market = (archive?.pool_market_signals?.rows ?? []).find((row) => row.pool_id === candidate.pool_id)
    ?? (candidate.as_of === currentMarket.as_of ? currentMarketByPool.get(candidate.pool_id) : null);
  const mapping = (archive?.pool_instrument_map?.rows ?? []).find((row) => row.pool_id === candidate.pool_id)
    ?? currentMappingByPool.get(candidate.pool_id)
    ?? {};
  const price = numberOrNull(market?.price_close ?? market?.market_close);
  const available = price !== null && price > 0;
  return {
    candidate_as_of: candidate.as_of,
    pool_id: candidate.pool_id,
    pool_name: candidate.pool_name,
    instrument_code: mapping.instrument_code ?? market?.instrument_code ?? null,
    instrument_name: mapping.instrument_name ?? market?.instrument_name ?? null,
    instrument_type: mapping.instrument_type ?? null,
    mapping_status: mapping.mapping_status ?? market?.mapping_status ?? "unmapped",
    proxy_level: mapping.proxy_level ?? market?.proxy_level ?? "none",
    baseline_as_of: market?.price_date ?? market?.source_date ?? candidate.as_of,
    baseline_price: available ? price : null,
    baseline_price_field: available ? (market?.price_close !== undefined ? "price_close" : "market_close") : null,
    baseline_market_value: numberOrNull(market?.market_value),
    baseline_volume: numberOrNull(market?.volume),
    baseline_amount: numberOrNull(market?.amount),
    baseline_available: available,
    source_file: market?.source_file ?? null,
    source_type: market?.momentum_source_type ?? "source_unavailable",
    candidate_score: candidate.observation_score ?? null,
    candidate_state: candidate.candidate_state ?? null,
    overheat_score: candidate.overheat_score ?? null,
    major_wave_score: candidate.major_wave_score ?? null,
    risk_gate_status: candidate.risk_gate_status ?? null,
    state_reason: candidate.state_reason ?? null,
    overheat_reason: candidate.overheat_reason ?? null,
    major_wave_reason: candidate.major_wave_reason ?? null,
    risk_gate_reason: candidate.risk_gate_reason ?? null,
    boundary: available
      ? "candidate-day mapped instrument close preserved; observe_only"
      : "exact candidate-day close unavailable; baseline not available; observe_only"
  };
}

function nextDueReview(scheduleValue) {
  const fromOutcome = (scheduleValue.next_due_reviews ?? []).slice().sort((a, b) => a.date.localeCompare(b.date))[0];
  if (fromOutcome) return fromOutcome;
  const candidates = Object.entries(scheduleValue.next_review_dates ?? {}).flatMap(([key, dates]) =>
    (dates ?? []).map((date) => ({ date, horizon: key.toUpperCase().replace("T", "T+"), count: scheduleValue.candidate_count ?? 0 }))
  ).sort((a, b) => a.date.localeCompare(b.date));
  return candidates[0] ?? { date: null, horizon: null, count: 0 };
}

function readinessState(available, total) {
  if (total > 0 && available === total) return "ready";
  if (available > 0) return "partially_ready";
  return "not_ready";
}

async function readArchives() {
  const result = new Map();
  const entries = await readdir(historyDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !/^\d{4}-\d{2}-\d{2}\.json$/.test(entry.name)) continue;
    const archive = await readJson(resolve(historyDir, entry.name));
    result.set(archive.as_of, archive);
  }
  return result;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
