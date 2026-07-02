import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, readJsonFile } from "./core/config_loader.mjs";
import { buildRegistry } from "./core/registry.mjs";
import { validateConfig } from "./core/schema.mjs";
import { buildGraph } from "./core/graph_engine.mjs";
import { calculateScores } from "./core/scoring_engine.mjs";
import { writeSnapshot } from "./storage/snapshot_store.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const asOf = process.argv[2] ?? "2026-07-02";

const config = await loadConfig(rootDir);
const registry = buildRegistry(config);
validateConfig(config, registry);

const mock = await readJsonFile(path.join(rootDir, "config", "mock_scores", `${asOf}.json`));
const graph = buildGraph(config.edges);
const scored = calculateScores({
  registry,
  graph,
  inputScores: mock.scores,
  scoringConfig: config.scoring
});

const snapshotPath = await writeSnapshot({
  rootDir,
  asOf: mock.as_of,
  modelVersion: mock.model_version,
  results: scored.results,
  explanations: scored.explanations
});

console.log(`Snapshot written: ${snapshotPath}`);
for (const id of ["us_equity", "a_share", "btc", "gold", "a_share_semiconductor", "default_user_portfolio"]) {
  console.log(scored.explanations.get(id));
}
