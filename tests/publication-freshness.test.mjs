import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evaluatePublicationFreshness } from "../financial-pond/publication-freshness.mjs";

const calendar = JSON.parse(
  await readFile("config/a-share-trading-calendar.v2026-07.json", "utf8")
);

test("bundle synchronization does not make an older publication fresh", () => {
  const result = evaluatePublicationFreshness({
    asOf: "2026-07-28",
    calendar,
    now: new Date("2026-07-30T10:51:00.000Z")
  });
  assert.deepEqual(result, {
    state: "stale",
    expected_as_of: "2026-07-30",
    reason: "publication_behind_expected_session",
    label: "数据过期 · 应至 2026-07-30"
  });
});

test("same-session publication is fresh after the scheduled publication cutoff", () => {
  const result = evaluatePublicationFreshness({
    asOf: "2026-07-30",
    calendar,
    now: new Date("2026-07-30T10:51:00.000Z")
  });
  assert.equal(result.state, "fresh");
  assert.equal(result.expected_as_of, "2026-07-30");
});

test("before the scheduled cutoff the previous trading session remains expected", () => {
  const result = evaluatePublicationFreshness({
    asOf: "2026-07-29",
    calendar,
    now: new Date("2026-07-30T07:30:00.000Z")
  });
  assert.equal(result.state, "fresh");
  assert.equal(result.expected_as_of, "2026-07-29");
});

test("future publication dates and unknown calendar coverage never render green", () => {
  const future = evaluatePublicationFreshness({
    asOf: "2026-07-30",
    calendar,
    now: new Date("2026-07-30T07:30:00.000Z")
  });
  assert.equal(future.state, "error");
  assert.equal(future.reason, "publication_date_is_future");

  const uncovered = evaluatePublicationFreshness({
    asOf: "2026-07-30",
    calendar,
    now: new Date("2026-09-01T10:51:00.000Z")
  });
  assert.equal(uncovered.state, "unknown");
});
