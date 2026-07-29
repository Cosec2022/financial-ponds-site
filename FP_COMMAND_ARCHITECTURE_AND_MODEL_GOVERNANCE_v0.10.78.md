# Financial Ponds Command Architecture & Model Governance

**Version:** Command Contract v0.10.78-draft  
**Prepared:** 2026-07-29 17:13 HKT  
**Repository:** `Cosec2022/financial-ponds-site`

---

# 1. Project purpose

Financial Ponds is a medium-term market-structure observation and validation system.

It is not:

- a daily gain leaderboard;
- a short-term stock-picking terminal;
- a system that must choose one sector every day;
- an AI-generated market commentary page;
- a single opaque composite score.

It must answer, in order:

1. What objectively changed in markets, flows, policy, industry and news?
2. Which existing structural theses were supported, weakened, contradicted or unaffected?
3. Which sectors are forming a persistent medium-term structure?
4. How strong is the evidence and what is still missing?
5. Which sectors qualify for ETF entry evaluation?
6. Which should wait for confirmation or pullback?
7. What invalidates each thesis?
8. Did previous observations hold at T+1, T+3, T+5 and T+20?

The current first implementation is A-share sector ETFs. The architecture must remain reusable for Hong Kong, US and other markets.

---

# 2. One official data flow

The official production flow must be one-way:

```text
COLLECT
  ↓
NORMALIZE
  ↓
OBSERVE
  ↓
ASSESS
  ↓
PENETRATE
  ↓
DECIDE
  ↓
REVIEW
  ↓
PERSIST
  ↓
PUBLISH
```

A later stage may not silently rewrite an earlier-stage fact.

The frontend only reads validated published artifacts. It must not reconstruct model logic independently.

---

# 3. Command layers

## 3.1 `fp:collect`

Purpose:

- acquire provider data;
- acquire exact-date benchmark data;
- acquire source-backed market breadth;
- acquire raw news/event sources;
- archive raw or normalized replayable inputs.

It must not:

- calculate structural state;
- calculate entry readiness;
- publish frontend conclusions;
- use fixture data without an explicit mode and visible provenance.

Suggested modes:

```bash
npm run fp:collect -- --mode live --as-of YYYY-MM-DD
npm run fp:collect -- --mode historical --as-of YYYY-MM-DD
npm run fp:collect -- --mode offline --as-of YYYY-MM-DD
```

`live`, `historical` and `offline` must never be inferred silently.

Outputs:

```text
financial-pond/history/market-inputs/<date>/
financial-pond/history/news-inputs/<date>/
financial-pond/data/raw_input_manifest.json
```

---

## 3.2 `fp:normalize`

Purpose:

- canonicalize pool and sector IDs;
- map representative instruments;
- reject duplicate semantic IDs;
- align exact dates;
- reject future data;
- preserve missing fields as `null`;
- produce one normalized market dataset.

It must not:

- rank sectors;
- decide direction;
- fill missing data with zero;
- read yesterday's published output as today's source.

Outputs:

```text
normalized_market_inputs.json
normalized_news_inputs.json
canonical_identity_audit.json
data_alignment_audit.json
```

---

## 3.3 `fp:observe`

Purpose:

Generate independent fact channels for every canonical pool:

```text
price
relative_strength
turnover
ETF share / estimated flow
internal breadth
rotation persistence
valuation
fundamentals
risk
news / policy / industry events
```

Each channel must persist:

```text
value
direction
source
source_date
reality_status
confidence_cap
coverage
missing_reason
formula
```

It must not:

- merge all channels into one score;
- turn data availability into market strength;
- use absolute price movement as positive momentum;
- produce buy candidates.

Outputs:

```text
pool_observations.json
observation_coverage.json
observation_reality_audit.json
```

---

## 3.4 `fp:assess`

Purpose:

Build the official structural assessment for the full canonical universe.

Required independent fields:

```text
direction_score          [-100, 100]
confirmation_score       [0, 100]
confirmation_coverage    [0, 1]
evidence_score           [0, 100]
evidence_level
structure_state
marginal_change
persistence
risk_overlays
```

Official states:

```text
confirmed_trend
major_candidate
watch_candidate
cooling
deteriorating
conflict_review
price_only
insufficient
avoid
```

Rules:

- signed direction is separate from evidence quality;
- confirmation confirms direction and does not independently create bullishness;
- rank and display position may not affect state;
- missing breadth prevents full confirmation;
- equal assessments remain equal;
- no ordinal sector ranking is published.

