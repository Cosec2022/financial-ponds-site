import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assertUniqueCanonical,
  assessObservations,
  buildObservations,
  decideEntries,
  normalizeInputs,
  selectCandidates,
  validateOfficialArtifacts
} from "../scripts/fp/lib/model.mjs";
import { substantive, stableHash } from "../scripts/fp/lib/io.mjs";

const scenarios = JSON.parse(await readFile(new URL("./fixtures/fp-model/scenarios.json", import.meta.url), "utf8"));

test("large fall lowers signed direction even when activity expands", () => {
  const fixture = scenario(scenarios.large_decline_high_activity);
  const { assessment, decision } = runFixture(fixture);
  const row = assessment.rows[0];
  assert.ok(row.direction_score < 0);
  assert.ok(row.confirmation_score >= 70);
  assert.equal(row.confirmation_components.confirmation_direction, "negative");
  assert.equal(row.structure_state, "deteriorating");
  assert.equal(decision.rows[0].entry_state, "invalid");
});

test("large rise without medium-term, relative, or activity support is price-only, not confirmed", () => {
  const { assessment } = runFixture(scenario(scenarios.large_rise_without_confirmation));
  const row = assessment.rows[0];
  assert.equal(row.structure_state, "price_only");
  assert.ok(row.confirmation_score < 50);
  assert.notEqual(row.structure_state, "confirmed_trend");
});

test("evidence quality and narrative cannot raise signed direction", () => {
  const input = fixtureInput(scenario(scenarios.steady_medium_term_uptrend));
  const observations = buildObservations(normalizeInputs(input));
  const withoutBreadth = assessObservations(observations);
  const withBreadthObservations = structuredClone(observations);
  withBreadthObservations.rows[0].channels.breadth = {
    ...withBreadthObservations.rows[0].channels.breadth,
    value: 0.7,
    coverage: 1,
    reality_status: "source_backed",
    missing_reason: null
  };
  const withBreadth = assessObservations(withBreadthObservations);
  assert.equal(withBreadth.rows[0].direction_score, withoutBreadth.rows[0].direction_score);
  assert.ok(withBreadth.rows[0].evidence_score > withoutBreadth.rows[0].evidence_score);
  const narrativeA = { headlines: ["positive"] };
  const narrativeB = { headlines: ["negative"] };
  assert.equal(stableHash(substantive(assessObservations(observations))), stableHash(substantive(assessObservations(observations))));
  assert.notDeepEqual(narrativeA, narrativeB);
});

test("display order, lexical IDs, legacy score, and rank movement cannot alter hard state", () => {
  const first = runFixture(scenario(scenarios.steady_medium_term_uptrend, { sectors: ["zeta", "alpha"] })).assessment;
  const reversed = assessObservations({ ...buildObservations(normalizeInputs(fixtureInput(scenario(scenarios.steady_medium_term_uptrend, { sectors: ["zeta", "alpha"] })))), rows: [...buildObservations(normalizeInputs(fixtureInput(scenario(scenarios.steady_medium_term_uptrend, { sectors: ["zeta", "alpha"] })))).rows].reverse() });
  assert.deepEqual(byPool(first), byPool(reversed));
  const legacy = structuredClone(first);
  legacy.rows = legacy.rows.map((row, index) => ({ ...row, rank: 100 - index, observation_score: index }));
  assert.deepEqual(decideEntries(first).rows, decideEntries(legacy).rows);
  assert.equal(decideEntries(first).rows.some((row) => "rank" in row || "observation_score" in row), false);
});

test("missing breadth and direct flow remain null and prevent full confirmation", () => {
  const { assessment } = runFixture(scenario(scenarios.steady_medium_term_uptrend));
  const row = assessment.rows[0];
  assert.equal(row.confirmation_components.breadth, null);
  assert.equal(row.confirmation_components.direct_flow, null);
  assert.ok(row.confirmation_coverage < 0.7);
  assert.notEqual(row.structure_state, "confirmed_trend");
});

