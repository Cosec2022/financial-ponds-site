import path from "node:path";
import { fileURLToPath } from "node:url";
import { runNewsIntelligence } from "../news/news_intelligence.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function parseArgs(argv) {
  const args = {
    asOf: new Date().toISOString().slice(0, 10),
    fixture: false,
    ci: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--as-of") args.asOf = argv[index + 1];
    if (argv[index] === "--fixture") args.fixture = true;
    if (argv[index] === "--ci") args.ci = true;
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = await runNewsIntelligence({ rootDir, ...args });
  console.log(`News observations written: ${result.observationsPath}`);
  console.log(`News review written: ${result.reviewPath}`);
  console.log(`News matched events: ${result.review.counts.matched_events}`);
  console.log(`News fallback used: ${result.review.collection.fallback_used}`);
}
