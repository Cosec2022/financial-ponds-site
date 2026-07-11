import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const [command, ...args] = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1] ?? null;
const json = async (file) => JSON.parse(await readFile(file, "utf8"));
if (command === "coverage") console.log(JSON.stringify(await json(resolve(root, "financial-pond/data/longitudinal_coverage_report.json")), null, 2));
else if (command === "inspect") { const date = option("--date"); const index = await json(resolve(root, "financial-pond/data/history/daily/index.json")); const record = index.current_by_date?.[date]; if (!record) throw new Error(`No immutable snapshot for ${date}`); console.log(JSON.stringify(await json(resolve(root, record.path)), null, 2)); }
else if (command === "compare") { const date = option("--date"); const versions = option("--versions")?.split(",") ?? []; const index = await json(resolve(root, "financial-pond/data/history/daily/index.json")); const matches = index.records.filter((record) => record.as_of === date && (!versions.length || versions.includes(record.model_version))); console.log(JSON.stringify(matches, null, 2)); }
else throw new Error("Usage: history-cli.mjs <inspect|coverage|compare> [--date YYYY-MM-DD] [--versions a,b]");
