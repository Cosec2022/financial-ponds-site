# Financial Ponds — ETF Guidance Implementation Directive

**Version:** v0.10.78–v0.10.80  
**Prepared:** 2026-07-29 17:17 HKT  
**Repository:** `Cosec2022/financial-ponds-site`  
**Product owner intent:** Financial Ponds should guide the user’s A-share sector ETF buying.

---

# 1. Final product purpose

Financial Ponds is no longer only an `observe_only` dashboard.

Its product boundary becomes:

> **medium-term ETF decision support, without automated execution**

FP must guide the user on:

- which sector ETF currently qualifies for buying consideration;
- whether it is suitable to enter now, probe only, wait for confirmation, or wait for a pullback;
- why the guidance exists;
- what evidence supports and contradicts it;
- what must happen next;
- what invalidates the thesis;
- when no ETF currently qualifies.

FP must not:

- become a daily percentage-gain leaderboard;
- force one ETF every day;
- churn positions because daily rank changes;
- issue automatic orders;
- hide uncertainty behind one composite score;
- treat a news narrative as a hard buy signal.

The intended holding horizon is medium-term: normally about 10–20 trading sessions or longer when the structure persists.

---

# 2. Reconcile ETF guidance with the “no daily action pool” rule

The project must not restore a short-term `今日行动池`.

Instead, it publishes a **state-based ETF guidance book**.

A valid guidance state may remain unchanged for several trading days:

```text
ready_now
probe_only
wait_confirmation
wait_pullback
do_not_chase
invalid
```

Daily processing asks:

```text
Did the thesis change?
Did entry readiness change?
Did invalidation occur?
Did new evidence materially alter the position?
```

It does not ask:

```text
Who ranks first today?
What should be rotated into today?
```

---

# 3. Current data sufficiency decision

Current data is sufficient to launch an initial hard-model ETF guidance mode based on:

- representative A-share sector ETFs;
- persisted ETF OHLCVA history;
- exact-date CSI 300 benchmark proxy;
- 5-session and 20-session price structure;
- relative strength;
- turnover activity;
- volatility and extension;
- state persistence;
- exact-date review at T+1 / T+3 / T+5 / T+20;
- source reality, date alignment and Fail-Closed validation.

The following channels may still be incomplete:

- source-backed internal breadth;
- full independent ETF share-flow history for every sector;
- live valuation and fundamentals;
- complete global event-to-sector evidence mapping.

Incomplete channels do not block the first release. They reduce:

```text
confirmation_coverage
evidence_level
maximum entry state
```

Examples:

- breadth unavailable: cannot become `fully_confirmed`;
- direct flow unavailable: may be `probe_only` or `wait_confirmation`, not high-conviction `ready_now`;
- stale exact-date benchmark: `invalid`;
- current price history incomplete: `insufficient`.

---

# 4. Official ETF guidance pipeline

```text
market facts
  ↓
signed structural direction
  ↓
confirmation and coverage
  ↓
evidence trust
  ↓
risk / overheat / invalidation
  ↓
entry state
  ↓
candidate selection
  ↓
future review
```

No visible or hidden ordinal rank may feed back into this pipeline.

---

# 5. Structural assessment

For every canonical sector ETF produce:

```text
direction_score          [-100, 100]
confirmation_score       [0, 100]
confirmation_coverage    [0, 1]
evidence_score           [0, 100]
structure_state
marginal_change
persistence_sessions
risk_overlays
```

## Direction

Direction must preserve sign.

Inputs:

- risk-adjusted 5-session ETF return;
- risk-adjusted 20-session ETF return;
- 5-session excess return vs CSI 300;
- 20-session excess return vs CSI 300.

A large decline must reduce direction. It may increase review urgency, but never structural strength.

## Confirmation

Inputs:

- recent 5-session mean amount / 20-session mean amount;
- turnover activity trend;
- source-backed breadth when available;
- direct share-flow when available.

Volume confirms the existing direction:

- rising price + expanding volume supports strength;
- falling price + expanding volume supports weakness;
- low volume means unconfirmed;
- volume alone is not bullish.

## Evidence

Evidence measures trust, not strength.

It includes:

- direct mapping;
- price-history completeness;
- exact-date benchmark alignment;
- turnover-history completeness;
- breadth availability;
- source reality.

---

# 6. Structure states

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

Baseline rules remain those defined in the structural model contract.

Important product interpretation:

- `confirmed_trend` means a durable structure exists;
- it does not automatically mean buy now;
- `major_candidate` may offer a better entry than an overextended confirmed trend;
- `price_only` is never a buy state;
- `insufficient` cannot enter ETF guidance.

---

# 7. Entry guidance

## `ready_now`

Use when:

```text
structure_state is major_candidate or confirmed_trend
direction_score >= 30
confirmation_score >= 50
evidence_score >= 70
risk gate passes
no material conflict
current exact-date inputs are valid
not materially overextended
invalidation is measurable
```

Visible wording:

> 当前可进入买入评估

This is decision support, not an automatic order.

## `probe_only`

Use when the structure is credible but one important confirmation channel is incomplete or the structure is early.

Visible wording:

> 只适合试探仓

## `wait_confirmation`

Use when direction is positive but confirmation, coverage or persistence is insufficient.

Visible wording:

> 等待确认

## `wait_pullback`

Use when the structure is strong but entry quality is poor because of extension or short-term overheat.

