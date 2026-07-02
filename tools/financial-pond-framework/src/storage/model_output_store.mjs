import { mkdir } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile, jsonContent } from "./atomic_write.mjs";

export async function writeModelOutput({ rootDir, asOf, fileName, payload }) {
  const dir = path.join(rootDir, "model_outputs", asOf);
  await mkdir(dir, { recursive: true });

  const filePath = path.join(dir, fileName);
  await atomicWriteFile(filePath, jsonContent(payload));
  return filePath;
}
