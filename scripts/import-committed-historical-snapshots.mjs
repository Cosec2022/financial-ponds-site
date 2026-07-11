import { resolve } from "node:path";
import { importCommittedHistoricalSnapshots } from "./lib/committed-historical-importer.mjs";

const option = (name) => process.argv.slice(2)[process.argv.slice(2).indexOf(name) + 1] ?? null;
const result = await importCommittedHistoricalSnapshots({ rootDir: resolve(import.meta.dirname, ".."), from: option("--from"), to: option("--to"), dryRun: process.argv.includes("--dry-run") });
console.log(JSON.stringify({ ...result, items: result.items.map(({ archive, snapshot, ...item }) => ({ ...item, row_count: snapshot.row_count })) }, null, 2));
