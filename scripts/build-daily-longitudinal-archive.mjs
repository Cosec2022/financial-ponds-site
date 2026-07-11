import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { buildDailyLongitudinalSnapshot, contentHash } from "./lib/daily-longitudinal-snapshot.mjs";
import { appendImmutableSnapshot } from "./lib/daily-longitudinal-archive.mjs";

const root = resolve(import.meta.dirname, "..");
const data = (name) => JSON.parse(execFileSync("node", ["-e", `process.stdout.write(require('fs').readFileSync(${JSON.stringify(resolve(root, "financial-pond/data", name))}, 'utf8'))`], { encoding: "utf8" }));
const observation = data("observation_snapshot.json");
const asOf = process.env.AS_OF ?? observation.as_of;
const configHash = contentHash(JSON.parse(await readFile(resolve(root, "tools/financial-pond-framework/config/scoring/v0_1.json"), "utf8")));
let modelCommit = null;
try { modelCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); } catch {}
const snapshot = buildDailyLongitudinalSnapshot({ as_of: asOf, generated_at: process.env.GENERATED_AT ?? new Date().toISOString(), model_version: observation.module_id ?? "unknown", model_commit: modelCommit, config_hash: configHash, observation_snapshot: observation, pool_observation_scores: data("pool_observation_scores.json"), pool_instrument_map: data("pool_instrument_map.json"), pool_market_signals: data("pool_market_signals.json"), pool_flow_signals: data("pool_flow_signals.json"), candidate_state_model: data("candidate_state_model.json"), observation_candidate_ledger: data("observation_candidate_ledger.json"), provider_versions: {}, source_manifest: [], calendar_version: null, benchmark_definition: data("market_signal_report.json").benchmark_proxy ?? null });
const result = await appendImmutableSnapshot({ rootDir: root, snapshot, correctionReason: process.env.CORRECTION_REASON ?? null });
console.log(`${result.created ? "Archived" : "Reused"} longitudinal snapshot ${result.record.snapshot_id}`);
