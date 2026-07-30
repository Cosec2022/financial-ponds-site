import test from "node:test";
import assert from "node:assert/strict";
import { validatePenetrationDateAlignment } from "../scripts/lib/publication-date-alignment.mjs";

const officialManifest = {
  as_of: "2026-07-29",
  artifacts: { market_penetration: "market_penetration_brief.json" }
};
const legacyPointer = { latest_as_of: "2026-07-28" };

test("official penetration follows the daily manifest, not the legacy observation pointer", () => {
  assert.deepEqual(
    validatePenetrationDateAlignment({
      brief: { schema_version: "market-penetration-v1", as_of: "2026-07-29" },
      manifest: officialManifest,
      observationPointer: legacyPointer
    }),
    { source_of_truth: "daily_manifest", as_of: "2026-07-29" }
  );
});

test("official penetration still fails closed on a mixed manifest date", () => {
  assert.throws(
    () => validatePenetrationDateAlignment({
      brief: { schema_version: "market-penetration-v1", as_of: "2026-07-28" },
      manifest: officialManifest,
      observationPointer: legacyPointer
    }),
    /does not match daily manifest/
  );
});

test("legacy penetration remains aligned to the legacy observation pointer", () => {
  assert.throws(
    () => validatePenetrationDateAlignment({
      brief: { schema_version: "market_penetration_report_v2", as_of: "2026-07-29" },
      manifest: officialManifest,
      observationPointer: legacyPointer
    }),
    /does not match latest observation/
  );
});
