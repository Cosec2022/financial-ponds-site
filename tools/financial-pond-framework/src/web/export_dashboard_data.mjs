import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile } from "node:fs/promises";
import { loadConfig, readJsonFile } from "../core/config_loader.mjs";
import { buildRegistry } from "../core/registry.mjs";
import { validateConfig } from "../core/schema.mjs";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const asOf = process.argv[2] ?? "2026-07-02";

async function readJsonIfExists(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export async function exportDashboardData({ rootDir, asOf }) {
  const config = await loadConfig(rootDir);
  const registry = buildRegistry(config);
  validateConfig(config, registry);

  const snapshot = await readJsonFile(path.join(rootDir, "snapshots", asOf, "graph_scores.json"));
  const observationsPayload = await readJsonIfExists(
    path.join(rootDir, "observations", asOf, "node_observations.json"),
    { observations: [] }
  );

  const resultById = new Map(snapshot.results.map((result) => [result.id, result]));
  const entities = {};

  for (const entity of registry.entities.values()) {
    const result = resultById.get(entity.id);
    entities[entity.id] = {
      ...entity,
      score: result?.score ?? null,
      confidence: result?.confidence ?? 0,
      contributors: result?.contributors ?? [],
      explanation: snapshot.explanations?.[entity.id] ?? null
    };
  }

  const groups = {
    nodes: [...registry.nodes.keys()],
    pools: [...registry.pools.keys()],
    assets: [...registry.assets.keys()],
    portfolios: [...registry.portfolios.keys()]
  };

  const poolChildren = {};
  for (const pool of registry.pools.values()) {
    if (!pool.parent_pool) continue;
    if (!poolChildren[pool.parent_pool]) poolChildren[pool.parent_pool] = [];
    poolChildren[pool.parent_pool].push(pool.id);
  }

  const dashboard = {
    as_of: asOf,
    model_version: snapshot.model_version,
    generated_at: new Date().toISOString(),
    entities,
    edges: config.edges,
    groups,
    pool_children: poolChildren,
    observations: observationsPayload.observations ?? []
  };

  const outDir = path.join(rootDir, "web", "data");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "dashboard.json");
  await atomicWriteFile(outPath, jsonContent(dashboard));
  return outPath;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outPath = await exportDashboardData({ rootDir, asOf });
  console.log(`Dashboard data written: ${outPath}`);
}