Outputs:

```text
sector_assessment_daily.json
sector_assessment_history/<date>.json
assessment_contract_audit.json
```

This is the single source of truth for structural state.

---

## 3.5 `fp:penetrate`

Purpose:

Perform the daily global market and news penetration layer:

- deduplicate stories;
- separate facts from narrative;
- connect events to existing structural theses;
- classify each event as support, weaken, contradict or no material effect;
- identify unresolved events requiring later verification.

AI may help summarize and link evidence, but AI output is display-only unless transformed into a source-backed, deterministic structured event.

It must not:

- directly change `direction_score`;
- create a new candidate because media attention increased;
- overwrite hard market facts;
- fabricate an explanation when evidence is absent.

Outputs:

```text
market_penetration_brief.json
thesis_evidence_delta.json
reports/market-penetration/<date>.md
```

---

## 3.6 `fp:decide`

Purpose:

Apply entry qualification after structural assessment.

Required states:

```text
ready_now
probe_only
wait_pullback
wait_confirmation
do_not_chase
invalid
```

It must answer:

```text
why eligible
why not yet eligible
supporting evidence
contrary evidence
next confirmation
invalidation
```

It must allow:

```text
no_qualified_candidate = true
```

It must not:

- rank all sectors and call the first one a buy;
- use evidence quality as a substitute for direction;
- force a primary candidate;
- produce position size without actual portfolio inputs.

Outputs:

```text
entry_decision_daily.json
decision_gate_audit.json
```

---

## 3.7 `fp:review`

Purpose:

Review earlier states and decisions at explicit A-share trading-session horizons:

```text
T+1
T+3
T+5
T+20
```

Requirements:

- exact-date candidate and benchmark prices;
- no latest-close fallback;
- pending, unavailable and reviewed are separate;
- previously reviewed results are preserved;
- use full canonical history, not only visible candidates;
- track both structural-state accuracy and entry-state usefulness.

Outputs:

```text
candidate_outcome_reviews.json
state_transition_reviews.json
review_analytics.json
outcome_label_ledger.json
```

---

## 3.8 `fp:persist`

Purpose:

Archive all validated daily outputs and provenance.

It must:

- be idempotent;
- archive the full canonical universe;
- include model version, contract version and input snapshot IDs;
- never manually mutate historical reviewed rows;
- fail when the date or identity contract is inconsistent.

Outputs:

```text
history/observations/<date>.json
history/assessments/<date>.json
history/decisions/<date>.json
history/manifests/<date>.json
```

---

## 3.9 `fp:publish`

Purpose:

Copy only validated official artifacts into the frontend data directory.

It must:

- use an explicit whitelist;
- reject stale `as_of`;
- reject mixed model versions;
- reject missing required artifacts;
- never use `copy_if_exists` for required data;
- delete or quarantine stale prior-day files when today's required output is absent.

Outputs:

```text
financial-pond/data/daily_manifest.json
financial-pond/data/sector_assessment_daily.json
financial-pond/data/entry_decision_daily.json
financial-pond/data/market_penetration_brief.json
financial-pond/data/review_analytics.json
```

The frontend reads `daily_manifest.json` first and only loads artifacts listed in it.

---

# 4. Official top-level commands

## 4.1 Deterministic model command

```bash
npm run fp:model -- --as-of YYYY-MM-DD
```

Runs:

```text
normalize
observe
assess
penetrate using already available sources
decide
review
persist
validate
```

It does not access the network.

---

## 4.2 Complete daily command

```bash
npm run fp:daily -- --mode live --as-of YYYY-MM-DD
```

Runs exactly once:

```text
collect
model
publish
```

It does not:

- commit;
- push;
- deploy;
- run a stage twice.

---

## 4.3 Historical replay

```bash
npm run fp:replay -- --as-of YYYY-MM-DD
```

Runs from archived inputs only.

It must fail if the input snapshot does not exist.

---

## 4.4 Local operator command

```bash
npm run fp:today
```

Meaning:

```text
fp:daily --mode live --as-of Hong Kong today
build:site
validate
test
```

It must not run:

```text
git pull
git add .
git commit
git push
deploy
```

Git operations remain explicit human actions.

---

## 4.5 Audit command

```bash
npm run fp:audit -- --as-of YYYY-MM-DD
```

Runs:

```text
identity audit
date alignment audit
source reality audit
coverage audit
model contract audit
history quality audit
published artifact audit
```

It changes no data.

---

## 4.6 Pure site build

```bash
npm run build:site
npm run build
```

Both must be pure builds.

They may read validated published data and generate `dist`, but must not:

- collect data;
- rerun models;
- change `financial-pond/data`;
- create daily history;
- access the network.

---

## 4.7 Deployment

```bash
npm run deploy
```

Runs only:

```text
build:site
validate
validate:data
deploy
```

It does not collect or model.

Deployment must consume one already-published, validated daily manifest.

---

# 5. Current command migration

## Keep as lower-level internal commands

```text
provider:akshare:doctor
provider:akshare
provider:akshare:persist
provider:benchmark
provider:history:archive
provider:market-history:backfill
provider:akshare:validate
provider:akshare:inspect
data:vault
data:audit
history validators
```

These remain implementation tools called by the new orchestrator.

---

## Merge into `fp:observe`

```text
provider:akshare:to-flow
provider:a-share-water:to-observations
flow:review
rotation:review
rotation:history
module:review
sector breadth generation
market signal channel
flow channel
signal attribution
```

Old commands may remain temporarily as diagnostic aliases, but they must not independently publish official conclusions.

---

## Merge into `fp:assess`

```text
pool:analysis
daily:sector-analysis
candidate-state-model
sector-observation-panel
watchlist:state
right-side major-wave classification
```

Replace the mixed observation score and visible ranking with the signed structural contract.

---

## Merge into `fp:decide`

```text
etf:readiness
decision:gates
candidate price basis
overheat / risk gate overlays
```

The old readiness concept is preserved, but it consumes the new structural assessment.

---

## Merge into `fp:review`

```text
candidate review schedule
candidate outcome reviews
outcome label ledger
candidate review analytics
due review verification
```

---

## Keep separate as `fp:penetrate`

```text
news:review
fp:research
market penetration brief
```

This layer must remain explanatory and evidence-linked, not a hidden scoring engine.

---

## Retire from official output

```text
visible ordinal rank
rank change
rank-driven strengthening
mixed observation score as sector strength
Top 10 as the only archived universe
lexical pool_id tie-breaking presented as analysis
duplicate semantic pool rows
```

Legacy artifacts may be kept for migration audits only.

---

# 6. Workflow architecture

The GitHub Actions workflow must use separate jobs:

```text
collect
model
validate
persist
deploy
```

Dependency chain:

```text
collect → model → validate → persist → deploy
```

Rules:

- no command runs the same model stage twice;
- `a-share:daily:ci` must not internally run stages that the workflow reruns afterward;
- model and validation jobs use artifacts from the previous stage;
- persist happens only after validation passes;
- deploy happens only from the persisted validated manifest;
- a failed provider may produce an explicit degraded observation artifact, but may not silently reuse yesterday's conclusion;
- scheduled workflow may commit data, but development files must never be included;
- generated-data commits use an explicit whitelist.

---

# 7. Model governance rules

## 7.1 One concept, one field

Never mix:

```text
direction
confirmation
evidence quality
attention priority
entry readiness
risk
```

into one opaque score.

---

## 7.2 One official source of truth

Official structural state:

```text
sector_assessment_daily.json
```

Official entry decision:

```text
entry_decision_daily.json
```

Official publication state:

```text
daily_manifest.json
```

Other files are channels, diagnostics or historical evidence.

---

## 7.3 Hard model and narrative separation

Hard model:

- deterministic;
- source-backed;
- testable;
- replayable.

Narrative layer:

- interprets;
- summarizes;
- links evidence;
- never directly changes hard fields.

---

## 7.4 Fail closed

When required data is missing:

```text
state = insufficient
entry_state = invalid or wait_confirmation
```

Never:

- fill missing with zero;
- reuse yesterday silently;
- claim “data synchronized” when required channels are absent;
- force a candidate.

---

## 7.5 No rank feedback

Display order is presentation only.

It cannot affect:

```text
state
marginal change
entry state
review label
```

---

## 7.6 Full-universe persistence

Every daily run archives all canonical sectors.

The frontend may display a filtered subset, but history and review may not be Top-10-only.

---

## 7.7 Version every contract

Every official artifact includes:

```text
schema_version
model_version
command_contract_version
as_of
generated_at
input_snapshot_id
```

A model rule change requires:

