import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildSectorBreadth } from "./lib/sector-breadth.mjs";

const root = resolve(import.meta.dirname, "..");
const asOf = process.env.AS_OF ?? readArg("--as-of") ?? "2026-07-28";
const source = resolve(root, "tools/financial-pond-framework/data/provider_exports/sector_constituent_daily.json");
let input = null;
try {
  input = JSON.parse(await readFile(source, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const result = buildSectorBreadth({ asOf, input });
await writeFile(
  resolve(root, "financial-pond/data/sector_breadth_daily.json"),
  `${JSON.stringify(result, null, 2)}\n`
);
console.log(JSON.stringify(result, null, 2));

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
