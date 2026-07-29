# Financial Ponds — Codex Implementation Handoff

**Prepared:** 2026-07-29 16:56 HKT  
**Repository:** `Cosec2022/financial-ponds-site`  
**Local path:** `~/Documents/GitHub/financial-ponds-site`  
**Target branch:** `codex/refactor-structure-entry-decision-v0.10.78`  
**Delivery:** staged commits + pushed branch + Draft PR  
**Do not:** merge, deploy, run live providers, or manually edit generated JSON / worker assets.

---

## 0. Product objective

Financial Ponds must stop answering:

> Which sector is ranked first today?

It must instead answer:

1. Which sector structure is genuinely strengthening or weakening?
2. Which sector ETF is eligible for entry evaluation now?
3. Which is the primary candidate, secondary candidate, probe-only, waiting, invalid, or currently none?
4. Why was that conclusion reached?
5. What evidence is missing?
6. What confirms the thesis next?
7. What invalidates it?

FP remains a **medium-term / structural right-side observation system**, not a short-term trading leaderboard. The system must be allowed to output:

> 当前没有满足条件的买入候选。

Do not force a daily answer.

---

## 1. Diagnose first

Before changing code, inspect current `origin/main` and write a concise diagnosis into the Draft PR description or a committed report.

Confirm the exact current behavior, including:

- `observation_score` mixes flow availability, absolute momentum magnitude, liquidity, evidence quality, confidence, proxy penalty and missing-data penalty.
- Momentum scoring uses absolute magnitude, allowing a large fall and large rise to receive the same positive score.
- Score liquidity uses a cross-sectional absolute amount comparison, while the frontend displays amount / own 20-day mean.
- Equal scores are forced into ordinal order through confidence, canonical ID weight and lexical `pool_id`.
- Rank movement alone can trigger `strengthening` or `weakening`.
- Duplicate semantic IDs such as `a_share_x` and `a_share_a_share_x` may remain in upstream score rows and statistics.
- The frontend presents observation priority as industry-strength ranking.

Report:

- exact formulas;
- affected source files;
- generated artifacts;
- history/archive dependencies;
- existing tests;
- current version and data date;
- duplicate identity paths;
- old status transitions.

**Diagnosis first, then implementation.**

---

# Phase A — v0.10.78 Structural assessment refactor

## 2. Remove the mixed analytical ranking

Do not replace the old composite with another opaque total score.

Create separate, auditable outputs:

```text
direction_score
confirmation_score
confirmation_coverage
evidence_score
evidence_level
structure_state
marginal_change
attention_group
```

Legacy values may temporarily remain as:

```text
legacy_observation_score
legacy_rank
```

They must not drive:

- structural state;
- marginal change;
- entry decision;
- summary conclusion;
- frontend display order.

Remove visible ordinal ranking from the main frontend.

---

## 3. Signed direction assessment

Add:

```text
direction_score ∈ [-100, 100]
```

Inputs:

- 20-session risk-adjusted ETF return;
- 5-session risk-adjusted ETF return;
- 20-session ETF excess return vs exact-date CSI 300;
- 5-session ETF excess return vs exact-date CSI 300.

Baseline contract:

```text
price_direction =
  normalize(0.60 × z_return_20 + 0.40 × z_return_5)

relative_direction =
  normalize(0.60 × z_excess_20 + 0.40 × z_excess_5)

direction_score =
  0.60 × price_direction + 0.40 × relative_direction
```

Requirements:

- preserve sign;
- a large negative return must lower direction;
- volatility adjustment must be deterministic and bounded;
- persist raw values, normalized values and formulas;
- evidence quality and confidence must not alter direction;
- no future data;
- exact-date benchmark alignment;
- missing data remains `null`.

Centralize normalization and thresholds in one versioned model contract.

---

## 4. Confirmation assessment

Add:

```text
confirmation_score ∈ [0, 100]
confirmation_coverage ∈ [0, 1]
```

Inputs:

```text
recent 5-session mean amount / 20-session mean amount
turnover activity trend
source-backed internal breadth
```

Rules:

