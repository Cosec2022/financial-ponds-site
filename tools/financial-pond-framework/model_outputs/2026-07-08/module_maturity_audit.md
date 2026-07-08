# Module Maturity Audit

- as_of: 2026-07-08
- average_progress: 45.65%
- decision_path_progress: 50.8%
- low_maturity_count: 6
- mainline: A股真实 Provider -> ETF 份额变化流

## Priority Modules

| Module | Progress | Urgency | Next |
|---|---:|---|---|
| FP-GEN-01 General Pool Analysis | 52% | critical_path | Surface provider-mapped vs framework-only coverage in the frontend |
| FP-NEWS-01 News Pressure Engine | 30% | near_term | Add fixed real sources and source-quality labels |
| FP-DATA-01 Hard Data Providers | 66% | later | Add valuation/fundamental real sources; S&P 500 provider second |
| FP-GPT-01 GPT Proposal Layer | 5% | weak_module | Add proposal schema and disabled-by-default runner |
| FP-POOL-01 Free Pond Expansion | 20% | weak_module | Define pond template and creation checklist |
| FP-PV-01 Price-Volume Analysis | 20% | weak_module | Add trend, divergence, volume expansion, and persistence |
| FP-RPT-01 Reports | 25% | weak_module | Add weekly report and proposal sections |

## Low Maturity Modules

| Module | Progress | Blockers |
|---|---:|---|
| FP-NEWS-01 News Pressure Engine | 30% | real_provider_gap |
| FP-GPT-01 GPT Proposal Layer | 5% | low_maturity |
| FP-POOL-01 Free Pond Expansion | 20% | low_maturity |
| FP-PV-01 Price-Volume Analysis | 20% | history_depth_gap, low_maturity |
| FP-RPT-01 Reports | 25% | low_maturity |
| FP-GRAPH-01 Influence Graph | 35% | history_depth_gap, backend_state_gap |
