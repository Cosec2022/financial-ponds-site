import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonFile } from "../core/config_loader.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const catalogPath = path.join(rootDir, "config", "sector_catalog", "a_share_industry_etfs.json");

export async function materializeSectorCatalog({ rootDir, catalogPath }) {
  const catalog = await readJsonFile(catalogPath);

  await Promise.all([
    mkdir(path.join(rootDir, "config", "nodes"), { recursive: true }),
    mkdir(path.join(rootDir, "config", "pools"), { recursive: true }),
    mkdir(path.join(rootDir, "config", "assets"), { recursive: true })
  ]);

  const graphPath = path.join(rootDir, "config", "edges", "graph.json");
  const nodeLayersPath = path.join(rootDir, "config", "model", "node_layers.json");
  const poolModelsPath = path.join(rootDir, "config", "model", "pool_internal_models.json");
  const reportPath = path.join(rootDir, "config", "reporting", "default_entities.json");

  const graph = await readJsonFile(graphPath);
  const nodeLayers = await readJsonFile(nodeLayersPath);
  const poolModels = await readJsonFile(poolModelsPath);
  const report = await readJsonFile(reportPath);

  for (const sector of catalog.sectors) {
    const poolId = poolIdFor(catalog, sector);
    const assetId = assetIdFor(catalog, sector);

    await writeJsonIfChanged(path.join(rootDir, "config", "pools", `${poolId}.json`), {
      id: poolId,
      kind: "pool",
      name: sector.display_name,
      pool_type: "sector",
      region: "CN",
      currency: "CNY",
      parent_pool: catalog.parent_pool,
      description: sector.description,
      scoring_profile: catalog.scoring_profile
    });

    await writeJsonIfChanged(path.join(rootDir, "config", "assets", `${assetId}.json`), {
      id: assetId,
      kind: "asset",
      name: `Demo ${sector.display_name.replace(" Pool", " ETF")}`,
      asset_type: "etf",
      market: "CN",
      currency: "CNY",
      description: `Example ETF asset for ${sector.display_name}. Typical real products include: ${sector.typical_etfs.join(", ")}.`
    });

    upsertEdge(graph.edges, {
      id: `${catalog.parent_pool}_to_${sector.id}`,
      from: catalog.parent_pool,
      to: poolId,
      channel: "parent_market",
      direction: "positive",
      weight: 0.30,
      transform: "identity",
      description: `${sector.display_name} inherits broad A-share liquidity and sentiment through the parent market.`
    });

    for (const template of catalog.node_templates) {
      const nodeId = nodeIdFor(sector, template);
      await writeJsonIfChanged(path.join(rootDir, "config", "nodes", `${nodeId}.json`), {
        id: nodeId,
        kind: "node",
        name: `${sector.name} ${template.name_suffix}`,
        data_type: template.data_type,
        category: template.category,
        frequency: template.frequency,
        description: `${template.description} Sector context: ${sector.description}`,
        source: {
          provider: template.data_type === "news"
            ? "official_media_or_ai_classifier"
            : "market_data_or_vendor",
          status: "planned"
        }
      });

      upsertLayerNode(nodeLayers, template.layer, nodeId);
      upsertEdge(graph.edges, {
        id: `${nodeId}_to_${sector.id}`,
        from: nodeId,
        to: poolId,
        channel: template.channel,
        direction: template.direction,
        weight: template.weight,
        transform: template.transform,
        description: `${template.name_suffix} affects ${sector.display_name}. ${template.description}`
      });
    }

    upsertEdge(graph.edges, {
      id: `${sector.id}_pool_to_${catalog.asset_suffix}`,
      from: poolId,
      to: assetId,
      channel: "pool_exposure",
      direction: "positive",
      weight: 0.85,
      transform: "identity",
      description: `Demo ETF inherits most of its signal from ${sector.display_name}.`
    });

    upsertEdge(graph.edges, {
      id: `${catalog.parent_pool}_pool_to_${sector.id}_${catalog.asset_suffix}`,
      from: catalog.parent_pool,
      to: assetId,
      channel: "market_beta",
      direction: "positive",
      weight: 0.15,
      transform: "identity",
      description: `Demo ETF also has broad A-share market beta.`
    });

    poolModels.pools[poolId] ??= {
      description: `${sector.display_name} uses the standard A-share industry ETF component template.`,
      components: catalog.default_sector_components
    };

    upsertReportEntity(report.entities, poolId);
  }

  graph.edges.sort((a, b) => a.id.localeCompare(b.id));
  for (const layer of Object.values(nodeLayers.layers)) {
    layer.nodes = [...new Set(layer.nodes)].sort();
  }
  report.entities = [...new Set(report.entities)];

  await Promise.all([
    writeJsonIfChanged(graphPath, graph),
    writeJsonIfChanged(nodeLayersPath, nodeLayers),
    writeJsonIfChanged(poolModelsPath, poolModels),
    writeJsonIfChanged(reportPath, report)
  ]);

  return {
    sectors: catalog.sectors.length,
    graph_edges: graph.edges.length
  };
}

function poolIdFor(catalog, sector) {
  return `${catalog.pool_prefix}_${sector.id}`;
}

function assetIdFor(catalog, sector) {
  return `${catalog.pool_prefix}_${sector.id}_${catalog.asset_suffix}`;
}

function nodeIdFor(sector, template) {
  return `${sector.id}_${template.suffix}`;
}

function upsertEdge(edges, edge) {
  const existingIndex = edges.findIndex((item) => item.id === edge.id);
  if (existingIndex >= 0) {
    edges[existingIndex] = { ...edges[existingIndex], ...edge };
    return;
  }
  edges.push(edge);
}

function upsertLayerNode(nodeLayers, layerId, nodeId) {
  const layer = nodeLayers.layers[layerId];
  if (!layer) throw new Error(`Missing node layer ${layerId}`);
  if (!layer.nodes.includes(nodeId)) layer.nodes.push(nodeId);
}

function upsertReportEntity(entities, entityId) {
  if (!entities.includes(entityId)) entities.push(entityId);
}

async function writeJsonIfChanged(filePath, payload) {
  const next = `${JSON.stringify(payload, null, 2)}\n`;
  try {
    const current = await readFile(filePath, "utf8");
    if (current === next) return false;
  } catch {
    // Missing files are expected when materializing new catalog entries.
  }
  await writeFile(filePath, next, "utf8");
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await materializeSectorCatalog({ rootDir, catalogPath });
  console.log(`Materialized ${result.sectors} A-share industry ETF sectors`);
  console.log(`Graph edges: ${result.graph_edges}`);
}
