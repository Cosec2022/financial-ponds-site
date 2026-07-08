# Workbench UI Spec

## Panel

Preferred first panel: `观察工作台`.

Tabs:

- 今日观察
- 信号矩阵
- 资金矢量
- 复盘记录

## Tables

今日观察:

```text
Pool | Direction | Magnitude | Confidence | Watch State | Boundary
```

信号矩阵:

```text
Pool | Flow | Momentum | Liquidity | Rotation | News | Valuation | Fundamental | Risk
```

资金矢量:

```text
Pool | F | Direction | Magnitude | Velocity | Acceleration | Confidence | Boundary
```

复盘记录:

```text
Forecast Date | Pool | Direction | T+1 | T+3 | T+5 | T+20 | Status
```

## Trace Rule

Every visible metric should show either:

- `trace_id=...`
- `trace_status=...`

Missing traces render as `trace_status=missing` and must not crash the page.

## Boundary

The workbench is compact and layered. It avoids long explanatory paragraphs and
does not output execution instructions.
