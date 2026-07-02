# System Architecture Diagram

This diagram is the high-level engineering map for the project.

The core rule is:

```text
External data, news, user holdings, backtests, and UI must connect through stable interfaces.
They must not bypass or rewrite the graph engine.
```

```mermaid
flowchart TB
    subgraph EXT["External Inputs"]
        HD["Hard Data Sources\nFRED / HKEX / Binance / WGC / A-share / Macro"]
        NEWS["News Sources\nOfficial / RSS / Filings / Media / Sector News"]
        USER["User Inputs\nPortfolio / Holdings / Watchlists / Manual Views"]
    end

    subgraph COL["Collectors Layer"]
        HDC["Hard Data Collectors\nindependent programs"]
        NC["News Collectors\nindependent programs"]
        UL["User Input Loader\nindependent program"]
    end

    subgraph OBS["Observation Layer"]
        RAW["Raw Data Store"]
        NORM["Normalization / Mapping Layer\nraw -> observation"]
        OBSV["Node Observations\nnode_id / value / score / confidence /\navailable_at / source / reason"]
    end

    subgraph CORE["Core Graph / Model Engine\nmarket-agnostic core code"]
        NR["Node Registry"]
        ER["Edge Registry"]
        PR["Pool Registry"]
        RE["Regime Engine"]
        GE["Graph Engine"]
        SE["Scoring Engine"]
        LS["Layer Summary Engine"]
    end

    subgraph POOLS["Pool Layer"]
        GL["Global Macro / Global Liquidity"]
        US["US Equity Pool"]
        AS["A-share Pool"]
        BTC["BTC Pool"]
        GOLD["Gold Pool"]
        HK["HK Equity Pool (future)"]
        SEC1["Sector Pools\nSemis / Brokers / AI / Military / Consumer"]
    end

    subgraph ASSET["Asset / Portfolio Layer"]
        ETF["ETF / Index / Asset Layer"]
        PORT["User Portfolio Layer"]
    end

    subgraph OUT["Output Layer"]
        SNAP["Snapshots"]
        DASH["Dashboard Export"]
        REPORT["Human Report"]
        BT["Backtest Module"]
        WEB["Web Frontend / CosecLab Subpage"]
    end

    HD --> HDC
    NEWS --> NC
    USER --> UL

    HDC --> RAW
    NC --> RAW
    UL --> RAW

    RAW --> NORM
    NORM --> OBSV

    OBSV --> NR
    OBSV --> GE

    NR --> GE
    ER --> GE
    PR --> GE
    RE --> GE
    GE --> SE
    SE --> LS

    LS --> GL
    GL --> US
    GL --> AS
    GL --> BTC
    GL --> GOLD
    GL --> HK

    AS --> SEC1
    US --> SEC1
    HK --> SEC1

    SEC1 --> ETF
    US --> ETF
    AS --> ETF
    BTC --> ETF
    GOLD --> ETF
    HK --> ETF

    ETF --> PORT

    LS --> SNAP
    LS --> DASH
    LS --> REPORT
    LS --> BT

    DASH --> WEB
    SNAP --> WEB
    REPORT --> WEB
```

## Notes

- Hard data, news, and user holdings are independent input lanes.
- All lanes become node observations before entering the graph.
- The UI renders exported graph data. It does not calculate financial logic.
- Future backtests should consume historical observations and snapshots, not mutate core rules.