- volume confirms the current direction;
- volume alone is not positive;
- rising volume with falling price confirms weakness, not strength;
- use the same turnover definition in the model and frontend;
- breadth must remain `null` when unavailable;
- do not synthesize zero;
- do not state “fully confirmed” when breadth is unavailable.

Suggested turnover levels:

```text
>= 1.20x   strong confirmation
1.00–1.20x medium confirmation
0.80–1.00x weak confirmation
< 0.80x   unconfirmed
```

The implementation may improve these thresholds only with a documented reason and tests.

---

## 5. Evidence assessment

Add:

```text
evidence_score ∈ [0, 100]
```

Suggested components:

```text
direct ETF / index mapping          25
price-history completeness          25
exact-date benchmark alignment      20
turnover-history completeness       15
source-backed breadth availability  15
```

Levels:

```text
80–100  high
60–79   medium
40–59   low
<40     insufficient
```

Evidence answers:

> How trustworthy is this assessment?

It must not answer:

> How strong is this sector?

Evidence quality cannot directly raise `direction_score`.

---

## 6. Structural state machine

Implement explicit state gates:

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

Baseline rules:

### `confirmed_trend`

```text
direction_score >= 45
confirmation_score >= 60
confirmation_coverage >= 0.70
positive state persists >= 3 observed sessions
risk gate is not blocked
```

### `major_candidate`

```text
direction_score >= 25
price direction and relative direction do not materially conflict
at least one confirmation source is usable
positive state persists >= 2 observed sessions
```

### `watch_candidate`

```text
direction_score in [10, 25)
or early improvement without enough persistence / confirmation
```

### `cooling`

```text
prior positive state remains above zero
and direction falls >= 15
or confirmation falls >= 20
```

### `deteriorating`

```text
direction_score <= -20
or a prior positive state falls below zero
and at least two independent components weaken
```

### `conflict_review`

Examples:

```text
price direction materially positive while relative direction is materially negative
price direction materially negative while relative direction is materially positive
large one-day move conflicts with medium-term structure
model state conflicts with hard market evidence
```

### `price_only`

```text
abs(one-day return) >= max(2%, 1.5 × daily volatility)
while 5-day direction, relative direction and confirmation do not agree
```

### `insufficient`

```text
no defensible mapping
too little price history
no signed direction
evidence_score < 40
```

Do not use rank or display position in this state machine.

---

## 7. Marginal change

Remove these rules entirely:

```text
rank rises by 2 => strengthening
rank falls by 2 => weakening
```

New values:

```text
strengthening
weakening
state_upgrade
state_downgrade
price_only
unchanged
insufficient
```

Baseline gates:

### `strengthening`

```text
direction_score increases >= 10
at least two independent components improve
no material conflict
```

### `weakening`

```text
direction_score decreases >= 10
at least two independent components deteriorate
```

Independent components:

```text
price direction
relative direction
turnover confirmation
internal breadth
```

A change in display order must never change structural state or marginal change.

---

## 8. Canonical identity migration

Canonicalize semantic IDs before:

- scoring;
- state calculation;
- history;
- tier/statistical counts;
- daily publication;
- summary generation.

Do not rely on publication-time deduplication only.

Remove double-counting of forms such as:

```text
a_share_ai_computer
a_share_a_share_ai_computer
```

Persist canonical migration diagnostics.

---

# Phase B — v0.10.79 Entry-readiness layer

## 9. Add `entry_state`

Values:

```text
ready_now
probe_only
wait_pullback
wait_confirmation
do_not_chase
invalid
```

Baseline entry eligibility:

```text
structure_state in [major_candidate, confirmed_trend]
direction_score >= 30
confirmation_score >= 50
evidence_score >= 70
risk gate pass
no material conflict
current valid data date
```

Use these as overlays:

- recent extension;
- overheat;
- drawdown;
- support / reclaim;
- direction persistence;
- invalidation distance;
- confirmation deterioration.

Rules:

- structurally strong but overextended => `wait_pullback` or `do_not_chase`;
- early but credible structure => `probe_only`;
- direction positive but confirmation incomplete => `wait_confirmation`;
- broken thesis => `invalid`;
- never convert evidence completeness into a buy signal.

