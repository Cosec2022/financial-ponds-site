import { parseArgs, requireDate } from "./lib/io.mjs";
import { assess, decide, normalize, observe, penetrate, persist, review, validate } from "./lib/stages.mjs";

const args = parseArgs(process.argv.slice(2));
const asOf = requireDate(args.as_of ?? process.env.AS_OF);
const executed = [];
for (const [name, stage] of [
  ["normalize", normalize],
  ["observe", observe],
  ["assess", assess],
  ["penetrate", penetrate],
  ["decide", decide],
  ["review", review],
  ["persist", persist],
  ["validate", validate]
]) {
  await stage({ asOf });
  executed.push(name);
}
console.log(JSON.stringify({ command: "fp:model", as_of: asOf, executed }, null, 2));
