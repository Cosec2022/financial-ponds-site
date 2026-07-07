# AKShare Provider Flow Observations

- as_of: 2026-07-07
- readiness: baseline_only
- source_rows: 11
- observations: 22
- flow_ready_rows: 0
- share_change_status: baseline_only
- share_change_rows: 0/11

## Boundary

- `estimated_flow` creates direct ETF-flow observations only when share-change data exists.
- Missing `estimated_flow` does not get filled with a fake flow value.
- ETF amount is mapped only as attention/confirmation heat.
- ETF pct_change is mapped only as a representative relative-strength proxy.

## Warnings

- No estimated_flow values are available. The converter emitted market-confirmation inputs only.

## Rows

| Sector | Fund | pct_change | amount | share_change | estimated_flow |
|---|---|---:|---:|---:|---:|
| ai_computer | 159819 | -0.3 | 629528489.712 |  |  |
| consumer | 159928 | -1.56 | 287305948.186 |  |  |
| brokerage | 512000 | -2.89 | 1437391954 |  |  |
| healthcare_pharma | 512010 | -3.54 | 677065095 |  |  |
| real_estate_infra | 512200 | -2.17 | 84885078 |  |  |
| resources_materials | 512400 | -3.32 | 917678780 |  |  |
| semiconductor | 512480 | 0.15 | 1699973250 |  |  |
| defense_military | 512660 | -3.12 | 326242776 |  |  |
| bank_insurance | 512800 | -0.13 | 1214082957 |  |  |
| new_energy_ev | 515030 | -0.87 | 149083623 |  |  |
| communication_electronics | 515880 | 0.53 | 5331025385 |  |  |