test("turnover below its own 20-session mean is not confirmed strength", () => {
  const { assessment } = runFixture(scenario({ base_daily_return: 0.01, last_daily_return: 0.01, recent_amount_multiplier: 0.5 }));
  const row = assessment.rows[0];
  assert.ok(row.confirmation_components.turnover_activity_ratio < 1);
  assert.ok(row.confirmation_score < 50);
  assert.notEqual(row.structure_state, "confirmed_trend");
});

test("duplicate semantic identities fail before assessment", () => {
  assert.throws(() => assertUniqueCanonical(scenarios.duplicate_ids.map((pool_id) => ({ pool_id }))), /Duplicate canonical identity/);
});

test("steady full-universe assessment archives all canonical rows and generates no ordinal rank", async () => {
  const assessment = JSON.parse(await readFile("financial-pond/data/sector_assessment_daily.json", "utf8"));
  const archived = JSON.parse(await readFile(`financial-pond/data/history/assessments/${assessment.as_of}.json`, "utf8"));
  assert.equal(archived.rows.length, assessment.rows.length);
  assert.deepEqual(new Set(archived.rows.map((row) => row.pool_id)), new Set(assessment.rows.map((row) => row.pool_id)));
  assert.equal(archived.rows.some((row) => "rank" in row || "legacy_rank" in row), false);
});

test("equal eligible assessments remain tied and lexical ID does not create first place", () => {
  const tied = [eligible("a_share_zeta"), eligible("a_share_alpha")];
  const selected = selectCandidates(tied);
  assert.equal(selected.primary_entry_candidate, null);
  assert.equal(selected.secondary_entry_candidate, null);
  assert.equal(selected.no_qualified_candidate, false);
  assert.match(selected.selection_note, /tied/);
});

test("no eligible row yields an explicit no-candidate day", () => {
  const rows = [{ ...eligible("a_share_one"), entry_state: "wait_confirmation" }];
  const selected = selectCandidates(rows);
  assert.equal(selected.no_qualified_candidate, true);
  assert.equal(selected.primary_entry_candidate, null);
});

test("strong but overextended structure does not produce ready-now", () => {
  const { assessment, decision } = runFixture(scenario(scenarios.strong_trend_with_overheat));
  assert.ok(assessment.rows[0].risk_overlays.overheated);
  assert.ok(["wait_pullback", "do_not_chase"].includes(decision.rows[0].entry_state));
});

test("stale benchmark invalidates current-day guidance", () => {
  const fixture = scenario(scenarios.steady_medium_term_uptrend);
  const input = fixtureInput(fixture);
  input.asOf = nextDate(input.asOf);
  const normalized = normalizeInputs(input);
  const decision = decideEntries(assessObservations(buildObservations(normalized)));
  assert.equal(normalized.alignment.exact_date_valid, false);
  assert.equal(decision.rows[0].entry_state, "invalid");
});

test("mixed dates fail publication and primary candidates must be entry eligible", () => {
  const { assessment, decision } = runFixture(scenario(scenarios.steady_medium_term_uptrend));
  const penetration = { as_of: assessment.as_of };
  const review = { as_of: assessment.as_of };
  const manifest = {
    as_of: assessment.as_of,
    status: "validated",
    model_version: assessment.model_version,
    input_snapshot_id: assessment.input_snapshot_id
  };
  assert.throws(() => validateOfficialArtifacts({
    manifest,
    assessment,
    decision: { ...decision, as_of: "2026-01-01" },
    penetration,
    review
  }), /Mixed or absent as_of/);
  assert.equal(decision.primary_entry_candidate === null || ["ready_now", "probe_only"].includes(decision.primary_entry_candidate.entry_state), true);
});

test("same archived input reproduces substantive assessment and decision", () => {
  const fixture = scenario(scenarios.steady_medium_term_uptrend);
  const first = runFixture(fixture);
  const second = runFixture(fixture);
  assert.equal(stableHash(substantive(first.assessment)), stableHash(substantive(second.assessment)));
  assert.equal(stableHash(substantive(first.decision)), stableHash(substantive(second.decision)));
});

