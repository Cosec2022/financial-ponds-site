# Module Maturity Audit

- as_of: 2026-07-08
- average_progress: 42.43%
- decision_path_progress: 50.8%
- low_maturity_count: 10
- mainline: A股真实 Provider -> ETF 份额变化流

## Priority Modules

| Module | Progress | Urgency | Next |
|---|---:|---|---|
| FP-EXPLAIN-01 Index Explainability | 25% | critical_path | Expand formula registry as more UI indexes become clickable |
| FP-GATE-01 Decision Gate Ledger | 25% | near_term | Clear valuation/fundamental, data reality, conflict-review, and execution-language blockers |
| FP-WATCH-01 Watchlist State Machine | 30% | near_term | Add persistence-aware unchanged/upgraded/downgraded behavior after more daily samples |
| FP-ATTR-01 Signal Attribution | 35% | near_term | Add richer attribution weights and history-aware explanations |
| FP-GEN-01 General Pool Analysis | 52% | later | Surface provider-mapped vs framework-only coverage in the frontend |
| FP-NEWS-01 News Pressure Engine | 30% | later | Add fixed real sources and source-quality labels |
| FP-DATA-01 Hard Data Providers | 66% | later | Add valuation/fundamental real sources; S&P 500 provider second |
| FP-GPT-01 GPT Proposal Layer | 5% | weak_module | Add proposal schema and disabled-by-default runner |

## Low Maturity Modules

| Module | Progress | Blockers |
|---|---:|---|
| FP-EXPLAIN-01 Index Explainability | 25% | low_maturity |
| FP-GATE-01 Decision Gate Ledger | 25% | real_provider_gap, low_maturity |
| FP-WATCH-01 Watchlist State Machine | 30% | none |
| FP-ATTR-01 Signal Attribution | 35% | history_depth_gap |
| FP-NEWS-01 News Pressure Engine | 30% | real_provider_gap |
| FP-GPT-01 GPT Proposal Layer | 5% | low_maturity |
| FP-POOL-01 Free Pond Expansion | 20% | low_maturity |
| FP-PV-01 Price-Volume Analysis | 20% | history_depth_gap, low_maturity |
| FP-RPT-01 Reports | 25% | low_maturity |
| FP-GRAPH-01 Influence Graph | 35% | history_depth_gap, backend_state_gap |
