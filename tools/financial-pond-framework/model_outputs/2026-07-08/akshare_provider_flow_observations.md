# AKShare Provider Flow Observations

- as_of: 2026-07-08
- readiness: flow_ready
- source_rows: 11
- observations: 33
- flow_ready_rows: 11
- share_change_status: flow_ready
- share_change_rows: 11/11
- provider_dates: 2026-07-07, 2026-07-08
- previous_available_date: 2026-07-07

## Boundary

- `estimated_flow` creates direct ETF-flow observations only when share-change data exists.
- Missing `estimated_flow` does not get filled with a fake flow value.
- ETF amount is mapped only as attention/confirmation heat.
- ETF pct_change is mapped only as a representative relative-strength proxy.

## Rows

| Sector | Fund | pct_change | amount | share_change | estimated_flow |
|---|---|---:|---:|---:|---:|
| ai_computer | 159819 | 1.84 | 807496409.361 | -42000128 | -86184262.656 |
| consumer | 159928 | -0.79 | 240678474.244 | -40000000 | -25000000 |
| brokerage | 512000 | -1.3 | 1253277254 | 0 | 0 |
| healthcare_pharma | 512010 | -1.41 | 516761665 | 0 | 0 |
| real_estate_infra | 512200 | 0.51 | 78165826 | 0 | 0 |
| resources_materials | 512400 | -2.94 | 797936585 | 0 | 0 |
| semiconductor | 512480 | 0.22 | 1945067169 | 0 | 0 |
| defense_military | 512660 | -2.01 | 277735779 | 0 | 0 |
| bank_insurance | 512800 | 1.45 | 785232565 | 0 | 0 |
| new_energy_ev | 515030 | -5.29 | 171662510 | -4000000 | -6880000 |
| communication_electronics | 515880 | -0.53 | 4810678792 | -998000128 | -755486096.896 |
