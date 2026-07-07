import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { cp, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { jsonContent } from "../src/storage/atomic_write.mjs";
import { runSectorFlowReview } from "../src/tools/sector_flow_review.mjs";
import { runSectorModuleReview } from "../src/tools/sector_module_review.mjs";
import { runEtfDecisionReadiness } from "../src/tools/etf_decision_readiness.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("ETF decision readiness blocks guidance when flow data is mock-only", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-etf-readiness-"));
  await cp(path.join(rootDir, "config"), path.join(outputRoot, "config"), { recursive: true });

  await runSectorFlowReview({
    rootDir: outputRoot,
    asOf: "2026-07-08",
    fixture: true
  });
  await runSectorModuleReview({
    rootDir: outputRoot,
    asOf: "2026-07-08"
  });
  const result = await runEtfDecisionReadiness({
    rootDir: outputRoot,
    asOf: "2026-07-08"
  });

  assert.equal(result.payload.module_id, "etf_decision_readiness_v0_2");
  assert.equal(result.payload.guidance_state, "not_ready");
  assert.equal(result.payload.progress.total_milestones, 5);
  assert.ok(result.payload.progress.sleep_note);
  assert.ok(result.payload.blockers.find((item) => item.id === "non_real_flow_source"));
  assert.match(result.payload.blockers.find((item) => item.id === "provider_run_missing").reading, /真实 provider/);
  assert.ok(result.payload.counts.blocked_non_real_source >= 1);
  assert.ok(result.payload.top_watchlist.length >= 1);
  assert.ok(result.payload.top_watchlist.every((row) => row.action.label === "blocked_non_real_source"));
  assert.ok(result.payload.interpretation_boundary.some((item) => item.includes("gatekeeper")));
});

test("ETF decision readiness distinguishes baseline provider data from buyable flow", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-etf-baseline-"));
  await cp(path.join(rootDir, "config"), path.join(outputRoot, "config"), { recursive: true });
  const outDir = path.join(outputRoot, "model_outputs", "2026-07-08");
  await mkdir(outDir, { recursive: true });
  await cp(path.join(rootDir, "model_outputs", "2026-07-02", "sector_flow_review.json"), path.join(outputRoot, "model_outputs", "2026-07-08", "sector_flow_review.json"), { recursive: true });
  const flowPath = path.join(outDir, "sector_flow_review.json");
  const flowReview = JSON.parse(await readFile(flowPath, "utf8"));
  flowReview.as_of = "2026-07-08";
  flowReview.data_availability.source_reality = "provider_observed";
  flowReview.data_availability.mode = "price_volume_only";
  flowReview.data_availability.market_use_confidence = "medium";
  flowReview.data_availability.counts.representative_observed_direct_flow_inputs = 0;
  flowReview.data_availability.counts.representative_observed_price_volume_confirmations = 11;
  await writeFile(flowPath, jsonContent(flowReview));
  await runSectorModuleReview({
    rootDir: outputRoot,
    asOf: "2026-07-08"
  });

  await mkdir(path.join(outputRoot, "model_outputs", "provider_runs"), { recursive: true });
  await writeFile(path.join(outDir, "akshare_provider_flow_observations.json"), jsonContent({
    as_of: "2026-07-08",
    readiness: { status: "baseline_only" },
    counts: {
      source_rows: 11,
      flow_ready_rows: 0
    },
    share_change_diagnostics: {
      status: "baseline_only",
      total_rows: 11,
      latest_share_rows: 11,
      previous_share_rows: 0,
      share_change_rows: 0,
      estimated_flow_rows: 0,
      coverage: {
        latest_share: 1,
        previous_share: 0,
        share_change: 0,
        estimated_flow: 0
      },
      missing: [
        {
          sector_id: "brokerage",
          fund_code: "512000",
          fund_name: "Brokerage ETF candidate",
          missing_fields: ["previous_share", "share_change", "estimated_flow"]
        }
      ],
      next_unlock: "还差 11/11 只代表 ETF 的份额变化流。"
    }
  }));
  await writeFile(path.join(outputRoot, "model_outputs", "provider_runs", "akshare_etf_bridge_2026-07-08.json"), jsonContent({
    mode: "real",
    status: "ok",
    as_of: "2026-07-08",
    records: 11
  }));

  const result = await runEtfDecisionReadiness({
    rootDir: outputRoot,
    asOf: "2026-07-08"
  });

  assert.equal(result.payload.guidance_state, "not_ready");
  assert.ok(result.payload.progress.milestones.find((item) => item.id === "provider_environment" && item.status === "done"));
  assert.ok(result.payload.progress.milestones.find((item) => item.id === "baseline_snapshot" && item.status === "done"));
  assert.ok(result.payload.progress.next_unlock);
  assert.ok(result.payload.blockers.find((item) => item.id === "baseline_only"));
  assert.equal(result.payload.gates.share_change_diagnostics.total_rows, 11);
  assert.equal(result.payload.gates.share_change_diagnostics.previous_share_rows, 0);
  assert.match(result.payload.progress.milestones.find((item) => item.id === "share_change_flow").reading, /previous_share/);
  assert.ok(result.payload.sectors.some((row) => row.action.label === "wait_for_real_flow"));
});
