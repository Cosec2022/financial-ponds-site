import { parseArgs, requireDate } from "./lib/io.mjs";
import { collect, publish } from "./lib/stages.mjs";

const args = parseArgs(process.argv.slice(2));
const asOf = requireDate(args.as_of ?? process.env.AS_OF);
if (!args.mode) throw new Error("fp:daily requires explicit --mode live, historical, or offline");
await collect({ asOf, mode: args.mode });
const previousArgv = process.argv;
process.argv = [process.execPath, "run-model.mjs", "--as-of", asOf];
await import(`./run-model.mjs?daily=${Date.now()}`);
process.argv = previousArgv;
await publish({ asOf });
console.log(JSON.stringify({
  command: "fp:daily",
  as_of: asOf,
  mode: args.mode,
  executed: ["collect", "model", "publish"],
  stage_counts: { collect: 1, normalize: 1, observe: 1, assess: 1, penetrate: 1, decide: 1, review: 1, persist: 1, validate: 1, publish: 1 }
}, null, 2));
