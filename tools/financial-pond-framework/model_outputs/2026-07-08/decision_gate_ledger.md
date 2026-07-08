# Decision Gate Ledger 2026-07-08

Guidance state: not_ready
Execution state: blocked

Decision gate ledger: 3 block, 2 warn; provider gates pass but execution remains blocked; guidance_state=not_ready.

Readiness explanation only. Not a trading instruction.

| Gate | Status | Reading | Next action |
| --- | --- | --- | --- |
| Provider run | pass | Real provider run is present for the selected date. | Keep the provider run in the daily path. |
| Provider history | pass | Provider history must include current and previous dates for share-change flow. | Maintain provider CSV history across daily runs. |
| Estimated-flow coverage | pass | 11/11 representative rows have estimated_flow. | Regenerate provider flow observations if coverage drops. |
| True-flow coverage | pass | True-flow coverage is 1. | Keep representative ETF mappings and provider observations complete. |
| Attribution conflicts | warn | 1 attribution conflict(s) require review. | Resolve or annotate attribution conflicts before relaxing readiness. |
| Watchlist conflict review | warn | 1 watchlist row(s) are in conflict_review. | Review conflict rows before changing model thresholds. |
| Confirmed watch rows | pass | 1 confirmed_watch row(s) are available. | Keep confirmed rows separate from conflict and single-line evidence rows. |
| Valuation and fundamental reality | block | Valuation or fundamental modules still depend on manual seed inputs. | Connect reviewed valuation and fundamental sources. |
| Rotation visibility | pass | Rotation sample depth is 4/3. | Continue daily history accumulation. |
| Pool graph snapshot | pass | Graph snapshot is available for pool-level explanation. | Run cycle before pool analysis if the snapshot is absent. |
| Data reality audit | block | Data reality still contains non-real, mixed, or manual layers. | Remove or label non-real layers before execution language can unlock. |
| Execution language safety | block | Current guidance_state is not_ready; execution language remains blocked. | Only change this gate after all blocker gates pass. |
