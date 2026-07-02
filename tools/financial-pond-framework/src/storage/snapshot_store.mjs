import { mkdir } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile, jsonContent } from "./atomic_write.mjs";

export async function writeSnapshot({ rootDir, asOf, modelVersion, results, explanations }) {
  const dir = path.join(rootDir, "snapshots", asOf);
  await mkdir(dir, { recursive: true });

  const payload = {
    as_of: asOf,
    model_version: modelVersion,
    generated_at: new Date().toISOString(),
    results: [...results.values()],
    explanations: Object.fromEntries(explanations)
  };

  const filePath = path.join(dir, "graph_scores.json");
  await atomicWriteFile(filePath, jsonContent(payload));
  return filePath;
}
