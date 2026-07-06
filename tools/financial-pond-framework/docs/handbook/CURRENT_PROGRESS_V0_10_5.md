# Financial Ponds Site — Current Progress Registry v0.10.5

Date: 2026-07-05
Repo: `Cosec2022/financial-ponds-site`
Current package snapshot: `financial-ponds-site-reference-v0.10.5.zip`

This file supersedes `CURRENT_PROGRESS_V0_10_4.md` for the latest project state.

## Current goal

The project is still a personal financial model dashboard built around Financial Ponds.

The v0.10.5 update adds a readable A-share sector rotation intelligence layer on top of the existing sector flow review.

## Newly formed module

### FP-11 — A-share sector rotation intelligence

**Status:** formed / working prototype

**Scope:** translate `sector_flow_review.json` into human-readable rotation intelligence.

Key files:

```text
tools/financial-pond-framework/src/tools/sector_rotation_intelligence.mjs
tools/financial-pond-framework/tests/sector_rotation_intelligence.test.mjs
financial-pond/data/sector_rotation_intelligence.json
financial-pond/app.js
financial-pond/index.html
financial-pond/styles.css
```

Outputs:

```text
tools/financial-pond-framework/model_outputs/<date>/sector_rotation_intelligence.json
tools/financial-pond-framework/model_outputs/<date>/sector_rotation_intelligence.md
financial-pond/data/sector_rotation_intelligence.json
```

Frontend panel:

```text
行业轮动情报
```

It shows:

```text
- rotation state
- evidence level
- leaders
- laggards
- style clusters
- possible weak-to-strong switching paths
- watch points
```

## Current packaged reading

Using the packaged `2026-07-02` data:

```text
rotation_state: clear_rotation
evidence_level: hard_data_with_news_fixture
leaders: real_estate_infra, resources_materials, defense_military
laggards: brokerage, bank_insurance, semiconductor
```

Important:

```text
News is fixture/fallback in this package.
The rotation reading is based mainly on ETF-flow and price/volume confirmation.
It is a snapshot, not a multi-day trend.
```

## Pipeline status

The daily CI runner now runs:

```text
akshare_etf_snapshot
a_share_water_level_real or fixture fallback
akshare_validate
akshare_inspect
akshare_to_flow
water_level_to_observations
news_intelligence
sector_flow_review
sector_rotation_intelligence
```

GitHub Actions now publishes:

```text
financial-pond/data/dashboard.json
financial-pond/data/sector_flow_review.json
financial-pond/data/sector_rotation_intelligence.json
financial-pond/data/news_review.json
```

Worker asset embedding now includes:

```text
data/sector_rotation_intelligence.json
```

## Boundaries

```text
1. Rotation intelligence is not a trading instruction.
2. The module does not change sector-flow scores.
3. The module does not add a new external data provider.
4. The module does not treat fallback news as live news.
5. Single-day rotation is not yet trend confirmation.
6. Multi-day history should be the next step before stronger rotation conclusions.
```

## Next recommended order

```text
Next-1: Add multi-day sector history and persistence.
Next-2: Compare today vs previous trading day to label strengthening, weakening, reversal, or continuation.
Next-3: Feed rotation history into the frontend.
Next-4: Add real/fixed news source expansion.
Next-5: Implement adaptive keyword state engine.
```
