import { fileURLToPath } from "node:url";
import { parseArgs, requireDate } from "./lib/io.mjs";
import * as stages from "./lib/stages.mjs";

const stage = process.argv[2];
if (!stage || typeof stages[stage] !== "function") throw new Error(`Unknown FP stage: ${stage ?? "missing"}`);
const args = parseArgs(process.argv.slice(3), { mode: null });
const asOf = requireDate(args.as_of ?? process.env.AS_OF);
const result = await stages[stage]({ asOf, mode: args.mode });
console.log(JSON.stringify({ stage, as_of: asOf, result }, null, 2));

export const entrypoint = fileURLToPath(import.meta.url);
