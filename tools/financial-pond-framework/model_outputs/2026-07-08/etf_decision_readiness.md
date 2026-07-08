# ETF Decision Readiness 2026-07-08

暂不能指导买入 ETF：行业资金量价仍来自 mock、fixture 或未验证来源。

Guidance state: not_ready

| Rank | Sector | Readiness | Action | Blockers |
| --- | --- | ---: | --- | --- |
| 1 | A-share Brokerage Pool | 32 | 数据非真实，禁止指导 | non_real_flow_source, valuation_manual_seed, fundamental_manual_seed |
| 2 | A-share Bank and Insurance Pool | 32 | 数据非真实，禁止指导 | non_real_flow_source, valuation_manual_seed, fundamental_manual_seed |
| 3 | A-share Resources and Materials Pool | 32 | 数据非真实，禁止指导 | non_real_flow_source, valuation_manual_seed, fundamental_manual_seed |
| 4 | A-share Healthcare and Pharma Pool | 32 | 数据非真实，禁止指导 | non_real_flow_source, valuation_manual_seed, fundamental_manual_seed |
| 5 | A-share Consumer Pool | 32 | 数据非真实，禁止指导 | non_real_flow_source, valuation_manual_seed, fundamental_manual_seed |
| 6 | A-share AI and Computer Pool | 32 | 数据非真实，禁止指导 | non_real_flow_source, valuation_manual_seed, fundamental_manual_seed |
| 7 | A-share Defense and Military Pool | 32 | 数据非真实，禁止指导 | non_real_flow_source, valuation_manual_seed, fundamental_manual_seed |
| 8 | A-share Semiconductor Pool | 32 | 数据非真实，禁止指导 | non_real_flow_source, valuation_manual_seed, fundamental_manual_seed |
| 9 | A-share Communication and Electronics Pool | 32 | 数据非真实，禁止指导 | non_real_flow_source, valuation_manual_seed, fundamental_manual_seed |
| 10 | A-share New Energy Vehicle Pool | 32 | 数据非真实，禁止指导 | non_real_flow_source, valuation_manual_seed, fundamental_manual_seed |
| 11 | A-share Real Estate and Infrastructure Pool | 32 | 数据非真实，禁止指导 | non_real_flow_source, valuation_manual_seed, fundamental_manual_seed |
| 12 | A-share Home Appliances Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 13 | A-share Food and Beverage Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 14 | A-share Transportation Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 15 | A-share Machinery Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 16 | A-share Utilities Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 17 | A-share Coal Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 18 | A-share Nonferrous Metals Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 19 | A-share Petroleum and Petrochemical Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 20 | A-share Construction Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 21 | A-share Textile and Apparel Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 22 | A-share Light Manufacturing Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 23 | A-share Social Services Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 24 | A-share Environmental Protection Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 25 | A-share Agriculture Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 26 | A-share Beauty Care Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 27 | A-share Media Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 28 | A-share Basic Chemicals Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 29 | A-share Retail Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 30 | A-share Building Materials Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |
| 31 | A-share Steel Pool | 28 | 未接入代表ETF | no_representative_provider_mapping, non_real_flow_source, no_observed_direct_etf_flow, valuation_manual_seed, fundamental_manual_seed |

## Boundary

- ETF decision readiness is a gatekeeper. It can block guidance even when sector scores look strong.
- A buyable label requires observed ETF flow, enough rotation history, and acceptable valuation/fundamental context.
- manual_seed valuation or fundamental fields can structure thinking but cannot prove a live market bargain.
- The output is a checklist for human review, not an order to buy, sell, or allocate capital.
