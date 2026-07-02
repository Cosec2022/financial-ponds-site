# Provider Lab v0.8

Provider Lab compares external data libraries before any source is enabled in
the model.

## Commands

```bash
npm run provider:efinance:probe
npm run provider:qstock:probe
npm run providers:compare:a-share-etf
```

Offline fixture commands:

```bash
npm run provider:efinance:probe:fixture
npm run provider:qstock:probe:fixture
```

## Purpose

The project should not trust one provider blindly. Provider Lab records whether
each library can supply the fields needed for A-share industry ETF analysis:

- `close`
- `pct_change`
- `amount`
- `volume`
- `turnover`
- representative ETF coverage
- industry-board coverage
- concept-board coverage

## Provider Roles

- `AKShare`: primary source for ETF quote and ETF share fields.
- `efinance`: quote backup for ETF close, amount, pct_change, volume, and
  turnover-style fields.
- `qstock`: structure probe for ETF quote coverage, industry boards, and
  concept boards.

## Output Files

```text
model_outputs/provider_probes/efinance_a_share_etf_quote_probe.json
model_outputs/provider_probes/qstock_a_share_structure_probe.json
model_outputs/provider_comparison/a_share_etf_provider_comparison.json
model_outputs/provider_comparison/a_share_etf_provider_comparison.md
```

## Boundary

Provider Lab does not:

- modify `src/core`
- enable collector sources
- produce final investment scores
- replace AKShare ETF share data

Provider Lab only reports provider capability and disagreement.

## Next Step

After real probes run successfully, review
`model_outputs/provider_comparison/a_share_etf_provider_comparison.md`.

Only after manual review should a later version enable quote proxy observations
such as ETF amount change, ETF return, or cross-provider quote confidence.
