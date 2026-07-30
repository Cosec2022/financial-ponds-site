# Financial Ponds structure and entry implementation report

**Implemented:** 2026-07-29 HKT

## Architecture change

Before:

```text
framework provider + graph/model/export
  → repeated workflow model commands
  → root observation score / Top 10 / rank state
  → optional file copies
  → frontend parallel-loads legacy conclusions
  → broad generated-data commit
  → deploy
```

After:

```text
collect
  → normalize
  → observe
  → assess
  → penetrate
  → decide
  → review
  → persist
  → validate
  → publish
```

The official daily command runs collect once, the deterministic model once, and publish once. Builds read published files only. Git persistence and deployment remain separate. GitHub Actions enforces dependent collect → model → validate → persist → deploy jobs for scheduled/manual runs and a separate offline-only pull-request validation job.

## Command ownership

| Command | Ownership |
| --- | --- |
| `fp:collect` | Explicit live, historical, or offline acquisition and replay-input archive only |
| `fp:normalize` | Canonical representative ETF universe, duplicate/future rejection, exact-date alignment |
| `fp:observe` | Independent price, relative-strength, turnover, direct-flow, breadth, risk, and narrative-boundary channels |
| `fp:assess` | Only structural-state generator; signed direction, confirmation, evidence, persistence, risk, marginal change |
| `fp:penetrate` | Display-only fact/narrative artifact; cannot alter hard fields |
| `fp:decide` | Entry states, explanations, elimination, optional primary/secondary, valid no-candidate output |
| `fp:review` | T+1/T+3/T+5/T+20 exact-session review contract and legacy reviewed-summary preservation |
| `fp:persist` | Idempotent full-universe official history |
| `fp:publish` | Validated manifest whitelist only |
| `fp:model` | No-network normalize-through-validate model run |
| `fp:daily` | Collect once → model once → publish once |
| `fp:replay` | Archived inputs only; substantive equality check |
| `fp:audit` | Read-only official-bundle audit |
| `fp:today` | Hong Kong live daily run, pure build, validate, and test; no Git or deployment |

## Artifact migration

| Legacy role | New official role |
| --- | --- |
| `pool_observation_scores.json` mixed review-priority score | Legacy diagnostic only; cannot influence official outputs |
| `candidate_state_model.json` rank/quality-mixed right-side state | `sector_assessment_daily.json` |
| `etf_decision_readiness.json` framework readiness | `entry_decision_daily.json` |
| parallel direct frontend loads | `daily_manifest.json` first, then its declared artifacts |
| candidate/Top-10 history | full representative canonical universe in `history/assessments` and `history/decisions` |
| `candidate_review_analytics.json` | preserved legacy summary plus `review_analytics.json` migration contract |

The v0.10.78 publication validator routes date alignment by artifact schema. The
official `market-penetration-v1` artifact follows `daily_manifest.json`, the
publication source of truth. Pre-v0.10.78 legacy penetration artifacts remain
aligned to `history/latest_observation_pointer.json`. Both paths require exact
date equality; the migration does not permit stale fallback or mixed-date
publication.

## Pre-merge review follow-up

The accepted v0.10.78 architecture received four contract corrections before merge. The hard-model and command revisions are now `fp-structure-v0.10.78.2` and `fp-command-v0.10.78.2`; the manifest schema revision is `fp-daily-v0.10.78.2`.

- Pull requests into `main` run a read-only, offline job using committed inputs. A pure build first creates the Worker output required by Worker tests on a clean runner; the job then runs tests, Worker validation, published-data validation, history-quality validation, and the exact 2026-07-28 replay. Provider acquisition, Git persistence, secrets, push, and deployment are unreachable from the PR event.
- Positive and waiting candidates keep thesis/support/contrary/next-confirmation/future-invalidation fields. Invalid, deteriorating, conflict, price-only, insufficient, and avoid rows instead publish the current failure, failed gates, watch-recovery requirements, and entry-recovery requirements. Already-triggered failures are not described as future invalidations.
- Marginal change persists price-direction, relative-direction, confirmation-score, turnover-confirmation, breadth, and direct-flow component deltas. Missing breadth/direct flow remain unavailable with `change=null`; rank and display order are absent.
- Structural and entry review rows are built from archived full-universe artifacts, the explicit A-share trading calendar, and exact ETF/benchmark closes at T+1/T+3/T+5/T+20. Reviewed outcomes are preserved idempotently.

The first official 2026-07-28 cohort contains 44 structural plus 44 entry rows, all pending because no future exact-date input exists in the committed snapshot. Dedicated later-date fixtures demonstrate reviewed, unavailable, skipped, and preserved-reviewed outcomes.

## State examples

- Large decline with high turnover: negative signed direction; turnover confirms weakness; structural state deteriorating; entry invalid.
- Large one-day rise without medium-term, relative, or activity support: price-only; not confirmed.
- Credible positive structure with incomplete breadth/direct flow: wait-confirmation or probe-only; never high-conviction ready-now solely from price.
- Strong but overextended structure: wait-pullback or do-not-chase.
- No eligible ETF: primary and secondary are null and `no_qualified_candidate=true`.

## Published offline example

The committed replay snapshot is `2026-07-28`, mode `offline`, with 11 representative canonical sector ETFs.

- Structural states: 5 deteriorating, 2 major-candidate, 2 conflict-review, 1 watch-candidate, 1 price-only.
- Entry states: 3 wait-confirmation, 8 invalid.
- Primary candidate: null.
- Secondary candidate: null.
- No qualified candidate: true.
- Degraded channels: source-backed breadth and independent ETF share flow.

## Validation record

- `node --test tests/fp-structural-entry.test.mjs tests/fp-review-builder.test.mjs tests/workflow.test.mjs`: 29 focused tests passed.
- `npm test`: 74 tests passed, 0 failed.
- `npm run validate:data`: 56 published-file contracts passed.
- `npm run validate:history-quality`: strict OHLCVA/benchmark history passed; breadth remains explicitly unavailable.
- `npm run build`: pure site/Worker build passed.
- `npm run validate`: Worker ESM/fetch contract passed.
- `npm run fp:replay -- --as-of 2026-07-28`: substantive decision match `true`.
- Build-purity hash before/after: identical.
- Ruby YAML parse of `.github/workflows/daily.yml`: valid.
- Browser runtime QA: manifest validated; invalid rows rendered current failure and recovery requirements; the review panel rendered 88 pending rows; no console warnings/errors.

## Known limitations

- Source-backed constituent breadth is unavailable.
- Independent ETF share-flow history is unavailable.
- The official universe intentionally uses the 11 directly represented ETF sectors in committed OHLCVA history; legacy broad/loose proxy expansions are not promoted into formal guidance.
- The first new structural/entry cohort is pending until later exact-session ETF, benchmark, assessment, and decision artifacts exist; previously reviewed outcomes remain preserved rather than rewritten.
- The offline publication date is the latest committed exact-date input, not the wall-clock date.
- Live collection behavior is implemented but was not executed during development.