Visible wording:

> 等待回撤

## `do_not_chase`

Use when short-term extension or volatility makes entry asymmetry unacceptable.

Visible wording:

> 不宜追入

## `invalid`

Use when:

- structural direction breaks;
- risk gate blocks;
- exact-date data is invalid;
- thesis invalidation condition occurs;
- evidence is insufficient for guidance.

Visible wording:

> 当前不成立

---

# 8. Candidate selection

FP must publish:

```text
primary_entry_candidate
secondary_entry_candidate
probe_only_candidates[]
waiting_candidates[]
do_not_chase_candidates[]
invalid_candidates[]
no_qualified_candidate
```

Selection process:

## Step 1 — Eliminate

Remove:

- `invalid`;
- `insufficient`;
- `deteriorating`;
- material conflict;
- blocked risk gate;
- stale / mixed-date input;
- severe overheat;
- no measurable invalidation.

## Step 2 — Identify entry-eligible rows

Only:

```text
ready_now
probe_only
```

can become primary or secondary candidates.

## Step 3 — Compare eligible rows

Compare:

1. entry quality;
2. structural persistence;
3. signed relative strength;
4. confirmation completeness;
5. distance from overheat;
6. invalidation distance;
7. evidence trust.

Do not publish a whole-universe ordinal ranking.

A primary candidate is optional.

When none pass:

```json
{
  "primary_entry_candidate": null,
  "secondary_entry_candidate": null,
  "no_qualified_candidate": true
}
```

---

# 9. User-facing answer

The homepage should lead with:

## 今日 ETF 买入指导

Example:

```text
首选候选：银行 ETF
入场状态：只适合试探仓
中期结构：主线候选
依据：
- 20日结构为正
- 相对沪深300持续改善
- 风险闸门通过

限制：
- 成交确认一般
- 内部扩散数据缺失

下一确认：
- 5日成交活跃度回升至1.0x以上
- 相对强度继续为正

失效：
- direction_score跌破0
- 相对强度连续转负
```

The page also shows:

```text
次选候选
等待确认
等待回撤
不宜追入
当前无合格对象
```

Do not display:

```text
第1名
第2名
排名上升
综合分最高
```

---

# 10. Guidance expiry

Every guidance row must include:

```text
guidance_as_of
valid_until
review_due
```

Guidance expires when:

- a new trading-session assessment is published;
- data becomes stale;
- invalidation occurs;
- the configured review horizon is reached without confirmation.

The frontend must not display old guidance as current.

---

# 11. Portfolio fit layer

The generic model selects the best ETF setup in the market.

A later private portfolio adapter answers:

- whether the user already has overlapping exposure;
- whether a new ETF increases concentration;
- position size;
- capital allocation;
- maximum loss and invalidation distance.

Personal holdings, cash balances and risk limits must not be committed into the public repository.

The public project should expose a local/private configuration interface such as:

```text
config/private/portfolio-profile.local.json
```

This path must be gitignored.

Until that layer exists, FP may guide:

```text
buy / probe / wait / avoid
```

but should not automatically calculate a personalized position size.

---

# 12. Replace `observe_only` boundary

Legacy wording:

```text
observe_only
not a buy list
```

must be migrated.

New official boundary:

```text
decision_support
no automated execution
medium-term ETF guidance
human confirmation required
```

Historical legacy files may retain their old boundary for audit, but new official artifacts and frontend wording use the new contract.

---

# 13. Official artifacts

## Structural assessment

```text
financial-pond/data/sector_assessment_daily.json
```

## ETF guidance

```text
financial-pond/data/entry_decision_daily.json
```

## Daily publication manifest

```text
financial-pond/data/daily_manifest.json
```

## Penetration brief

```text
financial-pond/data/market_penetration_brief.json
```

## Review analytics

```text
financial-pond/data/review_analytics.json
```

The frontend must read the manifest first.

---

# 14. Definition of done

FP must be able to answer:

```text
Which ETF is the current primary buying candidate?
Is it ready now, probe only, or waiting?
Why?
What contradicts the thesis?
What must happen next?
What invalidates it?
Is there no qualified ETF today?
```

It must demonstrate that:

- the answer is not produced from ordinal rank;
- a large fall cannot become a buy candidate because volatility is large;
- a strong but overextended ETF becomes `wait_pullback` or `do_not_chase`;
- missing confirmation visibly lowers guidance;
- no-candidate days are valid;
- all decisions are reviewable at T+1 / T+3 / T+5 / T+20;
- the same archived input reproduces the same substantive decision.

---

# 15. Codex execution instruction

Read these three files as one governing package:

```text
FP_COMMAND_ARCHITECTURE_AND_MODEL_GOVERNANCE_v0.10.78.md
CODEX_HANDOFF_FP_v0.10.78-80.md
FP_ETF_GUIDANCE_IMPLEMENTATION_DIRECTIVE_v0.10.78.md
```

Priority in case of conflict:

1. `FP_ETF_GUIDANCE_IMPLEMENTATION_DIRECTIVE_v0.10.78.md`
2. `FP_COMMAND_ARCHITECTURE_AND_MODEL_GOVERNANCE_v0.10.78.md`
3. `CODEX_HANDOFF_FP_v0.10.78-80.md`

Implement the command refactor and structural/entry model together.

Do not merge or deploy before the Draft PR is reviewed.
