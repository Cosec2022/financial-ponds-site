import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonFile } from "../core/config_loader.mjs";
import { buildCollectorsFromConfig } from "./collector_factory.mjs";
import { runDaily } from "./run_daily.mjs";
import { buildLayerSummary } from "../model/layer_summary.mjs";
import { evaluateRegimes } from "../model/regime_engine.mjs";
import { writeModelOutput } from "../storage/model_output_store.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const asOf = process.argv[2] ?? new Date().toISOString().slice(0, 10);

export async function runCollectionCycle({ rootDir, asOf }) {
  const collectors = await buildCollectorsFromConfig(rootDir);
  const result = await runDaily({ rootDir, asOf, collectors });
  const nodeLayers = await readJsonFile(path.join(rootDir, "config", "model", "node_layers.json"));
  const regimeRules = await readJsonFile(path.join(rootDir, "config", "model", "regime_rules.json"));
  const layerSummary = buildLayerSummary({
    observations: result.observations,
    nodeLayers
  });
  const regimeSummary = evaluateRegimes({
    observations: result.observations,
    rules: regimeRules
  });
  const regimePath = await writeModelOutput({
    rootDir,
    asOf,
    fileName: "regime_summary.json",
    payload: {
      as_of: asOf,
      generated_at: new Date().toISOString(),
      model: regimeRules.id,
      ...regimeSummary
    }
  });

  return {
    ...result,
    layerSummary,
    regimeSummary,
    regimePath
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runCollectionCycle({ rootDir, asOf });
  console.log(`Cycle complete for ${asOf}`);
  console.log(`Observations: ${result.observations.length}`);
  console.log(`Observation file: ${result.observationPath}`);
  console.log(`Snapshot file: ${result.snapshotPath}`);
  console.log(`Report file: ${result.reportPath}`);
  console.log(`Dashboard file: ${result.dashboardPath}`);
  console.log(`Layer summary: ${JSON.stringify(result.layerSummary)}`);
  console.log(`Regime file: ${result.regimePath}`);
  console.log(`Regime summary: ${JSON.stringify(result.regimeSummary)}`);
}
