import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export async function readJsonFile(filePath) {
  const raw = await readFile(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

export async function readJsonDir(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(dirPath, entry.name))
    .sort();

  const records = [];
  for (const file of files) {
    records.push(await readJsonFile(file));
  }
  return records;
}

export async function loadConfig(rootDir) {
  const configDir = path.join(rootDir, "config");
  const [nodes, pools, assets, portfolios, edgeConfig, scoring] = await Promise.all([
    readJsonDir(path.join(configDir, "nodes")),
    readJsonDir(path.join(configDir, "pools")),
    readJsonDir(path.join(configDir, "assets")),
    readJsonDir(path.join(configDir, "portfolios")),
    readJsonFile(path.join(configDir, "edges", "graph.json")),
    readJsonFile(path.join(configDir, "scoring", "v0_1.json"))
  ]);

  return {
    nodes,
    pools,
    assets,
    portfolios,
    edges: edgeConfig.edges,
    scoring
  };
}
