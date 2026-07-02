import { mkdir } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile, jsonContent } from "./atomic_write.mjs";

export async function writeRawRecord({ rootDir, asOf, collectorId, sourceId, payload }) {
  const dir = path.join(rootDir, "raw_data", asOf, collectorId);
  await mkdir(dir, { recursive: true });
  const safeSourceId = sourceId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filePath = path.join(dir, `${safeSourceId}.json`);
  await atomicWriteFile(filePath, jsonContent(payload));
  return path.relative(rootDir, filePath);
}
