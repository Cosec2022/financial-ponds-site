import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Financial Ponds workflow uses CI daily runner with water-level fallback", async () => {
  const [workflow, frameworkPackage] = await Promise.all([
    readFile(".github/workflows/daily.yml", "utf8"),
    readFile("tools/financial-pond-framework/package.json", "utf8")
  ]);
  const scripts = JSON.parse(frameworkPackage).scripts;

  assert.equal(
    scripts["a-share:daily:ci"],
    "node src/tools/a_share_daily_ci.mjs"
  );
  assert.match(workflow, /npm run a-share:daily:ci -- --as-of "\$AS_OF"/);
  assert.doesNotMatch(workflow, /npm run a-share:daily\s*$/m);
});
