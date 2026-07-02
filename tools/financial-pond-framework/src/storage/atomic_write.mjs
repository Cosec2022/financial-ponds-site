import { rename, writeFile } from "node:fs/promises";
import path from "node:path";

export async function atomicWriteFile(filePath, content) {
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
  );
  await writeFile(tempPath, content, "utf8");
  await rename(tempPath, filePath);
}

export function jsonContent(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}