- new model version;
- migration note;
- replay tests;
- old/new comparison.

---

## 7.8 Idempotence

Running the same date with the same archived inputs and same model version must produce the same substantive results.

Timestamps may differ only in metadata expressly excluded from reproducibility checks.

---

# 8. Daily manifest contract

Example:

```json
{
  "as_of": "2026-07-29",
  "generated_at": "2026-07-29T09:15:00Z",
  "command_contract_version": "fp-command-v0.10.78",
  "model_version": "fp-structure-v0.10.78",
  "input_snapshot_id": "a-share-2026-07-29-001",
  "mode": "live",
  "status": "validated",
  "degraded_channels": ["breadth"],
  "artifacts": {
    "sector_assessment": "sector_assessment_daily.json",
    "entry_decision": "entry_decision_daily.json",
    "market_penetration": "market_penetration_brief.json",
    "review_analytics": "review_analytics.json"
  }
}
```

The frontend must visibly state degraded channels.

---

# 9. Acceptance tests for the command refactor

1. `build` does not modify model data.
2. `fp:model` makes no network request.
3. `fp:daily` runs each stage once.
4. `fp:today` performs no Git write or deploy.
5. Missing required current-day output cannot fall back to yesterday's published conclusion.
6. Fixture mode is explicit in the manifest.
7. Duplicate semantic IDs fail normalization.
8. All official artifacts share one `as_of`, model version and input snapshot.
9. Rank movement cannot alter state.
10. Evidence quality cannot alter signed direction.
11. Missing breadth blocks full confirmation.
12. No eligible sector produces `no_qualified_candidate=true`.
13. Full canonical universe is archived.
14. Replay from archived inputs reproduces the substantive daily output.
15. Persist and deploy cannot run before validation.
16. AI penetration output cannot modify hard model artifacts.
17. Workflow contains no duplicated model stage.
18. Generated-data Git commits use an explicit path whitelist.
19. A failed required channel produces a visible degraded or failed state.
20. The frontend reads the daily manifest before loading conclusions.

---

# 10. Permanent project guardrail

Before adding any new command or model module, answer:

```text
Which layer does it belong to?
What input contract does it consume?
What artifact does it own?
Is it fact, assessment, decision, explanation or review?
Can it alter an upstream result?
How is it replayed?
How does it fail closed?
Which existing command does it replace?
```

A new command is rejected when it:

- duplicates an existing stage;
- creates another independent “final score”;
- bypasses the official structural assessment;
- changes model data during site build;
- combines collection, modeling, Git commit and deployment;
- introduces an undocumented fallback;
- produces a visible conclusion without a review path.

---

# 11. Target package scripts

Illustrative target:

```json
{
  "scripts": {
    "fp:collect": "node scripts/fp/run-collect.mjs",
    "fp:normalize": "node scripts/fp/run-normalize.mjs",
    "fp:observe": "node scripts/fp/run-observe.mjs",
    "fp:assess": "node scripts/fp/run-assess.mjs",
    "fp:penetrate": "node scripts/fp/run-penetrate.mjs",
    "fp:decide": "node scripts/fp/run-decide.mjs",
    "fp:review": "node scripts/fp/run-review.mjs",
    "fp:persist": "node scripts/fp/run-persist.mjs",
    "fp:publish": "node scripts/fp/run-publish.mjs",
    "fp:model": "node scripts/fp/run-model.mjs",
    "fp:daily": "node scripts/fp/run-daily.mjs",
    "fp:replay": "node scripts/fp/run-replay.mjs",
    "fp:audit": "node scripts/fp/run-audit.mjs",
    "fp:today": "bash scripts/local/fp-today.sh",
    "build": "npm run build:site",
    "build:site": "bash scripts/build-site.sh",
    "validate": "node scripts/validate-artifact.mjs",
    "validate:data": "node scripts/validate-published-data.mjs",
    "test": "node --test tests/*.test.mjs",
    "deploy": "npm run build:site && npm run validate && npm run validate:data && npx wrangler@4.102.0 deploy"
  }
}
```

Names may be adjusted during implementation. The responsibilities may not be blurred.

---

# 12. Final architecture statement

Financial Ponds must evolve as:

```text
a trustworthy observation system
→ a structural validation system
→ an entry qualification system
→ a continuously reviewed learning system
```

It must not evolve as:

```text
more inputs
→ larger composite score
→ prettier ranking
→ forced daily buy answer
```
