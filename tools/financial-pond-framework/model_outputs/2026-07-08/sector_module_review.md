# Sector Module Review 2026-07-08

三模块已分离：1 个候选，5 个风险观察。当前优先观察 A-share Brokerage Pool：合理且改善。

| Rank | Sector | Valuation | Fundamental | Flow & Price | Decision |
| --- | --- | --- | --- | --- | --- |
| 1 | A-share Brokerage Pool | fair 0.08 | improving 0.12 | constructive_inflow_bias 0.2218 | 合理且改善 |
| 2 | A-share Bank and Insurance Pool | cheap -0.18 | stable 0.02 | outflow_watch -0.2014 | 便宜但未转强 |
| 3 | A-share Home Appliances Pool | cheap -0.16 | stable 0.1 | neutral 0 | 等待确认 |
| 4 | A-share Healthcare and Pharma Pool | cheap -0.28 | stable -0.04 | neutral 0.0441 | 等待确认 |
| 5 | A-share Food and Beverage Pool | cheap -0.12 | stable 0.06 | neutral 0 | 等待确认 |
| 6 | A-share Transportation Pool | cheap -0.14 | stable 0.04 | neutral 0 | 等待确认 |
| 7 | A-share Machinery Pool | fair 0 | stable 0.1 | neutral 0 | 等待确认 |
| 8 | A-share Utilities Pool | fair -0.02 | stable 0.08 | neutral 0 | 等待确认 |
| 9 | A-share Communication and Electronics Pool | expensive 0.22 | improving 0.18 | neutral 0.0601 | 等待确认 |
| 10 | A-share Coal Pool | fair -0.1 | stable 0.02 | neutral 0 | 等待确认 |
| 11 | A-share Nonferrous Metals Pool | fair 0.04 | improving 0.12 | neutral 0 | 等待确认 |
| 12 | A-share Petroleum and Petrochemical Pool | fair -0.06 | stable 0.04 | neutral 0 | 等待确认 |
| 13 | A-share Construction Pool | cheap -0.22 | weak -0.08 | neutral 0 | 等待确认 |
| 14 | A-share Textile and Apparel Pool | fair -0.1 | stable -0.02 | neutral 0 | 等待确认 |
| 15 | A-share Consumer Pool | cheap -0.24 | weak -0.06 | neutral -0.0541 | 等待确认 |
| 16 | A-share Light Manufacturing Pool | fair -0.04 | stable 0.02 | neutral 0 | 等待确认 |
| 17 | A-share Social Services Pool | fair -0.06 | stable 0 | neutral 0 | 等待确认 |
| 18 | A-share AI and Computer Pool | very_expensive 0.38 | improving 0.24 | neutral 0.0574 | 等待确认 |
| 19 | A-share Environmental Protection Pool | cheap -0.18 | weak -0.1 | neutral 0 | 等待确认 |
| 20 | A-share Resources and Materials Pool | fair -0.1 | stable 0 | neutral -0.0408 | 等待确认 |
| 21 | A-share Semiconductor Pool | very_expensive 0.42 | improving 0.2 | neutral 0.1001 | 等待确认 |
| 22 | A-share Agriculture Pool | fair 0.02 | stable -0.02 | neutral 0 | 等待确认 |
| 23 | A-share Beauty Care Pool | fair -0.02 | weak -0.06 | neutral 0 | 等待确认 |
| 24 | A-share Defense and Military Pool | fair 0.12 | stable 0.04 | neutral -0.0249 | 等待确认 |
| 25 | A-share Media Pool | expensive 0.18 | stable 0.04 | neutral 0 | 等待确认 |
| 26 | A-share New Energy Vehicle Pool | fair -0.08 | weak -0.18 | neutral -0.1363 | 等待确认 |
| 27 | A-share Basic Chemicals Pool | cheap -0.16 | weak -0.12 | neutral 0 | 便宜但基本面弱 |
| 28 | A-share Retail Pool | cheap -0.18 | weak -0.14 | neutral 0 | 便宜但基本面弱 |
| 29 | A-share Building Materials Pool | deep_discount -0.3 | deteriorating -0.3 | neutral 0 | 便宜但基本面弱 |
| 30 | A-share Steel Pool | cheap -0.24 | deteriorating -0.28 | neutral 0 | 便宜但基本面弱 |
| 31 | A-share Real Estate and Infrastructure Pool | deep_discount -0.35 | deteriorating -0.32 | neutral -0.0629 | 便宜但基本面弱 |

## Boundary

- The valuation module is independent from flow and price. It should not change because a sector rises today.
- The fundamental module is independent from short-term price action. It should change only after earnings, ROE, margin, policy transmission, order, inventory, or cycle evidence updates.
- The flow_price module is imported from sector_flow_review.json and keeps the existing ETF flow / price-volume logic.
- The decision label is a readable cross-tab, not a buy or sell instruction.
