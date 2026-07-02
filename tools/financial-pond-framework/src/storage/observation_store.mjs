import { mkdir } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile, jsonContent } from "./atomic_write.mjs";

export async function writeObservations({ rootDir, asOf, observations }) {
  const dir = path.join(rootDir, "observations", asOf);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, "node_observations.json");
  await atomicWriteFile(filePath, jsonContent({ as_of: asOf, observations }));
  return filePath;
}
