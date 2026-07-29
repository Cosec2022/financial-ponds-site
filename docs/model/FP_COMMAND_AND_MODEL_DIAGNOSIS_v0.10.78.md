# Financial Ponds command and model diagnosis

**Baseline:** `origin/main` at `c2cf109`  
**Diagnosed:** 2026-07-29 HKT  
**Package version:** `0.10.77`  
**Latest committed published date:** `2026-07-28`

## Executive diagnosis

The current production path is two overlapping systems. The framework performs provider collection, graph calculation, pool analysis, state/readiness generation, and web export. Root scripts then transform the exported files into a second observation-score, candidate-state, review, archive, and frontend system. Neither layer owns one complete official contract. The homepage treats a review-priority score and Top-10 order as sector strength.

The current system is reproducible enough to supply an initial signed model—committed ETF OHLCVA and exact-date 510300 benchmark history contain 60 sessions through 2026-07-28—but its conclusions are not safe to migrate unchanged.

## Current command graph and duplicate execution

`package.json` defines:

- `build` → `scripts/build.sh` → `scripts/local/fp-daily.sh` → `scripts/build-site.sh`. A build therefore mutates daily data and history before producing Worker assets.
- `fp:daily` → `scripts/local/fp-daily.sh`, a root-only transform/archive/review chain.
- `fp:today` → `scripts/local/fp-today-full-update.sh`, which pulls `main`, may install providers, calls live providers, runs framework models, copies optional outputs, invokes `build` (therefore invokes `fp:daily`), validates/tests, stages with `git add .`, commits, and pushes `main` (`scripts/local/fp-today-full-update.sh:18-136`).
- `deploy` builds the site and deploys without validating the official daily publication contract.

`.github/workflows/daily.yml` has one `collect-build-deploy` job. Its framework step calls `a-share:daily:ci` and then repeats `pool:analysis`, `data:vault`, `daily:sector-analysis`, `signal:attribution`, `watchlist:state`, `decision:gates`, `project:maturity`, `index:explain`, and `observation:snapshot`. `a-share:daily:ci` already calls most of those stages (`tools/financial-pond-framework/src/tools/a_share_daily_ci.mjs:19-175`). The workflow then calls root `fp:daily`, builds AI research, builds, validates, tests, commits broad generated paths, and deploys.

Within root `fp:daily`, `archive-observation-snapshot.mjs` executes twice (`scripts/local/fp-daily.sh:16,29`). `data:vault` executes twice in both framework CI and the workflow’s repeated framework commands. The workflow’s `npm run build:site` is pure, but `npm run build` is not.

## Stage ownership today

| Concern | Current commands/files | Diagnosis |
| --- | --- | --- |
| Collect | Framework provider scripts and `a_share_daily_ci.mjs:19-98`; market-history Python backfill in the workflow | Network, fixture fallback, normalization, model work, and publication are combined. |
| Normalize/transform | `akshare_flow_observations.mjs`, `a_share_water_observations.mjs`, `build-pool-instrument-map.mjs`, `build-market-signal-channel.mjs` | No single canonical identity/date contract. |
| Observe | Framework flow/rotation/module tools; root flow, market, breadth and delta builders | Several partially overlapping observation products. |
| Score/state | Framework graph/general-pool/readiness tools; root evening score, candidate state, sector panel | Multiple de facto conclusions and incompatible semantics. |
| Publish | Workflow `cp`; local `copy_if_exists`; `build-assets.mjs` static file list | Required files can remain from an earlier run. No current-day manifest. |
| Archive/review | Root observation archives, longitudinal archives, candidate outcomes/analytics | Mostly exact-session aware, but archives are Top-10/candidate shaped rather than a full canonical assessment universe. |

Current de facto sources of truth are `evening_observation_summary.json` / `pool_observation_scores.json` for observation priority, `candidate_state_model.json` for right-side labels, `sector_observation_panel.json` for the primary frontend table, and `market_penetration_brief.json` for narrative. Framework files such as `general_pool_analysis.json`, `daily_sector_analysis.json`, `etf_decision_readiness.json`, `sector_watchlist_state.json`, and `decision_gate_ledger.json` are generated and copied but are not the main frontend’s structural source.

All files under `financial-pond/data`, `financial-pond/data/history`, `tools/financial-pond-framework/model_outputs`, `worker/assets.js`, and `dist` are generated artifacts. They must be changed through source generators only.

## Exact legacy observation formula and ordering

`scripts/build-evening-observation-summary.mjs:92-143` calculates:

