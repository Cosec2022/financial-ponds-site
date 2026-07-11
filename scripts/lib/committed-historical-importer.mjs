import { execFileSync } from "node:child_process";
import { appendImmutableSnapshot } from "./daily-longitudinal-archive.mjs";
import { buildDailyLongitudinalSnapshot } from "./daily-longitudinal-snapshot.mjs";

export function committedArchivePaths({ from, to, listPaths }) {
  return listPaths()
    .filter((file) => /^financial-pond\/data\/history\/observations\/\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .map((path) => ({ path, as_of: path.match(/(\d{4}-\d{2}-\d{2})\.json$/)[1] }))
    .filter((item) => (!from || item.as_of >= from) && (!to || item.as_of <= to))
    .sort((a, b) => a.as_of.localeCompare(b.as_of));
}

export function buildHistoricalImportPlan({ from, to, sourceCommit, listPaths, readBlob, blobId }) {
  const discovered = committedArchivePaths({ from, to, listPaths });
  const items = discovered.map(({ path, as_of }) => {
    const archive = JSON.parse(readBlob(path));
    const incompleteFields = ["pool_observation_scores", "pool_instrument_map", "pool_market_signals", "candidate_state_model", "observation_candidate_ledger"].filter((key) => !archive[key]);
    const warnings = incompleteFields.length ? [`incomplete_historical_import: unavailable_in_source_archive: ${incompleteFields.join(", ")}`] : [];
    const snapshot = buildDailyLongitudinalSnapshot({
      as_of,
      generated_at: archive.generated_at,
      model_version: archive.observation_snapshot?.module_id ?? null,
      model_commit: null,
      config_hash: null,
      observation_snapshot: archive.observation_snapshot,
      pool_observation_scores: archive.pool_observation_scores,
      pool_instrument_map: archive.pool_instrument_map,
      pool_market_signals: archive.pool_market_signals,
      pool_flow_signals: archive.pool_flow_signals,
      candidate_state_model: archive.candidate_state_model,
      observation_candidate_ledger: archive.observation_candidate_ledger,
      source_manifest: [{ path, blob: blobId(path), source_commit: sourceCommit }],
      warnings
    });
    return { as_of, path, archive, snapshot: { ...snapshot, record_origin: "published_at_the_time", provenance: "historical_committed_snapshot", source_model_version: archive.observation_snapshot?.module_id ?? null, source_model_commit: null, source_config_hash: null, import_incomplete: incompleteFields.length > 0, missing_source_fields: incompleteFields }, incomplete: incompleteFields.length > 0 };
  });
  return { source_commit: sourceCommit, discovered_dates: items.map((item) => item.as_of), imported_dates: [], skipped_dates: [], incomplete_dates: items.filter((item) => item.incomplete).map((item) => item.as_of), source_files: items.map((item) => item.path), warnings: items.flatMap((item) => item.snapshot.warnings), items };
}

export async function importCommittedHistoricalSnapshots({ rootDir, from, to, dryRun = false, git = gitReader(rootDir) }) {
  const plan = buildHistoricalImportPlan({ from, to, sourceCommit: git.commit(), listPaths: git.listPaths, readBlob: git.readBlob, blobId: git.blobId });
  if (dryRun) return plan;
  for (const item of plan.items) {
    const result = await appendImmutableSnapshot({ rootDir, snapshot: item.snapshot, correctionReason: "committed_historical_import" });
    (result.created ? plan.imported_dates : plan.skipped_dates).push(item.as_of);
  }
  return plan;
}

function gitReader(rootDir) {
  const run = (...args) => execFileSync("git", args, { cwd: rootDir, encoding: "utf8" }).trim();
  return { commit: () => run("rev-parse", "HEAD"), listPaths: () => run("ls-tree", "-r", "--name-only", "HEAD").split("\n").filter(Boolean), readBlob: (path) => run("show", `HEAD:${path}`), blobId: (path) => run("rev-parse", `HEAD:${path}`) };
}