---

## 10. Entry explanation contract

Each row must explain:

```text
thesis
supporting_evidence[]
contrary_evidence[]
next_confirmation[]
invalidation[]
```

Avoid template text that merely repeats field names.

The explanation must distinguish:

- strong structure;
- good current entry;
- strong but overextended;
- needs confirmation;
- invalid;
- insufficient evidence.

---

# Phase C — v0.10.80 Final selection / “buy which” output

## 11. Generate a complete decision artifact

Generate daily data for the full canonical A-share sector universe, not only Top 10.

Required row shape:

```json
{
  "pool_id": "a_share_bank_insurance",
  "structure_state": "major_candidate",
  "direction_score": 58.4,
  "direction_components": {
    "price": 46.2,
    "relative_strength": 76.7
  },
  "confirmation_score": 32,
  "confirmation_coverage": 0.4,
  "confirmation_components": {
    "turnover": 32,
    "breadth": null
  },
  "evidence_score": 74,
  "evidence_level": "medium",
  "marginal_change": "strengthening",
  "direction_change": 12.6,
  "entry_state": "wait_confirmation",
  "risk_overlays": {
    "overheated": false,
    "risk_gate": "pass"
  },
  "thesis": "...",
  "supporting_evidence": ["..."],
  "contrary_evidence": ["..."],
  "next_confirmation": ["..."],
  "invalidation": ["..."]
}
```

Also generate a daily decision summary:

```text
primary_entry_candidate
secondary_entry_candidate
probe_only_candidates[]
waiting_candidates[]
invalid_candidates[]
no_qualified_candidate
```

Rules:

- do not force a primary candidate;
- `no_qualified_candidate=true` must be valid and visible;
- primary and secondary are only selected from rows that pass eligibility gates;
- selection is not an ordinal market-strength ranking;
- include a machine-readable selection reason;
- do not output personalized position size unless portfolio inputs are explicitly available.

---

## 12. Decision comparison

First eliminate:

- risk gate blocked;
- insufficient evidence;
- deteriorating direction;
- material conflict;
- severe overheat;
- invalid thesis.

Then compare remaining eligible candidates by:

1. entry quality;
2. structural persistence;
3. signed relative strength;
4. confirmation completeness;
5. upside room vs invalidation distance;
6. portfolio overlap, only when actual portfolio inputs exist.

Do not collapse these into another hidden composite without persisted components and a documented decision contract.

---

# Frontend migration

## 13. Remove misleading fields

Remove from the main interface:

```text
综合分
排名
排名变化
rank-derived 边际增强
```

Replace with:

```text
当前结构状态
今日边际变化
结构方向
确认程度
确认覆盖
证据可信度
入场状态
支持证据
反对证据
下一确认条件
失效条件
```

The page must clearly distinguish:

```text
结构最强
当前适合进入
等待回撤
等待确认
暂不进入
目前没有合格对象
```

Keep the page orderly and readable. Do not turn it into a dense short-term trading terminal.

---

## 14. Display order, not ranking

Display groups:

1. state changed today;
2. conflict or risk-gate changed;
3. `ready_now` / `probe_only`;
4. `wait_confirmation` / `wait_pullback`;
5. stable confirmed trends;
6. ordinary watch candidates;
7. insufficient evidence.

Within a group:

1. absolute direction change;
2. evidence score;
3. persistence;
4. canonical `pool_id` as final deterministic tie-break only.

Do not display ordinal numbers. Equal states may remain tied.

---

# Files to inspect

Do not assume this list is exhaustive:

```text
tools/financial-pond-framework/src/tools/general_pool_analysis.mjs
scripts/lib/sector-observation-panel.mjs
scripts/build-sector-observation-panel.mjs
financial-pond/structural-observation-contract.mjs
financial-pond/app.js
financial-pond/index.html
scripts/build-evening-observation-summary.mjs
archive / longitudinal builders
data validators
history-quality validators
model docs
tests
```

Trace all generated data back to source generators.

---

# Non-negotiable data rules

