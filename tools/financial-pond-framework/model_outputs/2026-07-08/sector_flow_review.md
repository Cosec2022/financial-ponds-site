# A-share Sector Flow Review

- as_of: 2026-07-08
- model_id: flow_engine_v0_9
- scenario_id: none
- sectors: 31

## Rules

- This review ranks relative sector-flow pressure.
- It does not write to core graph scores.
- External pressure only modifies the review; domestic market data must confirm it.

## Data Availability

- mode: etf_flow_ready
- headline: ETF flow and price-volume confirmation are available for 11/11 representative sectors; observed-source direct flow 11/11, observed-source confirmation 11/11.
- representative_direct_flow_inputs: 11/11
- representative_price_volume_confirmations: 11/11

## Ranking

| Rank | Pool | Score | Label | Confidence | Data completeness |
|---:|---|---:|---|---:|---:|
| 1 | a_share_semiconductor | 0.342 | constructive_inflow_bias | 0.747 | 0.900 |
| 2 | a_share_healthcare_pharma | 0.290 | constructive_inflow_bias | 0.747 | 0.900 |
| 3 | a_share_bank_insurance | 0.141 | neutral | 0.747 | 0.900 |
| 4 | a_share_communication_electronics | 0.133 | neutral | 0.747 | 0.900 |
| 5 | a_share_ai_computer | 0.112 | neutral | 0.747 | 0.900 |
| 6 | a_share_agriculture | 0.066 | neutral | 0.333 | 0.250 |
| 7 | a_share_food_beverage | 0.066 | neutral | 0.333 | 0.250 |
| 8 | a_share_home_appliances | 0.066 | neutral | 0.333 | 0.250 |
| 9 | a_share_textile_apparel | 0.066 | neutral | 0.333 | 0.250 |
| 10 | a_share_light_manufacturing | 0.066 | neutral | 0.333 | 0.250 |
| 11 | a_share_retail | 0.066 | neutral | 0.333 | 0.250 |
| 12 | a_share_social_services | 0.066 | neutral | 0.333 | 0.250 |
| 13 | a_share_beauty_care | 0.066 | neutral | 0.333 | 0.250 |
| 14 | a_share_transportation | 0.066 | neutral | 0.333 | 0.250 |
| 15 | a_share_utilities | 0.066 | neutral | 0.333 | 0.250 |
| 16 | a_share_environmental_protection | 0.066 | neutral | 0.333 | 0.250 |
| 17 | a_share_petroleum_petrochemical | 0.066 | neutral | 0.333 | 0.250 |
| 18 | a_share_coal | 0.066 | neutral | 0.333 | 0.250 |
| 19 | a_share_steel | 0.066 | neutral | 0.333 | 0.250 |
| 20 | a_share_nonferrous_metals | 0.066 | neutral | 0.333 | 0.250 |
| 21 | a_share_basic_chemicals | 0.066 | neutral | 0.333 | 0.250 |
| 22 | a_share_building_materials | 0.066 | neutral | 0.333 | 0.250 |
| 23 | a_share_construction | 0.066 | neutral | 0.333 | 0.250 |
| 24 | a_share_machinery | 0.066 | neutral | 0.333 | 0.250 |
| 25 | a_share_media | 0.066 | neutral | 0.333 | 0.250 |
| 26 | a_share_brokerage | 0.003 | neutral | 0.747 | 0.900 |
| 27 | a_share_consumer | -0.002 | neutral | 0.747 | 0.900 |
| 28 | a_share_defense_military | -0.003 | neutral | 0.747 | 0.900 |
| 29 | a_share_real_estate_infra | -0.042 | neutral | 0.747 | 0.900 |
| 30 | a_share_new_energy_ev | -0.086 | neutral | 0.747 | 0.900 |
| 31 | a_share_resources_materials | -0.138 | neutral | 0.747 | 0.900 |

## Top Drivers

- a_share_semiconductor: direct_flow: 0.181; policy_sentiment: 0.060; market_confirmation: 0.060; market_liquidity: 0.026
- a_share_healthcare_pharma: direct_flow: 0.225; policy_sentiment: 0.030; market_liquidity: 0.026; fundamental_proxy: 0.025
- a_share_bank_insurance: direct_flow: 0.056; market_confirmation: 0.028; market_liquidity: 0.026; policy_sentiment: 0.025
- a_share_communication_electronics: market_confirmation: 0.057; policy_sentiment: 0.030; market_liquidity: 0.026; fundamental_proxy: 0.020
- a_share_ai_computer: market_confirmation: 0.059; policy_sentiment: 0.035; direct_flow: -0.034; market_liquidity: 0.026
