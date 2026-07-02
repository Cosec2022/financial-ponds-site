import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, readJsonFile } from "../core/config_loader.mjs";
import { buildRegistry } from "../core/registry.mjs";
import { validateConfig } from "../core/schema.mjs";
import { buildGraph } from "../core/graph_engine.mjs";
import { calculateScores } from "../core/scoring_engine.mjs";
import { validateObservation, observationsToScoreMap } from "../contracts/observation_schema.mjs";
import { MockObservationCollector } from "../collectors/mock/mock_observation_collector.mjs";
import { NoopAiAnalyzer } from "../ai_analysis/noop_ai_analyzer.mjs";
import { generateMarkdownReport } from "../reporting/markdown_report_generator.mjs";
import { writeObservations } from "../storage/observation_store.mjs";
import { writeSnapshot } from "../storage/snapshot_store.mjs";
import { writeReport } from "../storage/report_store.mjs";
import { exportDashboardData } from "../web/export_dashboard_data.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const asOf = process.argv[2] ?? "2026-07-02";

export async function runDaily({ rootDir, asOf, collectors, aiAnalyzer }) {
  const config = await loadConfig(rootDir);
  const reportEntities = await readJsonFile(path.join(rootDir, "config", "reporting", "default_entities.json"));
  const registry = buildRegistry(config);
  validateConfig(config, registry);

  const activeCollectors = collectors ?? [new MockObservationCollector(rootDir)];
  const observations = [];
  for (const collector of activeCollectors) {
    const collected = await collector.collect({ asOf, registry, config });
    observations.push(...collected);
  }

  for (const observation of observations) {
    validateObservation(observation, registry);
  }

  const observationPath = await writeObservations({ rootDir, asOf, observations });
  const nodeScores = observationsToScoreMap(observations);
  const graph = buildGraph(config.edges);
  const scoredGraph = calculateScores({
    registry,
    graph,
    inputScores: nodeScores,
    scoringConfig: config.scoring
  });

  const snapshotPath = await writeSnapshot({
    rootDir,
    asOf,
    modelVersion: config.scoring.model_version,
    results: scoredGraph.results,
    explanations: scoredGraph.explanations
  });

  const analyzer = aiAnalyzer ?? new NoopAiAnalyzer();
  const aiAnalysis = await analyzer.analyze({ asOf, observations, scoredGraph });
  const report = generateMarkdownReport({
    asOf,
    observations,
    scoredGraph,
    aiAnalysis,
    entityIds: reportEntities.entities
  });
  const reportPath = await writeReport({ rootDir, asOf, report });
  const dashboardPath = await exportDashboardData({ rootDir, asOf });

  return {
    observationPath,
    snapshotPath,
    reportPath,
    dashboardPath,
    observations,
    scoredGraph,
    aiAnalysis
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runDaily({ rootDir, asOf });
  console.log(`Observations written: ${result.observationPath}`);
  console.log(`Snapshot written: ${result.snapshotPath}`);
  console.log(`Report written: ${result.reportPath}`);
  console.log(`Dashboard data written: ${result.dashboardPath}`);
}
