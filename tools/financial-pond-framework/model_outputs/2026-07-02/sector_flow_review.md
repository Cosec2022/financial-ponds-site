# A-share Sector Flow Review

- as_of: 2026-07-02
- model_id: flow_engine_v0_9
- scenario_id: global_tech_selloff_example
- sectors: 31

## Rules

- This review ranks relative sector-flow pressure.
- It does not write to core graph scores.
- External pressure only modifies the review; domestic market data must confirm it.

## Data Availability

- mode: mock_only
- headline: Sector components are populated from mock or fixture sources; do not read this as live market evidence.
- representative_direct_flow_inputs: 11/11
- representative_price_volume_confirmations: 11/11

## Ranking

| Rank | Pool | Score | Label | Confidence | Data completeness |
|---:|---|---:|---|---:|---:|
| 1 | a_share_brokerage | 0.342 | constructive_inflow_bias | 0.917 | 1.000 |
| 2 | a_share_ai_computer | 0.264 | constructive_inflow_bias | 0.944 | 1.000 |
| 3 | a_share_semiconductor | 0.216 | constructive_inflow_bias | 0.944 | 1.000 |
| 4 | a_share_defense_military | 0.215 | constructive_inflow_bias | 0.833 | 0.900 |
| 5 | a_share_communication_electronics | 0.192 | neutral | 0.944 | 1.000 |
| 6 | a_share_healthcare_pharma | 0.152 | neutral | 0.950 | 1.000 |
| 7 | a_share_bank_insurance | 0.151 | neutral | 0.950 | 1.000 |
| 8 | a_share_resources_materials | 0.135 | neutral | 0.833 | 0.900 |
| 9 | a_share_consumer | 0.082 | neutral | 0.950 | 1.000 |
| 10 | a_share_agriculture | 0.066 | neutral | 0.333 | 0.250 |
| 11 | a_share_food_beverage | 0.066 | neutral | 0.333 | 0.250 |
| 12 | a_share_home_appliances | 0.066 | neutral | 0.333 | 0.250 |
| 13 | a_share_textile_apparel | 0.066 | neutral | 0.333 | 0.250 |
| 14 | a_share_light_manufacturing | 0.066 | neutral | 0.333 | 0.250 |
| 15 | a_share_retail | 0.066 | neutral | 0.333 | 0.250 |
| 16 | a_share_social_services | 0.066 | neutral | 0.333 | 0.250 |
| 17 | a_share_beauty_care | 0.066 | neutral | 0.333 | 0.250 |
| 18 | a_share_transportation | 0.066 | neutral | 0.333 | 0.250 |
| 19 | a_share_utilities | 0.066 | neutral | 0.333 | 0.250 |
| 20 | a_share_environmental_protection | 0.066 | neutral | 0.333 | 0.250 |
| 21 | a_share_petroleum_petrochemical | 0.066 | neutral | 0.333 | 0.250 |
| 22 | a_share_coal | 0.066 | neutral | 0.333 | 0.250 |
| 23 | a_share_steel | 0.066 | neutral | 0.333 | 0.250 |
| 24 | a_share_nonferrous_metals | 0.066 | neutral | 0.333 | 0.250 |
| 25 | a_share_basic_chemicals | 0.066 | neutral | 0.333 | 0.250 |
| 26 | a_share_building_materials | 0.066 | neutral | 0.333 | 0.250 |
| 27 | a_share_construction | 0.066 | neutral | 0.333 | 0.250 |
| 28 | a_share_machinery | 0.066 | neutral | 0.333 | 0.250 |
| 29 | a_share_media | 0.066 | neutral | 0.333 | 0.250 |
| 30 | a_share_new_energy_ev | -0.047 | neutral | 0.917 | 1.000 |
| 31 | a_share_real_estate_infra | -0.116 | neutral | 0.833 | 0.900 |

## Top Drivers

- a_share_brokerage: direct_flow: 0.165; market_confirmation: 0.087; policy_sentiment: 0.043; market_liquidity: 0.026
- a_share_ai_computer: direct_flow: 0.135; market_confirmation: 0.075; policy_sentiment: 0.035; external_factor_effect: -0.033
- a_share_semiconductor: direct_flow: 0.090; market_confirmation: 0.067; policy_sentiment: 0.060; external_factor_effect: -0.042
- a_share_defense_military: direct_flow: 0.075; market_confirmation: 0.046; policy_sentiment: 0.038; fundamental_proxy: 0.030
- a_share_communication_electronics: direct_flow: 0.090; market_confirmation: 0.058; external_factor_effect: -0.033; policy_sentiment: 0.030
