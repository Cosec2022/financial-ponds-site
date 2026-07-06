# Maintenance Rules

Version: v0.10.15
Status: active

This file is the highest-level maintenance rule set for Financial Ponds.

## Project Purpose

Financial Ponds is an extensible financial analysis network.

Any market, sector, asset, theme, or user-defined watchlist can be added as a pond. Each pond is evaluated through:

```text
capital-flow signals
+ graph influence factors from upstream, downstream, and peer nodes
+ price-volume confirmation
+ news-pressure analysis
= pond state, rotation position, risk pressure, and explanation
```

The system must explain inflow, outflow, rotation, transmission, and risk pressure. It must not hardcode market-specific logic or turn model output into a trading instruction.

## Core Rules

1. Core engine code must stay market-agnostic.
   Add markets, sectors, assets, and themes through config, data, and graph definitions.

2. Hard data confirms. News pressures.
   News can create expectation pressure, catalyst, or risk context. News cannot prove capital flow.

3. The frontend displays and explains. It does not decide.
   UI code must not calculate financial logic or imply buy/sell instructions.

4. Data state must be explicit.
   Every visible data source or module state must be labeled as `real`, `fallback`, `demo`, `watchlist`, `prototype`, or `planned`.

5. Module names must be stable.
   Use `FP-AREA-Number`, for example `FP-FLOW-01`. Do not use pure numeric module names such as `FP-00`.

6. Every meaningful update must be recoverable.
   The package must include updated rules, plan, module plan, changelog, and progress registry.

7. Automation must not silently mutate model logic.
   Automation can collect data, generate outputs, and propose changes. It must not silently change scoring rules, graph weights, or investment conclusions.

8. GPT is a proposal layer.
   GPT may summarize, propose keywords, and propose graph updates. Hard data and explicit review confirm changes.

9. Historical outputs must remain reproducible.
   A dated result should be explainable from the input data, config, graph, scoring version, and module version.

10. Tests are part of the maintenance boundary.
    New formed modules need tests or explicit documented reason why no test is practical.

11. Every GPT update must include copyable terminal commands.
    The assistant must run the required validation before delivering the package. Each final update note should provide exact terminal commands the user can copy directly after downloading the delivered zip. Commands should start from the downloaded zip path, extract it, enter the extracted project, and run the relevant preview, deploy, or next manual action. User-facing commands should only repeat verification when the user asks for it or when it is materially useful.

## Forbidden Patterns

Do not add market-specific branches to core code:

```js
if (market === "A_SHARE") useSocialFinancing();
```

Do not let news directly set final scores:

```js
pool.score = newsSentiment;
```

Do not let the UI become the model:

```js
const buySignal = price > movingAverage && newsScore > 0.6;
```

Do not hide fallback data:

```text
fallback data displayed as real market data
```

## Required Module Marker

New source files for formed modules should include a short module marker:

```js
// FP-ROT-01 Sector Rotation Intelligence
// Input: sector_flow_review.json
// Output: sector_rotation_intelligence.json
// Boundary: explains relative rotation only; not a trading instruction.
```

For config or docs, use:

```text
Module: FP-ROT-01
Progress: working prototype
Boundary: single-day rotation is not trend confirmation
Next: add multi-day confirmation
```