```text
flow_score =
  flow available ? 10 + min(vector_magnitude, 1) × 8 : 0

momentum_score =
  momentum available ? 6 + min(abs(daily_pct_change) / 3, 1) × 6 : 0

liquidity_score =
  liquidity available ? (cross-sectional label == above_median ? 10 : 6) : 0

quality_score =
  evidence-quality reward + (direct mapping ? 8 : 0)

delta_score = reward(delta review flag)
confidence_score = round(mean(capped market confidences) × 16)
proxy_penalty =
  proxy-risk penalty + (broad proxy ? 6 : 0)

missing_data_penalty =
  10 × unavailable(flow, momentum, liquidity)
  + 4 when a market confidence cap applies
  + 8 for insufficient history
  + 20 for unmapped/unavailable mapping

observation_score =
  clamp[0,100](
    flow_score + momentum_score + liquidity_score
    + quality_score + delta_score + confidence_score
    - proxy_penalty - missing_data_penalty
  )
```

Because momentum uses `abs`, an equal-sized large rise and fall receive the same positive momentum component. Evidence quality, direct mapping, availability, confidence, proxy status, and missingness are mixed into the same number as market movement.

Rows sort by (`scripts/build-evening-observation-summary.mjs:23-28`):

1. descending `observation_score`;
2. descending `capped_confidence`;
3. descending `canonicalWeight`;
4. lexical `pool_id`.

Equal analytical values therefore become forced ordinal positions. The panel preserves index-derived rank and computes `rank_change` (`scripts/lib/sector-observation-panel.mjs:57-108,223-278`). A score move of ±2.5 **or rank move of ±2** directly produces strengthening/weakening (`scripts/lib/sector-observation-panel.mjs:181-210`). Display/order changes can therefore change model-facing marginal status.

The candidate-state model also uses ranking and Top-10 persistence in overheat calculation (`scripts/build-candidate-state-model.mjs:121-168`) and mixes mapping/evidence/availability/confidence with momentum in `major_wave_score` (`:171-194`).

## Turnover mismatch

The score’s liquidity component is a cross-sectional current absolute-amount label (`build-evening-observation-summary.mjs:103`). The sector panel and frontend describe turnover activity as the representative ETF’s amount divided by its own 20-session mean (`scripts/lib/sector-observation-panel.mjs:313-321,357-364,453`). These are different quantities presented as if they confirm the same conclusion.

## Identity, stale fallback, and degraded conclusions

`build-pool-instrument-map.mjs:36` maps every snapshot row and only strips one `a_share_` from `sector_id` (`:139-141`). The committed map has 67 rows and 31 semantic pairs such as `a_share_ai_computer` and `a_share_a_share_ai_computer`. Those duplicates also reach the 67-row observation-score file; publication-time `uniqueSemantic` only hides duplicates in the Top 10 (`build-evening-observation-summary.mjs:33-35`) after scores and tier counts have already been calculated.

Stale-file reuse can occur because:

- `fp:today` uses `copy_if_exists` for model outputs (`scripts/local/fp-today-full-update.sh:79-102`), leaving an existing destination untouched when a current source is absent.
- `build-assets.mjs` embeds a static list without a current-day manifest or cross-artifact date/version validation.
- the frontend loads 21 conclusion/data files concurrently with per-file fallbacks (`financial-pond/app.js:841-887`), rather than loading and validating a manifest first.
- framework exact-date benchmark collection is allowed to fail (`a_share_daily_ci.mjs:35-40`), while the same runner may substitute fixture water-level data and continue to formal conclusions (`:42-57`).
- local `fp:today` records several model failures as noncritical and can continue to publication.

The frontend detects a stale penetration brief (`financial-pond/app.js:725-733`) but does not fail closed on stale structural conclusions. The current `2026-07-28` committed data is aligned; only `2026-07-13` has a committed replay-input manifest, so later formal output is not yet replay-contract complete.

## Review and archive behavior

Candidate outcomes preserve previously reviewed rows and require candidate/benchmark archive values for an effective review date (`scripts/build-candidate-outcome-reviews.mjs:39,245-323`). Statuses distinguish pending, reviewed, unavailable, and skipped. This useful exact-session logic should be retained. However, candidate history originates from `top_observation_pools` and visible-candidate ledgers, not the complete canonical assessment universe. `fp:daily` also archives the same observation snapshot twice.

## Existing validation and tests

Root tests use Node’s test runner (`tests/*.test.mjs`); framework tests combine Python unittest and Node tests. Current validators are `validate`, `validate:data`, and `validate:history-quality`. Several current validators explicitly require `observe_only`, old candidate states, observation scores, ranks, and the old panel contract (`scripts/validate-published-data.mjs:78-115,230-332`), so those assertions must migrate rather than be weakened.

The refactor must retain exact-date review safeguards and source-reality checks while replacing the official score/rank conclusions with signed direction, confirmation, evidence, structural state, entry decision, full-universe persistence, and a manifest-first publication gate.
