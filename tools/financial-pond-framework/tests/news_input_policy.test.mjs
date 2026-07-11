import test from "node:test";
import assert from "node:assert/strict";
import { NARRATIVE_DISPLAY_ONLY, VERIFIED_FACT_CHANNEL, narrativeMayEnterGraph, normalizeNewsInputPolicy, verifiedFactMayEnterGraph } from "../src/news/news_input_policy.mjs";

test("legacy RSS narratives fail closed outside graph scoring", () => {
  assert.equal(normalizeNewsInputPolicy(null).news_input_mode, NARRATIVE_DISPLAY_ONLY);
  assert.equal(narrativeMayEnterGraph(normalizeNewsInputPolicy({ news_input_mode: VERIFIED_FACT_CHANNEL })), false);
});

test("only separately verified fact-channel fixtures can be eligible for future graph input", () => {
  const policy = { news_input_mode: VERIFIED_FACT_CHANNEL };
  assert.equal(verifiedFactMayEnterGraph(policy, { source: "verified_fact_channel", verification_status: "official_machine_verified" }), true);
  assert.equal(verifiedFactMayEnterGraph(policy, { source: "news_search_collector", verification_status: "official_machine_verified" }), false);
  assert.equal(verifiedFactMayEnterGraph(policy, { source: "verified_fact_channel", verification_status: "candidate" }), false);
});
