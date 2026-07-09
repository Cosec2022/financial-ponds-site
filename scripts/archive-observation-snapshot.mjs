import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "financial-pond", "data");
const historyDir = resolve(dataDir, "history", "observations");

const observation = await readJson(resolve(dataDir, "observation_snapshot.json"));
const coverage = await readJson(resolve(dataDir, "data_coverage_report.json"));
const flowChannel = await readJson(resolve(dataDir, "flow_channel_report.json"));
const poolFlowSignals = await readJson(resolve(dataDir, "pool_flow_signals.json"));
const marketSignalReport = await readJson(resolve(dataDir, "market_signal_report.json"));
const poolMarketSignals = await readJson(resolve(dataDir, "pool_market_signals.json"));
const poolInstrumentMap = await readJson(resolve(dataDir, "pool_instrument_map.json"));
const poolMappingReport = await readJson(resolve(dataDir, "pool_mapping_report.json"));
const signalQualityReport = await readJson(resolve(dataDir, "signal_quality_report.json"));
const poolSignalQuality = await readJson(resolve(dataDir, "pool_signal_quality.json"));
const eveningObservationSummary = await readJsonOptional(resolve(dataDir, "evening_observation_summary.json"));
const poolObservationScores = await readJsonOptional(resolve(dataDir, "pool_observation_scores.json"));
const eveningReport = await readTextOptional(resolve(dataDir, "evening_report.md"));
const observationCandidateLedger = await readJsonOptional(resolve(dataDir, "observation_candidate_ledger.json"));
const scoreCalibrationReport = await readJsonOptional(resolve(dataDir, "score_calibration_report.json"));
const candidateReviewSchedule = await readJsonOptional(resolve(dataDir, "candidate_review_schedule.json"));
const candidateOutcomeReviews = await readJsonOptional(resolve(dataDir, "candidate_outcome_reviews.json"));
const outcomeReviewReport = await readJsonOptional(resolve(dataDir, "outcome_review_report.json"));
const asOf = observation.as_of ?? coverage.as_of ?? flowChannel.as_of;
if (!asOf) throw new Error("Cannot archive observation snapshot without as_of");

await mkdir(historyDir, { recursive: true });

const archive = {
  module_id: "observation_archive_v0_10_59",
  as_of: asOf,
  generated_at: new Date().toISOString(),
  observation_snapshot: observation,
  data_coverage_report: coverage,
  flow_channel_report: flowChannel,
  pool_flow_signals: poolFlowSignals,
  market_signal_report: marketSignalReport,
  pool_market_signals: poolMarketSignals,
  pool_instrument_map: poolInstrumentMap,
  pool_mapping_report: poolMappingReport,
  signal_quality_report: signalQualityReport,
  pool_signal_quality: poolSignalQuality,
  evening_observation_summary: eveningObservationSummary,
  pool_observation_scores: poolObservationScores,
  evening_report: eveningReport,
  observation_candidate_ledger: observationCandidateLedger,
  score_calibration_report: scoreCalibrationReport,
  candidate_review_schedule: candidateReviewSchedule,
  candidate_outcome_reviews: candidateOutcomeReviews,
  outcome_review_report: outcomeReviewReport,
  source_files_used: sourceFilesUsed(flowChannel, poolFlowSignals, marketSignalReport, poolMarketSignals),
  boundary_notes: [
    "Daily archive is observation-only and keeps the observe_only boundary.",
    "Flow values use source-backed estimates only where provider-backed rows are mapped.",
    "Missing and unavailable source states are preserved; no source-backed data is fabricated."
  ]
};

const archivePath = resolve(historyDir, `${asOf}.json`);
await writeFile(archivePath, `${JSON.stringify(archive, null, 2)}\n`, "utf8");

const available = await availableArchives();
const latestIndex = available.findIndex((item) => item.as_of === asOf);
const previous = latestIndex > 0 ? available[latestIndex - 1] : null;
const pointer = {
  module_id: "latest_observation_pointer_v0_10_59",
  latest_as_of: asOf,
  latest_path: `financial-pond/data/history/observations/${asOf}.json`,
  previous_as_of: previous?.as_of ?? null,
  previous_path: previous?.path ?? null,
  available_snapshot_count: available.length
};

await writeFile(resolve(dataDir, "history", "latest_observation_pointer.json"), `${JSON.stringify(pointer, null, 2)}\n`, "utf8");
console.log(`Archived observation snapshot: ${pointer.latest_path}`);

async function availableArchives() {
  const entries = await readdir(historyDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /^\d{4}-\d{2}-\d{2}\.json$/.test(entry.name))
    .map((entry) => {
      const as_of = basename(entry.name, ".json");
      return { as_of, path: `financial-pond/data/history/observations/${entry.name}` };
    })
    .sort((a, b) => a.as_of.localeCompare(b.as_of));
}

function sourceFilesUsed(...reports) {
  return [...new Set(reports.flatMap((report) => Array.isArray(report?.source_files_used) ? report.source_files_used : []))];
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readJsonOptional(path) {
  try {
    return await readJson(path);
  } catch {
    return null;
  }
}

async function readTextOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}
