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

The official daily command runs collect once, the deterministic model once, and publish once. Builds read published files only. Git persistence and deployment remain separate. GitHub Actions enforces dependent collect → model → validate → persist → deploy jobs.

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

- `npm test`: 63 tests passed after migration.
- `npm run validate:data`: 56 published-file contracts passed.
- `npm run validate:history-quality`: strict OHLCVA/benchmark history passed; breadth remains explicitly unavailable.
- `npm run build`: pure site/Worker build passed.
- `npm run validate`: Worker ESM/fetch contract passed.
- `npm run fp:replay -- --as-of 2026-07-28`: substantive decision match `true`.
- Build-purity hash before/after: identical.
- Browser runtime QA: manifest validated, official files loaded in manifest order, no console warnings/errors, no-candidate desktop and responsive layout rendered.

## Known limitations

- Source-backed constituent breadth is unavailable.
- Independent ETF share-flow history is unavailable.
- The official universe intentionally uses the 11 directly represented ETF sectors in committed OHLCVA history; legacy broad/loose proxy expansions are not promoted into formal guidance.
- New structural/entry review cohorts start with this model version; previously reviewed legacy outcomes remain preserved rather than rewritten.
- The offline publication date is the latest committed exact-date input, not the wall-clock date.
- Live collection behavior is implemented but was not executed during development.