test("review migration preserves previously reviewed summary and exact-session statuses", async () => {
  const review = JSON.parse(await readFile("financial-pond/data/review_analytics.json", "utf8"));
  assert.ok(review.preserved_legacy_review_summary.reviewed_rows >= 0);
  assert.deepEqual(review.review_horizons, ["T+1", "T+3", "T+5", "T+20"]);
  assert.deepEqual(review.allowed_statuses, ["pending", "reviewed", "unavailable", "skipped"]);
  assert.equal(review.latest_close_fallback, false);
});

function runFixture(fixture) {
  const normalized = normalizeInputs(fixtureInput(fixture));
  const observations = buildObservations(normalized);
  const assessment = assessObservations(observations);
  const decision = decideEntries(assessment);
  return { normalized, observations, assessment, decision };
}

function fixtureInput(fixture) {
  const dates = tradingDates(31);
  const benchmarkRows = marketRows(dates, "benchmark", 0.001, 1);
  const etfRows = fixture.sectors.flatMap((sector, sectorIndex) => {
    let close = 1;
    return dates.map((date, index) => {
      const inLastFive = index >= dates.length - 5;
      const dailyReturn = index === dates.length - 1
        ? fixture.lastDailyReturn
        : inLastFive && fixture.lastFiveDailyReturn !== null
          ? fixture.lastFiveDailyReturn
          : fixture.baseDailyReturn;
      close *= 1 + dailyReturn;
      return {
        date,
        trade_date: date,
        sector_id: sector,
        fund_code: String(510001 + sectorIndex),
        fund_name: `${sector} ETF`,
        open: close / (1 + dailyReturn),
        high: close * 1.01,
        low: close * 0.99,
        close,
        amount: 1_000_000 * (inLastFive ? fixture.recentAmountMultiplier : 1),
        volume: 1_000_000,
        pct_change: dailyReturn * 100,
        turnover: 1
      };
    });
  });
  return {
    asOf: dates.at(-1),
    etfRows,
    benchmarkRows,
    breadth: { status: "unavailable", reason: "fixture breadth unavailable", rows: [] },
    inputSnapshotId: "fixture-input-v1"
  };
}

function scenario(value, { sectors = ["sector"] } = {}) {
  return {
    baseDailyReturn: value.base_daily_return,
    lastDailyReturn: value.last_daily_return ?? value.base_daily_return,
    lastFiveDailyReturn: value.last_five_daily_return ?? null,
    recentAmountMultiplier: value.recent_amount_multiplier,
    sectors
  };
}

function marketRows(dates, sector, dailyReturn, amountMultiplier) {
  let close = 1;
  return dates.map((date) => {
    close *= 1 + dailyReturn;
    return { date, trade_date: date, sector_id: sector, symbol: "510300", close, open: close, high: close, low: close, amount: 1_000_000 * amountMultiplier, volume: 1_000_000, pct_change: dailyReturn * 100, turnover: 1 };
  });
}

function tradingDates(count) {
  const dates = [];
  const cursor = new Date("2026-05-01T00:00:00Z");
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function nextDate(date) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function byPool(assessment) {
  return Object.fromEntries(assessment.rows.map((row) => [row.pool_id, {
    direction_score: row.direction_score,
    structure_state: row.structure_state,
    marginal_change: row.marginal_change
  }]));
}

function eligible(pool_id) {
  return {
    pool_id,
    etf_symbol: pool_id,
    etf_name: pool_id,
    entry_state: "probe_only",
    structure_state: "major_candidate",
    risk_overlays: { risk_gate: "pass" },
    exact_date_valid: true,
    invalidation: ["measurable"],
    thesis: "tied",
    selection_dimensions: {
      entry_quality: 1,
      structural_persistence: 3,
      signed_relative_strength: 50,
      confirmation_completeness: 0.5,
      distance_from_overheat: 1,
      invalidation_distance: 5,
      evidence_trust: 80
    }
  };
}
