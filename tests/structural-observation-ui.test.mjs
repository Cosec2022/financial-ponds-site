import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("official ETF guidance surface is readable, medium-term, and fail-closed", async () => {
  const [app, html, css, manifest, decision] = await Promise.all([
    readFile("financial-pond/app.js", "utf8"),
    readFile("financial-pond/index.html", "utf8"),
    readFile("financial-pond/styles.css", "utf8"),
    readFile("financial-pond/data/daily_manifest.json", "utf8").then(JSON.parse),
    readFile("financial-pond/data/entry_decision_daily.json", "utf8").then(JSON.parse)
  ]);
  assert.match(html, /今日 ETF 买入指导/);
  assert.match(html, /进入、等待与回避/);
  assert.match(app, /支持证据/);
  assert.match(app, /反对证据/);
  assert.match(app, /下一确认/);
  assert.match(app, /未来失效条件/);
  assert.match(app, /当前失败闸门/);
  assert.match(app, /重获观察资格/);
  assert.match(app, /重获入场资格/);
  assert.match(html, /10–20 个交易会话/);
  assert.match(app, /今日指导不可用/);
  assert.match(app, /页面拒绝显示旧结论/);
  assert.match(app, /当前没有满足条件的 ETF 买入候选/);
  assert.match(css, /\.guidance-card/);
  assert.match(css, /@media \(max-width: 780px\)/);
  assert.equal(manifest.status, "validated");
  assert.equal(decision.boundary.automated_execution, false);
  assert.equal(decision.rows.some((row) => "rank" in row || "observation_score" in row), false);
  assert.equal(decision.no_qualified_candidate, decision.primary_entry_candidate === null && decision.secondary_entry_candidate === null);
});

test("formal rows provide non-empty decision explanations", async () => {
  const decision = JSON.parse(await readFile("financial-pond/data/entry_decision_daily.json", "utf8"));
  for (const row of decision.rows) {
    assert.ok(row.thesis);
    if (row.explanation_mode === "failure_recovery") {
      assert.ok(row.current_failure_reason);
      for (const key of ["current_failed_gates", "watch_eligibility_requirements", "entry_eligibility_requirements"]) {
        assert.ok(Array.isArray(row[key]) && row[key].length > 0, `${row.pool_id} ${key}`);
      }
      assert.deepEqual(row.next_confirmation, []);
      assert.deepEqual(row.invalidation, []);
    } else {
      for (const key of ["supporting_evidence", "contrary_evidence", "next_confirmation", "invalidation"]) {
        assert.ok(Array.isArray(row[key]) && row[key].length > 0, `${row.pool_id} ${key}`);
      }
    }
    assert.ok(row.guidance_as_of);
    assert.ok(row.valid_until);
    assert.ok(row.review_due);
    assert.ok(row.model_version);
    assert.ok(row.input_snapshot_id);
  }
});
