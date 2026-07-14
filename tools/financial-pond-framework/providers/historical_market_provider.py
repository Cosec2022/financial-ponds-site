#!/usr/bin/env python3
"""FP-HIST-MKT-01 shared, fail-closed historical ETF daily-bar provider."""
from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Callable


@dataclass
class HistoricalBar:
    instrument_type: str
    symbol: str
    exchange: str
    trade_date: str | None
    open: float | None = None
    high: float | None = None
    low: float | None = None
    close: float | None = None
    volume: float | None = None
    amount: float | None = None
    source_provider: str | None = None
    source_endpoint: str | None = None
    fallback_used: bool = False
    fetched_at: str | None = None
    as_of: str | None = None
    status: str = "unavailable"
    missing_fields: list[str] | None = None
    error_chain: list[str] | None = None
    requested_as_of: str | None = None
    date_fallback_used: bool = False
    fallback_reason: str | None = None

    def payload(self) -> dict[str, Any]:
        return asdict(self)


def exchange_for(symbol: str) -> str:
    return "SH" if str(symbol).startswith(("5", "6")) else "SZ"


def sina_symbol(symbol: str) -> str:
    return f"{'sh' if exchange_for(symbol) == 'SH' else 'sz'}{symbol}"


def get_etf_daily_bar(*, symbol: str, as_of: str, allow_previous_trading_day: bool = False,
                      sources: list[str] | None = None, akshare_module: Any = None) -> dict[str, Any]:
    """Return one normalized historical bar; never silently admits a future row."""
    sources = sources or ["fund_etf_hist_em", "fund_etf_hist_sina", "eastmoney_exact_date"]
    errors: list[str] = []
    ak = akshare_module
    if ak is None:
        try:
            import akshare as ak  # type: ignore
        except Exception as error:  # pragma: no cover - runtime dependency boundary
            return unavailable(symbol, as_of, [f"AKShare import failed: {type(error).__name__}: {error}"])
    for source in sources:
        for attempt in range(1, 4):
            try:
                raw = fetch_source(ak, source, symbol, as_of)
                row = select_row(raw, as_of, allow_previous_trading_day)
                if row is None:
                    raise RuntimeError("no acceptable historical row")
                return normalize(row, symbol, as_of, source, allow_previous_trading_day, errors)
            except Exception as error:  # retain every provider failure for audit
                errors.append(f"{source} attempt {attempt}: {type(error).__name__}: {error}")
    return unavailable(symbol, as_of, errors)


def fetch_source(ak: Any, source: str, symbol: str, as_of: str) -> Any:
    compact = as_of.replace("-", "")
    if source == "fund_etf_hist_em":
        return ak.fund_etf_hist_em(symbol=symbol, period="daily", start_date=compact, end_date=compact, adjust="")
    if source == "fund_etf_hist_sina":
        return ak.fund_etf_hist_sina(symbol=sina_symbol(symbol))
    if source == "eastmoney_exact_date":
        # Shared bounded reader used by the configured benchmark path. It is a
        # fallback adapter, not a separately counted market source.
        import requests
        compact = as_of.replace("-", "")
        secid = f"{1 if exchange_for(symbol) == 'SH' else 0}.{symbol}"
        response = requests.get("https://push2his.eastmoney.com/api/qt/stock/kline/get", params={
            "fields1": "f1,f2,f3,f4,f5,f6", "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f116",
            "ut": "7eea3edcaed734bea9cbfc24409ed989", "klt": "101", "fqt": "0", "beg": compact, "end": compact, "secid": secid
        }, timeout=15)
        response.raise_for_status(); klines = response.json().get("data", {}).get("klines") or []
        return [{"date": parts[0], "open": parts[1], "close": parts[2], "high": parts[3], "low": parts[4], "volume": parts[5], "amount": parts[6]} for line in klines for parts in [line.split(",")]]
    raise RuntimeError(f"unsupported source {source}")


def records(raw: Any) -> list[dict[str, Any]]:
    if hasattr(raw, "to_dict"):
        return raw.to_dict("records")
    if isinstance(raw, list):
        return raw
    raise RuntimeError("provider returned unsupported table")


def select_row(raw: Any, as_of: str, allow_previous: bool) -> dict[str, Any] | None:
    candidates = []
    for row in records(raw):
        date = date_value(row)
        if date and date <= as_of:
            candidates.append((date, row))
    exact = [row for date, row in candidates if date == as_of]
    if exact:
        return exact[-1]
    if allow_previous and candidates:
        return sorted(candidates, key=lambda item: item[0])[-1][1]
    return None


def date_value(row: dict[str, Any]) -> str | None:
    value = first(row, "日期", "date", "日期时间", "trade_date")
    if value is None:
        return None
    text = str(value)[:10].replace("/", "-")
    return text if len(text) == 10 else None


def first(row: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in row and row[key] not in (None, "", "-"):
            return row[key]
    return None


def number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None


def normalize(row: dict[str, Any], symbol: str, as_of: str, source: str, allow_previous: bool,
              errors: list[str]) -> dict[str, Any]:
    trade_date = date_value(row)
    if not trade_date or trade_date > as_of:
        return unavailable(symbol, as_of, errors + [f"future or invalid trade date {trade_date}"])
    fallback = trade_date != as_of
    missing = [key for key, value in {
        "open": number(first(row, "开盘", "open")), "high": number(first(row, "最高", "high")),
        "low": number(first(row, "最低", "low")), "close": number(first(row, "收盘", "close")),
        "volume": number(first(row, "成交量", "volume"))
    }.items() if value is None]
    close = number(first(row, "收盘", "close"))
    if close is None or close <= 0:
        return unavailable(symbol, as_of, errors + ["invalid close"])
    endpoint = source
    return HistoricalBar("etf", symbol, exchange_for(symbol), trade_date,
        number(first(row, "开盘", "open")), number(first(row, "最高", "high")), number(first(row, "最低", "low")), close,
        number(first(row, "成交量", "volume")), number(first(row, "成交额", "amount")),
        "akshare", endpoint, source != "fund_etf_hist_em", datetime.now(timezone.utc).isoformat(), as_of,
        "ok", missing, errors, as_of, fallback, "market_closed" if fallback and allow_previous else None).payload()


def unavailable(symbol: str, as_of: str, errors: list[str]) -> dict[str, Any]:
    return HistoricalBar("etf", symbol, exchange_for(symbol), None, source_provider="akshare", as_of=as_of,
        status="unavailable", missing_fields=["open", "high", "low", "close", "volume", "amount"],
        error_chain=errors, requested_as_of=as_of).payload()
