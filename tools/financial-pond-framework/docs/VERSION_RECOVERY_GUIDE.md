# Version Recovery Guide

This file exists because the project may be resumed from an old zip.

If a future assistant or engineer receives only this package, read these files first:

1. `PROJECT_STATE.md`
2. `docs/PROJECT_MEMORY.md`
3. `docs/MODULE_STATUS.md`
4. `docs/ROADMAP.md`
5. `docs/CHANGELOG.md`
6. `README.md`
7. `docs/MODEL_INTENT.md`
8. `docs/ARCHITECTURE.md`
9. `docs/INVARIANTS.md`
10. `docs/REWRITE_GUIDE.md`
11. `docs/SYSTEM_ARCHITECTURE_DIAGRAM.md`
12. `docs/FINANCIAL_POND_MODEL.md`
13. `docs/DATA_SOURCE_STRATEGY.md`
14. `docs/DATA_INGESTION_V0_7.md`
15. `docs/NEWS_INTELLIGENCE_MODEL.md`

## Current Version

Package version: `0.7.0`

Main additions after v0.3:

- standalone `PROJECT_STATE.md` recovery checkpoint
- formal Mermaid diagrams
- data source strategy
- news intelligence model
- news event schema
- collector source configs
- node layer config
- pool internal model config
- normalization profiles
- collection cycle command
- twice-daily scheduler command
- project memory, roadmap, and changelog files
- regime rule config and regime summary output
- search-based news collector skeleton
- local CSV and HTTP JSON collector skeletons
- source status report command

## Recovery Rule

If files are missing, rebuild from the documented contracts:

- all external inputs become observations
- hard data and news collectors are independent
- AI never directly sets final pool score
- pool internals are closed and documented
- graph engine remains market-agnostic
