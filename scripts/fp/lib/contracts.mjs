export const COMMAND_CONTRACT_VERSION = "fp-command-v0.10.78";
export const MODEL_VERSION = "fp-structure-v0.10.78";
export const SCHEMA_VERSION = "fp-daily-v0.10.78";

export const STRUCTURE_STATES = Object.freeze([
  "confirmed_trend",
  "major_candidate",
  "watch_candidate",
  "cooling",
  "deteriorating",
  "conflict_review",
  "price_only",
  "insufficient",
  "avoid"
]);

export const ENTRY_STATES = Object.freeze([
  "ready_now",
  "probe_only",
  "wait_confirmation",
  "wait_pullback",
  "do_not_chase",
  "invalid"
]);

export const THRESHOLDS = Object.freeze({
  direction: {
    confirmed: 45,
    major: 25,
    watch: 10,
    deteriorating: -20,
    material_conflict: 30,
    marginal_change: 10
  },
  confirmation: {
    confirmed: 60,
    entry: 50,
    full_coverage: 0.7
  },
  evidence: {
    entry: 70,
    insufficient: 40
  },
  risk: {
    extended: 2,
    severe_extension: 3,
    daily_move_pct: 2
  }
});

export const DIRECTION_FORMULA =
  "direction_score = 0.60 * normalize(0.60 * risk_adjusted_return_20 + 0.40 * risk_adjusted_return_5) + 0.40 * normalize(0.60 * risk_adjusted_excess_20 + 0.40 * risk_adjusted_excess_5); normalize(x)=100*tanh(x/2)";