- Fail-Closed.
- Exact-date alignment.
- No future data.
- Missing values remain `null`.
- No synthetic breadth.
- No manual edits to generated JSON.
- No manual edits to worker assets or published build output.
- Full canonical universe archived daily.
- Historical snapshots remain reproducible.
- Use committed historical data and fixtures.
- Do not run live providers without explicit approval.

---

# Required tests

At minimum:

1. A large one-day fall cannot increase signed direction.
2. A large one-day rise cannot become confirmed without medium-term, relative and confirmation support.
3. Display-order changes cannot alter state or marginal change.
4. Lexical `pool_id` ordering cannot create analytical first place.
5. Evidence quality cannot directly raise direction.
6. Missing breadth prevents full confirmation.
7. Turnover below its own 20-session mean cannot be described as volume-confirmed strength.
8. Rank movement cannot trigger strengthening or weakening.
9. Ties remain ties; no visible ordinal rank is generated.
10. Missing fields remain `null`.
11. All canonical sector rows are archived daily.
12. Duplicate semantic IDs are removed before scoring and statistics.
13. `no_qualified_candidate=true` when no row passes entry gates.
14. A strong but overheated row becomes `wait_pullback` or `do_not_chase`.
15. Generated artifacts validate.
16. Historical snapshots remain reproducible.
17. Legacy score/rank cannot affect new outputs.
18. Frontend has no visible ordinal rank or rank movement.
19. Primary candidate is selected only from entry-eligible rows.
20. A no-candidate day renders clearly and does not fail the build.

Fixtures:

- large decline with high turnover;
- large rise without relative confirmation;
- steady medium-term uptrend with moderate volume;
- strong trend with overheat guardrail;
- breadth unavailable;
- duplicate semantic IDs;
- no eligible candidate day;
- equal structural states;
- stale source date;
- exact-date benchmark missing.

---

# Execution workflow

1. Confirm repository and worktree state.
2. Fetch `origin/main`.
3. Create branch:

```bash
git switch -c codex/refactor-structure-entry-decision-v0.10.78 origin/main
```

4. Diagnose first and record findings.
5. Implement staged commits:

```text
1. structural direction / confirmation / evidence contract
2. canonical identity migration and marginal-state refactor
3. entry-readiness artifact and selection summary
4. frontend migration
5. tests, validation, docs and final version update
```

6. Run relevant focused tests during implementation.
7. Run final checks:

```bash
npm test
npm run validate:data
npm run validate:history-quality
npm run build
```

Also run any repository-specific audits discovered during diagnosis.

8. Commit and push the branch.
9. Open a **Draft PR**.
10. Draft PR must include:

- diagnosis;
- changed files;
- old-to-new data/state transitions;
- generated artifacts;
- tests;
- validation/audit results;
- fixture demonstrations;
- screenshots or rendered examples;
- known limitations;
- exact version;
- exact commit SHA;
- timestamp and timezone.

11. Do not merge.
12. Do not deploy.
13. Do not modify production data.

---

# Codex start prompt

Use this exact instruction after opening the repository:

> Read `CODEX_HANDOFF_FP_v0.10.78-80.md` in full. Work in `~/Documents/GitHub/financial-ponds-site`. Start from current `origin/main` on branch `codex/refactor-structure-entry-decision-v0.10.78`. Diagnose and report the existing ranking, score, status, identity and frontend data flow before editing. Then complete the structural assessment, entry-readiness and final candidate-selection refactor described in the file using staged commits. Do not manually edit generated JSON or worker assets. Do not run live providers, merge or deploy. Use committed data and fixtures, run the full tests and validations, push the branch and open a Draft PR with exact changed files, status transitions, generated artifacts, test/audit results, commit SHA, date and timezone.

---

# Definition of done

The Draft PR must demonstrate that FP no longer answers:

> Which sector ranks first?

It instead answers:

- which sector structure is genuinely strengthening;
- which sector is currently entry-eligible;
- which sector needs confirmation;
- which sector is strong but should wait for a pullback;
- which thesis is invalid;
- why the conclusion was reached;
- what evidence is missing;
- what confirms the thesis next;
- what invalidates it;
- and when there is no qualified sector to buy.
