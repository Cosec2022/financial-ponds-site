# Financial Ponds Site - Current Progress Registry v0.10.32

Updated: 2026-07-07

Current package snapshot: `financial-ponds-site-reference-v0.10.32.zip`

## v0.10.32 Change

v0.10.32 hardens `FP-HIST-01` Sector Rotation History.

A real daily run showed the history chain could fall back to:

```text
2026-07-02
2026-07-07
```

which made:

```text
sample_days: 2
trend_state: insufficient_history
priority_watch: 0
```

The new recovery logic lets the history runner read recent committed versions of:

```text
financial-pond/data/sector_rotation_history.json
```

and merge all historical `history[]` snapshots by `as_of`.

## Changed Files

```text
.github/workflows/daily.yml
README.md
package.json
tests/workflow.test.mjs
tools/financial-pond-framework/package.json
tools/financial-pond-framework/src/tools/sector_rotation_history.mjs
tools/financial-pond-framework/tests/sector_rotation_history.test.mjs
tools/financial-pond-framework/docs/CHANGELOG.md
tools/financial-pond-framework/docs/PROJECT_PLAN.md
tools/financial-pond-framework/docs/MODULE_PLAN.md
tools/financial-pond-framework/PROJECT_STATE.md
tools/financial-pond-framework/docs/handbook/CURRENT_PROGRESS_V0_10_32.md
```

## Workflow Guard

GitHub Actions checkout now uses:

```yaml
fetch-depth: 30
```

This is required because the recovery code reads recent Git versions of the
published history file.

## Recovery Boundary

The recovery logic does not create synthetic market days.

It can only recover snapshots that were already committed in recent Git history.
If a trading day was never published, it remains missing.

## Tests

Added regression coverage:

```text
sector rotation history recovery merges history days from multiple published payloads
```

Expected behavior:

```text
current damaged history: 2026-07-02, 2026-07-06
older committed history: 2026-07-02, 2026-07-03
recovered history: 2026-07-02, 2026-07-03, 2026-07-06
trend_state: trend_confirmed
```

## Validation

Run before package handoff:

```text
cd tools/financial-pond-framework && npm test
npm run validate:data
npm run build
npm run validate
npm test
zip integrity check
```

## Next Step After Push

Run `Financial Ponds Daily` manually.

Then check:

```bash
node -e "const h=require('./financial-pond/data/sector_rotation_history.json'); console.log({
sample_days:h.sample_days,
trend_state:h.trend_state,
leaders:h.trend_confirmations?.persistent_leaders,
history:h.history?.map(d=>d.as_of),
recovery:h.history_recovery
})"
```

If recent Git history contains the missing published day, `sample_days` should
recover and `daily_sector_analysis.priority_watch` can populate again.
