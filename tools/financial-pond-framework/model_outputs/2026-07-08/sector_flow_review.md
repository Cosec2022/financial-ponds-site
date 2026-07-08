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
| 1 | a_share_brokerage | 0.222 | constructive_inflow_bias | 0.225 | 0.550 |
| 2 | a_share_semiconductor | 0.100 | neutral | 0.225 | 0.550 |
| 3 | a_share_communication_electronics | 0.060 | neutral | 0.225 | 0.550 |
| 4 | a_share_ai_computer | 0.057 | neutral | 0.225 | 0.550 |
| 5 | a_share_healthcare_pharma | 0.044 | neutral | 0.225 | 0.550 |
| 6 | a_share_agriculture | 0.000 | neutral | 0.000 | 0.000 |
| 7 | a_share_food_beverage | 0.000 | neutral | 0.000 | 0.000 |
| 8 | a_share_home_appliances | 0.000 | neutral | 0.000 | 0.000 |
| 9 | a_share_textile_apparel | 0.000 | neutral | 0.000 | 0.000 |
| 10 | a_share_light_manufacturing | 0.000 | neutral | 0.000 | 0.000 |
| 11 | a_share_retail | 0.000 | neutral | 0.000 | 0.000 |
| 12 | a_share_social_services | 0.000 | neutral | 0.000 | 0.000 |
| 13 | a_share_beauty_care | 0.000 | neutral | 0.000 | 0.000 |
| 14 | a_share_transportation | 0.000 | neutral | 0.000 | 0.000 |
| 15 | a_share_utilities | 0.000 | neutral | 0.000 | 0.000 |
| 16 | a_share_environmental_protection | 0.000 | neutral | 0.000 | 0.000 |
| 17 | a_share_petroleum_petrochemical | 0.000 | neutral | 0.000 | 0.000 |
| 18 | a_share_coal | 0.000 | neutral | 0.000 | 0.000 |
| 19 | a_share_steel | 0.000 | neutral | 0.000 | 0.000 |
| 20 | a_share_nonferrous_metals | 0.000 | neutral | 0.000 | 0.000 |
| 21 | a_share_basic_chemicals | 0.000 | neutral | 0.000 | 0.000 |
| 22 | a_share_building_materials | 0.000 | neutral | 0.000 | 0.000 |
| 23 | a_share_construction | 0.000 | neutral | 0.000 | 0.000 |
| 24 | a_share_machinery | 0.000 | neutral | 0.000 | 0.000 |
| 25 | a_share_media | 0.000 | neutral | 0.000 | 0.000 |
| 26 | a_share_defense_military | -0.025 | neutral | 0.225 | 0.550 |
| 27 | a_share_resources_materials | -0.041 | neutral | 0.225 | 0.550 |
| 28 | a_share_consumer | -0.054 | neutral | 0.225 | 0.550 |
| 29 | a_share_real_estate_infra | -0.063 | neutral | 0.225 | 0.550 |
| 30 | a_share_new_energy_ev | -0.136 | neutral | 0.225 | 0.550 |
| 31 | a_share_bank_insurance | -0.201 | outflow_watch | 0.225 | 0.550 |

## Top Drivers

- a_share_brokerage: direct_flow: 0.202; market_confirmation: 0.020
- a_share_semiconductor: market_confirmation: 0.059; direct_flow: 0.041
- a_share_communication_electronics: market_confirmation: 0.060; direct_flow: 0.000
- a_share_ai_computer: market_confirmation: 0.057; direct_flow: 0.000
- a_share_healthcare_pharma: direct_flow: 0.081; market_confirmation: -0.037
