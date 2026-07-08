export const SIGNAL_SLOTS = Object.freeze([
  "flow",
  "price_momentum",
  "liquidity",
  "rotation",
  "news",
  "valuation",
  "fundamental",
  "risk"
]);

export const SignalReality = Object.freeze({
  REAL_PROVIDER: "real_provider",
  REAL_PROVIDER_DERIVED: "real_provider_derived",
  MANUAL_SEED: "manual_seed",
  MOCK: "mock",
  FIXTURE: "fixture",
  MISSING: "missing",
  PLANNED: "planned",
  INSUFFICIENT_HISTORY: "insufficient_history"
});

export const Boundary = Object.freeze({
  OBSERVE_ONLY: "observe_only",
  MANUAL_REVIEW: "manual_review",
  BLOCKED: "blocked"
});

export const ReviewHorizon = Object.freeze({
  T1: "T+1",
  T3: "T+3",
  T5: "T+5",
  T20: "T+20"
});

export const OutcomeLabel = Object.freeze({
  PENDING: "pending",
  CONFIRMED: "confirmed",
  FAILED: "failed",
  MIXED: "mixed",
  SKIPPED: "skipped"
});

export const ManualReviewHumanView = Object.freeze({
  WATCH: "watch",
  IGNORE: "ignore",
  REVIEW_LATER: "review_later",
  CONFLICT_REVIEW: "conflict_review"
});

export const ObservationTypes = Object.freeze({
  Universe: "Universe",
  Pool: "Pool",
  Signal: "Signal",
  SignalReality: "SignalReality",
  VectorForecast: "VectorForecast",
  ObservationSnapshot: "ObservationSnapshot",
  ManualReviewEntry: "ManualReviewEntry",
  OutcomeLabel: "OutcomeLabel",
  ReviewHorizon: "ReviewHorizon",
  Boundary: "Boundary"
});

export function emptySignal(slot) {
  return {
    slot,
    reality: SignalReality.MISSING,
    value: null,
    score: null,
    label: "missing",
    source_file: null,
    trace_id: null,
    trace_status: "missing"
  };
}
