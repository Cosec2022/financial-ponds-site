# Financial Ponds Site — Current Progress Registry v0.10.6

Date: 2026-07-05
Repo: `Cosec2022/financial-ponds-site`
Current package snapshot: `financial-ponds-site-reference-v0.10.6.zip`

This file supersedes `CURRENT_PROGRESS_V0_10_5.md` for the latest project state.

## Current Goal

Financial Ponds is an extensible financial analysis network.

Any market, sector, asset, theme, or user-defined watchlist can be added as a pond. Each pond is evaluated through:

```text
capital-flow signals
+ upstream / downstream / peer influence factors
+ price-volume analysis
+ news-pressure analysis
= pond state, rotation position, risk pressure, and explanation
```

The system explains inflow, outflow, rotation, transmission, relative strength, data confidence, and risk pressure. It does not output trading instructions.

## v0.10.6 Change

v0.10.6 is a maintenance-convergence update.

New active maintenance files:

```text
docs/MAINTENANCE_RULES.md
docs/UPDATE_PROTOCOL.md
docs/PROJECT_PLAN.md
docs/MODULE_PLAN.md
```

Module IDs now use:

```text
FP-AREA-Number
```

Examples:

```text
FP-CORE-01
FP-DATA-01
FP-FLOW-01
FP-GRAPH-01
FP-PV-01
FP-NEWS-01
FP-ROT-01
FP-UI-01
FP-RPT-01
FP-GPT-01
FP-TEST-01
FP-MAINT-01
FP-POOL-01
```

Do not create new pure numeric IDs such as `FP-00`.

## Current Overall Progress

```text
Overall progress: 36%
Current stage: usable prototype
Daily data pipeline: partial
Decision-grade model: not yet
Main limitation: single-day rotation, limited history, news still partly fallback
```

## Current Working Modules

| Module ID | Status | Notes |
|---|---|---|
| FP-CORE-01 | working | Core graph, registry, scoring, snapshots remain market-agnostic. |
| FP-DATA-01 | working with fallback | AKShare ETF snapshot and A-share water-level provider are available with fallback behavior. |
| FP-FLOW-01 | working prototype | Sector-flow review ranks 11 A-share sector ETF pools. |
| FP-GRAPH-01 | frontend prototype | Pond graph and local graph edit/export exist; backend state is pending. |
| FP-PV-01 | basic | Price/volume confirmation exists through relative strength and leader confirmation proxies. |
| FP-NEWS-01 | basic / fallback | News pressure exists; real fixed news sources are still pending. |
| FP-ROT-01 | working prototype | Single-day sector rotation intelligence is available. |
| FP-UI-01 | usable prototype | Frontend shows dashboard, rotation, pond map, graph feedback, and boundaries. |
| FP-RPT-01 | basic | Daily outputs exist; weekly review is pending. |
| FP-GPT-01 | planned | GPT proposal layer is not active. |
| FP-TEST-01 | working | Framework and Worker tests guard current behavior. |
| FP-MAINT-01 | working | Rules, update protocol, project plan, and module plan are active. |
| FP-POOL-01 | planned | Free pond creation workflow is not implemented yet. |

## Required Update Protocol

Every meaningful future update must record:

```text
Update version
Changed modules
Overall progress
Module progress
Code markers
Human-readable markers
Data boundary
Tests
Next step
```

## Current Boundaries

```text
1. Rotation intelligence is single-day snapshot only.
2. News can be fallback and must be treated as degraded context.
3. Electricity is a watchlist/demo pond, not a real ETF-backed sector.
4. UI local graph edits do not change backend configuration.
5. GPT weekly review is planned only.
6. No output is a trading instruction.
7. New modules must use FP-AREA-Number IDs.
```

## Next Recommended Order

```text
Next-1: FP-ROT-01 + FP-DATA-01 multi-day sector history.
Next-2: FP-PV-01 continuation / reversal / strengthening labels.
Next-3: FP-UI-01 trend panels.
Next-4: FP-NEWS-01 fixed real news sources.
Next-5: FP-GRAPH-01 backend edge state.
Next-6: FP-POOL-01 free pond creation workflow.
```
