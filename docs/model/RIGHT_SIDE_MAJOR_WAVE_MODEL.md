# Right-Side Major-Wave Model

Version: v0.10.61

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
