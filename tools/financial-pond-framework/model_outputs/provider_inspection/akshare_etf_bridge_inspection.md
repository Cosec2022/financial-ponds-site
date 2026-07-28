# AKShare ETF Bridge Inspection

- Status: `ok`
- As of: `2026-07-28`
- Overall recommendation: `review_candidates_before_enabling`
- Enable candidates: `3`

## Warnings

- semiconductor_etf_flow should remain disabled: estimated_flow is missing
- ai_computer_etf_flow should remain disabled: estimated_flow is missing
- communication_electronics_etf_flow should remain disabled: estimated_flow is missing
- new_energy_ev_etf_flow should remain disabled: estimated_flow is missing
- healthcare_pharma_etf_flow should remain disabled: estimated_flow is missing
- consumer_etf_flow should remain disabled: estimated_flow is missing
- defense_military_etf_flow should remain disabled: estimated_flow is missing
- resources_materials_etf_flow should remain disabled: estimated_flow is missing

## Source Recommendations

| Node | Sector | Fund | Recommendation | Reason |
|---|---|---|---|---|
| `brokerage_etf_flow` | `brokerage` | `512000` | `candidate_for_manual_review` | Latest row has positive price, positive amount, and non-empty estimated_flow. |
| `bank_insurance_etf_flow` | `bank_insurance` | `512800` | `candidate_for_manual_review` | Latest row has positive price, positive amount, and non-empty estimated_flow. |
| `semiconductor_etf_flow` | `semiconductor` | `512480` | `keep_disabled` | estimated_flow is missing |
| `ai_computer_etf_flow` | `ai_computer` | `159819` | `keep_disabled` | estimated_flow is missing |
| `communication_electronics_etf_flow` | `communication_electronics` | `515880` | `keep_disabled` | estimated_flow is missing |
| `new_energy_ev_etf_flow` | `new_energy_ev` | `515030` | `keep_disabled` | estimated_flow is missing |
| `healthcare_pharma_etf_flow` | `healthcare_pharma` | `512010` | `keep_disabled` | estimated_flow is missing |
| `consumer_etf_flow` | `consumer` | `159928` | `keep_disabled` | estimated_flow is missing |
| `defense_military_etf_flow` | `defense_military` | `512660` | `keep_disabled` | estimated_flow is missing |
| `resources_materials_etf_flow` | `resources_materials` | `512400` | `keep_disabled` | estimated_flow is missing |
| `real_estate_infra_etf_flow` | `real_estate_infra` | `512200` | `candidate_for_manual_review` | Latest row has positive price, positive amount, and non-empty estimated_flow. |

## Ranked By Amount

| Fund | Name | Sector | Amount | Estimated Flow |
|---|---|---|---:|---:|
| `515880` | Communication ETF candidate | `communication_electronics` | 3,726,539,620.00 |  |
| `512480` | Semiconductor ETF candidate | `semiconductor` | 1,422,672,548.00 |  |
| `512000` | 券商ETF华宝 | `brokerage` | 718,314,157.00 | 0.00 |
| `512800` | 银行ETF华宝 | `bank_insurance` | 662,628,972.00 | 0.00 |
| `512400` | Non-ferrous metals ETF candidate | `resources_materials` | 652,674,373.00 |  |
| `159819` | AI ETF candidate | `ai_computer` | 593,506,028.99 |  |
| `159928` | Consumer ETF candidate | `consumer` | 262,948,123.87 |  |
| `512010` | Healthcare ETF candidate | `healthcare_pharma` | 255,931,265.00 |  |
| `512660` | Defense ETF candidate | `defense_military` | 209,884,755.00 |  |
| `512200` | 房地产ETF南方 | `real_estate_infra` | 194,397,257.00 | 0.00 |
| `515030` | New energy vehicle ETF candidate | `new_energy_ev` | 116,672,569.00 |  |

## Ranked By Estimated Flow

| Fund | Name | Sector | Estimated Flow | Amount |
|---|---|---|---:|---:|
| `512000` | 券商ETF华宝 | `brokerage` | 0.00 | 718,314,157.00 |
| `512800` | 银行ETF华宝 | `bank_insurance` | 0.00 | 662,628,972.00 |
| `512200` | 房地产ETF南方 | `real_estate_infra` | 0.00 | 194,397,257.00 |
