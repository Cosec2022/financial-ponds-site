# Financial Model Alignment

This framework is not a single academic model. It is a graph structure that can host signals inspired by established models.

## Global Financial Cycle

Hélène Rey's global financial cycle suggests that global risk appetite, US monetary conditions, and dollar funding conditions influence cross-border asset prices. In this framework:

- `usd_liquidity`
- `us_real_rate`
- `dxy`
- `vix`

are upstream global nodes that can connect to many asset pools.

## BIS Global Liquidity

BIS global liquidity indicators focus on credit availability in global financial markets, especially foreign currency credit to non-bank borrowers. In this framework, BIS-style variables belong in upstream liquidity nodes and should connect broadly to risk assets.

## Flow of Funds

Federal Reserve Z.1 style flow-of-funds data tracks sectoral balance sheets and transactions. In this framework, long-horizon allocation nodes can be added as nodes or collectors without changing graph logic.

## Campbell-Shiller Present Value Logic

Equity values are affected by expected cash flows and discount rates. In this framework:

- cash-flow or earnings nodes connect to equity pools positively
- discount-rate nodes connect to long-duration assets negatively through configured edges

## Fama-French / Carhart Factors

Industry ETF scoring can add factor nodes such as market beta, value, size, profitability, investment, and momentum. These should be nodes connected to sector pools, not hardcoded formulas.

## Sector Rotation

Sector pools should inherit part of their parent market pool and add sector-specific flow, relative strength, earnings, and news nodes. This supports business-cycle sector rotation without forcing a fixed industry map into code.

## Brunnermeier-Pedersen Liquidity Spiral

Funding liquidity and market liquidity can reinforce each other. Future nodes such as margin debt, funding rates, open interest, bid-ask spread, and volatility should connect through leverage/risk channels.

## Black-Litterman Inspiration

The framework separates:

- hard data: market votes with money
- soft data: news and views about future expectations
- confirmation: price, volume, and breadth confirmation

This resembles Black-Litterman in spirit: start from observed market structure, then apply views with confidence levels. The first version stores this separation but does not perform portfolio optimization.
