# Module Maturity Audit

- as_of: 2026-07-07
- average_progress: 44.94%
- decision_path_progress: 48.4%
- low_maturity_count: 7
- mainline: A股真实 Provider -> ETF 份额变化流

## Priority Modules

| Module | Progress | Urgency | Next |
|---|---:|---|---|
| FP-HIST-01 Sector Rotation History | 42% | critical_path | Add explicit continuation/reversal labels |
| FP-NEWS-01 News Pressure Engine | 30% | near_term | Add fixed real sources and source-quality labels |
| FP-DAILY-01 Daily Sector Analysis | 40% | near_term | Add continuation/reversal labels after more history accumulates |
| FP-GEN-01 General Pool Analysis | 52% | near_term | Surface provider-mapped vs framework-only coverage in the frontend |
| FP-DATA-01 Hard Data Providers | 62% | later | A-share provider history first; S&P 500 provider second |
| FP-GPT-01 GPT Proposal Layer | 5% | weak_module | Add proposal schema and disabled-by-default runner |
| FP-POOL-01 Free Pond Expansion | 20% | weak_module | Define pond template and creation checklist |
| FP-PV-01 Price-Volume Analysis | 20% | weak_module | Add trend, divergence, volume expansion, and persistence |

## Low Maturity Modules

| Module | Progress | Blockers |
|---|---:|---|
| FP-NEWS-01 News Pressure Engine | 30% | real_provider_gap |
| FP-GPT-01 GPT Proposal Layer | 5% | low_maturity |
| FP-POOL-01 Free Pond Expansion | 20% | low_maturity |
| FP-PV-01 Price-Volume Analysis | 20% | history_depth_gap, low_maturity |
| FP-RPT-01 Reports | 25% | low_maturity |
| FP-GRAPH-01 Influence Graph | 35% | history_depth_gap, backend_state_gap |
| FP-ETF-01 ETF Decision Readiness | 38% | manual_or_seed_input, history_depth_gap |
