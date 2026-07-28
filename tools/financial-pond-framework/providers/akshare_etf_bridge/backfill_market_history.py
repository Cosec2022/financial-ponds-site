#!/usr/bin/env python3
"""Backfill verifiable ETF and benchmark OHLCVA history through the existing provider boundary.

AKShare remains the primary adapter. A bounded curl request to the same
Eastmoney kline endpoint is used only when the local Python TLS stack cannot
complete the AKShare request. Rows are accepted only for exact benchmark trade
dates at or before the requested Daily `AS_OF` cutoff.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

from export_a_share_etf_daily import dataframe_records, load_akshare_module, read_json
from persist_daily_etf_history import (
    OHLCVA_FIELDS,
    SNAPSHOT_UPDATE_FIELDS,
    complete_valid_bar,
)


BRIDGE_ID = "market_history_backfill_v0_10_77"
ENDPOINT = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
CORE_FIELDS = OHLCVA_FIELDS
CSV_FIELDS = [
    "date", "trade_date", "sector_id", "sector_node_id", "fund_code", "fund_name",
    "open", "high", "low", "close", "volume", "amount", "pct_change", "turnover",
    "latest_share", "previous_share", "share_change", "estimated_flow",
    "source_provider", "source_endpoint", "provider_run_id", "collected_at",
    "historical_input", "backfill_source_provider", "backfill_source_endpoint",
    "retrieved_at", "backfilled_at", "cutoff_date"
]
AKSHARE_UNAVAILABLE_REASON: str | None = None


def main() -> int:
    args = parse_args()
    root = Path(args.root_dir).resolve()
    contract = read_json(Path(args.contract).resolve() if args.contract else Path(__file__).with_name("provider_contract.json"))
    cutoff = args.end_date
    retrieved_at = args.retrieved_at or datetime.now(timezone.utc).isoformat()
    start_date = (datetime.fromisoformat(cutoff).date() - timedelta(days=max(args.calendar_days, 120))).isoformat()
    fetcher = fetch_history
    run_report_path = root / "model_outputs" / "provider_runs" / f"market_history_backfill_{cutoff}.json"
    csv_path = root / "data" / "provider_exports" / "a_share_etf_daily.csv"
    benchmark_path = root / "data" / "provider_exports" / "a_share_benchmark_daily.json"

    status: dict[str, Any] = {
        "module_id": BRIDGE_ID,
        "status": "started",
        "cutoff_date": cutoff,
        "target_trade_days": args.target_trade_days,
        "retrieved_at": retrieved_at,
        "backfilled_at": retrieved_at,
        "source_provider": "akshare/eastmoney",
        "warnings": [],
        "errors": [],
    }
    try:
        benchmark_symbol = str(contract["benchmark"]["symbol"])
        benchmark_rows, benchmark_diag = fetcher(benchmark_symbol, start_date, cutoff)
        benchmark_rows = valid_rows(benchmark_rows, cutoff)
        expected_dates = sorted({row["trade_date"] for row in benchmark_rows})[-args.target_trade_days:]
        if len(expected_dates) < args.target_trade_days:
            raise RuntimeError(
                f"Benchmark {benchmark_symbol} returned only {len(expected_dates)}/{args.target_trade_days} exact trade dates"
            )
        expected_set = set(expected_dates)
        benchmark_target = [row for row in benchmark_rows if row["trade_date"] in expected_set]
        if len(benchmark_target) != args.target_trade_days:
            raise RuntimeError("Benchmark contains duplicate or incomplete target dates")

        existing_rows = read_csv(csv_path)
        incoming_rows: list[dict[str, Any]] = []
        diagnostics: list[dict[str, Any]] = []
        for item in contract["representative_etfs"]:
            code = str(item["fund_code"])
            rows, diag = fetcher(code, start_date, cutoff)
            accepted = [row for row in valid_rows(rows, cutoff) if row["trade_date"] in expected_set]
            for row in accepted:
                incoming_rows.append(history_csv_row(row, item, cutoff, retrieved_at, diag))
            observed = sorted({row["trade_date"] for row in accepted})
            diagnostics.append({
                "instrument_code": code,
                "sector_id": item["sector_id"],
                "source_provider": diag["source_provider"],
                "source_endpoint": diag["source_endpoint"],
                "status": "complete" if observed == expected_dates else ("partial" if observed else "unavailable"),
                "expected_trade_days": len(expected_dates),
                "observed_trade_days": len(observed),
                "missing_dates": sorted(expected_set - set(observed)),
                "latest_date": observed[-1] if observed else None,
            })
            time.sleep(0.75)

        merged = merge_history(existing_rows, incoming_rows, cutoff)
        write_csv(csv_path, merged)
        merged_benchmark = merge_benchmark(
            read_json_or(benchmark_path, {}),
            benchmark_target,
            cutoff,
            retrieved_at,
            benchmark_diag
        )
        write_json(benchmark_path, merged_benchmark)

        status.update({
            "status": "complete" if all(item["status"] == "complete" for item in diagnostics) else "partial",
            "start_date": expected_dates[0],
            "end_date": expected_dates[-1],
            "expected_trade_dates": expected_dates,
            "benchmark": {
                "instrument_code": benchmark_symbol,
                "status": "complete",
                "observed_trade_days": len(benchmark_target),
                "source_provider": benchmark_diag["source_provider"],
                "source_endpoint": benchmark_diag["source_endpoint"],
            },
            "instruments": diagnostics,
            "records_written_or_enriched": len(incoming_rows),
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "outputs": {
                "etf_history_csv": str(csv_path.relative_to(root)),
                "benchmark_history_json": str(benchmark_path.relative_to(root)),
                "run_report_json": str(run_report_path.relative_to(root)),
            },
        })
        write_json(run_report_path, status)
        print(json.dumps(status, ensure_ascii=False, indent=2))
        return 0 if status["status"] in {"complete", "partial"} else 2
    except Exception as error:  # noqa: BLE001 - provider boundary must report and fail closed.
        status.update({
            "status": "unavailable",
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "errors": [f"{type(error).__name__}: {error}"],
        })
        write_json(run_report_path, status)
        print(json.dumps(status, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root-dir", default=Path(__file__).resolve().parents[2])
    parser.add_argument("--contract")
    parser.add_argument("--end-date", default=default_end_date())
    parser.add_argument("--target-trade-days", type=int, default=60)
    parser.add_argument("--calendar-days", type=int, default=150)
    parser.add_argument("--retrieved-at")
    return parser.parse_args()


def default_end_date() -> str:
    return os.environ.get("AS_OF") or datetime.now(ZoneInfo("Asia/Hong_Kong")).date().isoformat()


def fetch_history(symbol: str, start_date: str, end_date: str) -> tuple[list[dict[str, Any]], dict[str, str]]:
    global AKSHARE_UNAVAILABLE_REASON
    errors: list[str] = []
    if AKSHARE_UNAVAILABLE_REASON is None:
        try:
            ak = load_akshare_module()
            raw = ak.fund_etf_hist_em(
                symbol=symbol,
                period="daily",
                start_date=start_date.replace("-", ""),
                end_date=end_date.replace("-", ""),
                adjust="",
            )
            rows = [normalize_provider_row(row) for row in dataframe_records(raw)]
            return rows, {"source_provider": "akshare", "source_endpoint": "fund_etf_hist_em"}
        except Exception as error:  # noqa: BLE001 - retain a bounded same-source fallback.
            AKSHARE_UNAVAILABLE_REASON = f"{type(error).__name__}: {error}"
    errors.append(f"AKShare fund_etf_hist_em unavailable: {AKSHARE_UNAVAILABLE_REASON}")

    params = {
        "fields1": "f1,f2,f3,f4,f5,f6",
        "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f116",
        "ut": "7eea3edcaed734bea9cbfc24409ed989",
        "klt": "101",
        "fqt": "0",
        "beg": start_date.replace("-", ""),
        "end": end_date.replace("-", ""),
        "secid": f"{'1' if symbol.startswith('5') else '0'}.{symbol}",
    }
    command = [
        "curl", "-L", "--fail", "--silent", "--show-error", "--retry", "8",
        "--retry-all-errors", "--retry-delay", "2", "--connect-timeout", "15", "--max-time", "120",
        f"{ENDPOINT}?{urlencode(params)}",
    ]
    completed = subprocess.run(command, check=False, capture_output=True, text=True)
    if completed.returncode != 0:
        raise RuntimeError("; ".join(errors + [f"curl fallback failed: {completed.stderr.strip()}"]))
    payload = json.loads(completed.stdout)
    klines = payload.get("data", {}).get("klines") or []
    if not klines:
        raise RuntimeError("; ".join(errors + ["Eastmoney curl fallback returned no rows"]))
    rows = []
    for line in klines:
        fields = line.split(",")
        if len(fields) < 11:
            continue
        rows.append(normalize_provider_row({
            "trade_date": fields[0], "open": fields[1], "close": fields[2],
            "high": fields[3], "low": fields[4], "volume": fields[5],
            "amount": fields[6], "pct_change": fields[8], "turnover": fields[10],
        }))
    return rows, {
        "source_provider": "eastmoney",
        "source_endpoint": "push2his bulk kline curl fallback after AKShare TLS failure",
    }


def normalize_provider_row(row: dict[str, Any]) -> dict[str, Any]:
    date = str(first(row, "日期", "date", "trade_date") or "")[:10].replace("/", "-")
    return {
        "trade_date": date,
        "open": number(first(row, "开盘", "open")),
        "high": number(first(row, "最高", "high")),
        "low": number(first(row, "最低", "low")),
        "close": number(first(row, "收盘", "close")),
        "volume": number(first(row, "成交量", "volume")),
        "amount": number(first(row, "成交额", "amount")),
        "pct_change": number(first(row, "涨跌幅", "pct_change")),
        "turnover": number(first(row, "换手率", "turnover")),
    }


def valid_rows(rows: list[dict[str, Any]], cutoff: str) -> list[dict[str, Any]]:
    accepted: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in sorted(rows, key=lambda item: item.get("trade_date") or ""):
        date = row.get("trade_date")
        if not date or date > cutoff or date in seen:
            continue
        if any(not positive(row.get(field)) for field in CORE_FIELDS):
            continue
        if not (row["low"] <= min(row["open"], row["close"]) <= max(row["open"], row["close"]) <= row["high"]):
            continue
        seen.add(date)
        accepted.append(row)
    return accepted


def history_csv_row(
    row: dict[str, Any],
    item: dict[str, Any],
    cutoff: str,
    timestamp: str,
    diagnostics: dict[str, str] | None = None
) -> dict[str, Any]:
    diagnostics = diagnostics or {
        "source_provider": "eastmoney",
        "source_endpoint": "fund_etf_hist_em-compatible daily kline",
    }
    return {
        "date": row["trade_date"],
        "trade_date": row["trade_date"],
        "sector_id": item["sector_id"],
        "sector_node_id": item["sector_node_id"],
        "fund_code": item["fund_code"],
        "fund_name": item["fund_name_hint"],
        **{field: row.get(field) for field in CORE_FIELDS},
        "pct_change": row.get("pct_change"),
        "turnover": row.get("turnover"),
        "source_provider": diagnostics["source_provider"],
        "source_endpoint": diagnostics["source_endpoint"],
        "provider_run_id": BRIDGE_ID,
        "collected_at": timestamp,
        "historical_input": "true",
        "backfill_source_provider": diagnostics["source_provider"],
        "backfill_source_endpoint": diagnostics["source_endpoint"],
        "retrieved_at": timestamp,
        "backfilled_at": timestamp,
        "cutoff_date": cutoff,
    }


def merge_history(
    existing: list[dict[str, Any]],
    incoming: list[dict[str, Any]],
    cutoff: str | None = None,
) -> list[dict[str, Any]]:
    """Atomically replace OHLCVA from exact-date history while retaining snapshot fields."""
    merged: dict[tuple[str, str], dict[str, Any]] = {}
    for row in existing:
        date = str(row.get("trade_date") or row.get("date") or "")
        code = str(row.get("fund_code") or "")
        if date and code and (cutoff is None or date <= cutoff):
            normalized = {**row, "date": date, "trade_date": date}
            key = (code, date)
            previous = merged.get(key)
            if previous is None or (not complete_valid_bar(previous) and complete_valid_bar(normalized)):
                merged[key] = normalized
            elif not complete_valid_bar(previous) and not complete_valid_bar(normalized):
                merged[key] = normalized
    for row in incoming:
        date = str(row["trade_date"])
        if cutoff is not None and date > cutoff:
            continue
        if not complete_valid_bar(row):
            raise ValueError(f"historical row has an invalid OHLCVA relationship: {row.get('fund_code')} {date}")
        key = (str(row["fund_code"]), date)
        old = merged.get(key, {})
        if complete_valid_bar(old) and bar_signature(old) == bar_signature(row):
            enriched = dict(old)
        else:
            enriched = {**old, **row}
            for field in CORE_FIELDS:
                enriched[field] = row.get(field)
            for field in SNAPSHOT_UPDATE_FIELDS:
                if old.get(field) not in (None, ""):
                    enriched[field] = old[field]
        enriched["date"] = date
        enriched["trade_date"] = date
        merged[key] = enriched
    return sorted(merged.values(), key=lambda row: (row["date"], row["fund_code"]))


def merge_benchmark(
    existing: dict[str, Any],
    incoming: list[dict[str, Any]],
    cutoff: str,
    timestamp: str,
    diagnostics: dict[str, str] | None = None
) -> dict[str, Any]:
    diagnostics = diagnostics or {
        "source_provider": "eastmoney",
        "source_endpoint": "fund_etf_hist_em-compatible daily kline",
    }
    by_date = {
        str(row.get("trade_date") or row.get("date")): row
        for row in existing.get("rows", [])
        if row.get("trade_date") or row.get("date")
    }
    changed = any(date > cutoff for date in by_date)
    for row in incoming:
        date = row["trade_date"]
        old = by_date.get(date, {})
        candidate = {
            "date": date, "trade_date": date, "symbol": "510300",
            **{field: row.get(field) for field in CORE_FIELDS},
            "pct_change": row.get("pct_change"),
            "turnover": row.get("turnover"),
            "source_provider": diagnostics["source_provider"],
            "source_endpoint": diagnostics["source_endpoint"],
            "retrieved_at": timestamp,
            "backfilled_at": timestamp,
            "cutoff_date": cutoff,
        }
        if complete_valid_bar(old) and bar_signature(old) == bar_signature(row):
            candidate = dict(old)
        else:
            changed = True
        candidate["date"] = date
        candidate["trade_date"] = date
        by_date[date] = candidate
    rows = [by_date[date] for date in sorted(by_date) if date <= cutoff]
    return {
        "module_id": "a_share_benchmark_daily_v0_10_77",
        "benchmark": existing.get("benchmark", {"symbol": "510300", "price_field": "close"}),
        "last_success_timestamp": timestamp if changed else existing.get("last_success_timestamp", timestamp),
        "cutoff_date": cutoff,
        "rows": rows,
    }


def bar_signature(row: dict[str, Any]) -> tuple[float | None, ...]:
    return tuple(number(row.get(field)) for field in CORE_FIELDS)


def first(row: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if row.get(key) not in (None, "", "-"):
            return row[key]
    return None


def number(value: Any) -> float | None:
    try:
        return float(str(value).replace(",", "")) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def positive(value: Any) -> bool:
    number_value = number(value)
    return number_value is not None and number_value > 0


def read_csv(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    with temp.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in CSV_FIELDS})
    temp.replace(path)


def read_json_or(path: Path, fallback: dict[str, Any]) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return fallback


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)


if __name__ == "__main__":
    raise SystemExit(main())
