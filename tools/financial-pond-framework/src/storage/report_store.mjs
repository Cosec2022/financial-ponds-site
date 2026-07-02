import { mkdir } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile } from "./atomic_write.mjs";

export async function writeReport({ rootDir, asOf, report }) {
  const dir = path.join(rootDir, "reports", asOf);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, "daily_report.md");
  await atomicWriteFile(filePath, report);
  return filePath;
}
