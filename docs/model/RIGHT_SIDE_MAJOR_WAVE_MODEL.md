# Right-Side Major-Wave Model

Version: v0.10.65

## Purpose

The right-side major-wave model classifies observation candidates into short,
auditable states. It helps separate early right-side opportunity, possible major
wave development, overheated strength, cooling/failed behavior, and risk-gated
candidates.

## Candidate States

- Noise
- Pulse
- Early Right
- Major Candidate
- Confirmed Trend
- Overheated
- Cooling
- Failed

## Inputs

The model uses only data available as of the candidate date:

- observation candidate ledger
- pool observation scores
- pool market signals
- pool instrument map
- pool signal quality
- pool delta signals
- candidate price basis
- same-day and prior observation archives

Future outcome review rows are not used to classify current candidates.

## Model Fields

Each candidate stores:

- candidate_state
- overheat_score
- major_wave_score
- risk_gate_status
- state_reason
- overheat_reason
- major_wave_reason
- risk_gate_reason

## Guardrails

The overheat filter penalizes strong candidates that may be late-stage because
of large short-term moves, abnormal turnover, repeated top ranking, or strength
without hard flow confirmation. It does not remove candidates.

The major wave score rewards direct evidence, sustained market confirmation,
liquidity support, capped confidence, and baseline readiness while penalizing
proxy risk and overheat risk.

The risk gate returns one of:

- pass
- caution
- block
- insufficient_data

## Boundary

This model is `observe_only`. It is not investment advice and does not create
execution recommendations.

## Review Analytics

v0.10.62 adds `candidate_review_analytics.json`. It reads
`candidate_review_history.json` and summarizes only reviewed T+1/T+3 outcomes
with available returns. Pending, unavailable, and insufficient-data review rows
are excluded from rate calculations. Groups with too few reviewed samples are
reported as `insufficient_sample`.

## Review Policy v0.10.65

- Review horizons count explicit A-share trading sessions, not calendar days.
- Output separates `review_status` (`pending`, `reviewed`, `unavailable`,
  `skipped`) from `review_reason`.
- Candidate and benchmark prices must match the signal/effective review dates
  exactly; latest-close fallback is prohibited.
- `510300` is the configured operational A-share benchmark ETF proxy. It is
  not the complete A-share market.
- Existing reviewed outcomes are preserved; unfinished rows remain migratable.

The versioned calendar currently covers `2026-07-01` through `2026-08-31`.
Dates outside that range fail closed as `calendar_unknown`. Before the covered
range is exhausted, maintainers must review the official SSE closure calendar,
extend the explicit session allowlist in a new calendar version, and rerun the
fixed-time calendar tests. v0.10.65 does not yet automate this expiry warning.
