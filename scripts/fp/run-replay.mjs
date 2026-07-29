import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { inputDir, parseArgs, requireDate, stableHash, substantive, workDir, readJson } from "./lib/io.mjs";
import { publish } from "./lib/stages.mjs";

const args = parseArgs(process.argv.slice(2));
const asOf = requireDate(args.as_of ?? process.env.AS_OF);
await access(resolve(inputDir(asOf), "manifest.json")).catch(() => {
  throw new Error(`Archived input snapshot missing for ${asOf}`);
});
const previous = await readJson(resolve(workDir(asOf), "entry_decision_daily.json")).catch(() => null);
const previousArgv = process.argv;
process.argv = [process.execPath, "run-model.mjs", "--as-of", asOf];
await import(`./run-model.mjs?replay=${Date.now()}`);
process.argv = previousArgv;
const replayed = await readJson(resolve(workDir(asOf), "entry_decision_daily.json"));
if (previous && stableHash(substantive(previous)) !== stableHash(substantive(replayed))) {
  throw new Error("Replay substantive decision differs from prior model output");
}
if (args.publish) await publish({ asOf });
console.log(JSON.stringify({ command: "fp:replay", as_of: asOf, substantive_match: previous ? true : "baseline_created" }, null, 2));
