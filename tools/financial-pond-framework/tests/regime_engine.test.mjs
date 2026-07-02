import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRegimes, matchesCondition } from "../src/model/regime_engine.mjs";

test("regime engine evaluates configured conditions from confidence-adjusted observations", () => {
  const rules = {
    regimes: [
      {
        id: "liquidity_easing",
        conditions: [
          { node_id: "usd_liquidity", operator: ">=", value: 0.4 },
          { node_id: "us_real_rate", operator: "<=", value: 0.5 }
        ]
      }
    ]
  };

  const result = evaluateRegimes({
    rules,
    observations: [
      { node_id: "usd_liquidity", score: 0.8, confidence: 0.75 },
      { node_id: "us_real_rate", score: 0.4, confidence: 1 }
    ]
  });

  assert.equal(result.count, 1);
  assert.equal(result.active[0].id, "liquidity_easing");
});

test("regime condition helper supports range and absolute checks", () => {
  assert.equal(matchesCondition(0.2, { operator: "between", min: 0.1, max: 0.3 }), true);
  assert.equal(matchesCondition(-0.7, { operator: "abs>=", value: 0.5 }), true);
});

