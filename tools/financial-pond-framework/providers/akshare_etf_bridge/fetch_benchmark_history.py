#!/usr/bin/env python3
"""Fetch one configured benchmark proxy through a bounded exact-date path.

The benchmark is deliberately separate from the industry ETF bulk spot export.
Only exact requested dates are persisted. Failed requests never replace the
last-known-good store with nulls.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import random
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import requests

BRIDGE_ID = "a_share_benchmark_history"
DEFAULT_ENDPOINT = "https://push2his.eastmoney.com/api/qt/stock/kline/get"


class EastmoneyHistoryAdapter:
    def fetch_exact_close(self, symbol: str, requested_date: str, timeout_seconds: float) -> dict[str, Any]:
        market_prefix = "1" if symbol.startswith("5") else "0"
        compact = requested_date.replace("-", "")
        response = requests.get(
            DEFAULT_ENDPOINT,
            params={
                "fields1": "f1,f2,f3,f4,f5,f6",
                "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
                "ut": "7eea3edcaed734bea9cbfc24409ed989",
                "klt": "101",
                "fqt": "0",
                "beg": compact,
                "end": compact,
                "secid": f"{market_prefix}.{symbol}"
            },
            timeout=timeout_seconds
        )
        response.raise_for_status()
        payload = response.json()
        klines = payload.get("data", {}).get("klines") or []
        if len(klines) != 1:
            raise RuntimeError(f"Provider returned {len(klines)} rows for exact date {requested_date}")
        fields = klines[0].split(",")
        if fields[0] != requested_date:
            raise RuntimeError(f"Provider date mismatch: requested {requested_date}, received {fields[0]}")
        close = float(fields[2])
        if close <= 0:
            raise RuntimeError(f"Provider close is invalid for {requested_date}")
        return {
            "date": requested_date,
            "symbol": symbol,
            "close": close,
            "source_provider": "eastmoney",
            "source_endpoint": "fund_etf_hist_em-compatible exact-date kline"
        }


def collect_dates(
    adapter: Any,
    symbol: str,
    requested_dates: list[str],
    *,
    timeout_seconds: float = 15,
    max_attempts: int = 3,
    base_delay_seconds: float = 0.5,
    jitter_seconds: float = 0.2,
    sleeper: Callable[[float], None] = time.sleep,
    jitter: Callable[[float, float], float] = random.uniform
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    successes: list[dict[str, Any]] = []
    diagnostics: list[dict[str, Any]] = []
    for requested_date in requested_dates:
        last_error = None
        attempts = 0
        for attempt in range(1, max_attempts + 1):
            attempts = attempt
            try:
                row = adapter.fetch_exact_close(symbol, requested_date, timeout_seconds)
                validate_exact_row(row, symbol, requested_date)
                successes.append(row)
                last_error = None
                break
            except Exception as error:  # noqa: BLE001 - diagnostics must retain provider failures.
                last_error = f"{type(error).__name__}: {error}"
                if attempt < max_attempts:
                    delay = base_delay_seconds * (2 ** (attempt - 1)) + jitter(0, jitter_seconds)
                    sleeper(delay)
        diagnostics.append({
            "requested_date": requested_date,
            "attempt_count": attempts,
            "status": "ok" if last_error is None else "error",
            "provider_error": last_error
        })
    return successes, diagnostics


def merge_store(existing: dict[str, Any], rows: list[dict[str, Any]], config: dict[str, Any], timestamp: str) -> dict[str, Any]:
    by_key = {(row.get("date"), row.get("symbol")): row for row in existing.get("rows", [])}
    for row in rows:
        by_key[(row["date"], row["symbol"])] = {**row, "collected_at": timestamp}
    merged = sorted(by_key.values(), key=lambda row: (row["date"], row["symbol"]))
    return {
        "module_id": "a_share_benchmark_daily_v0_10_65",
        "benchmark": config,
        "last_success_timestamp": timestamp if rows else existing.get("last_success_timestamp"),
        "rows": merged
    }


def validate_exact_row(row: dict[str, Any], symbol: str, requested_date: str) -> None:
    if row.get("symbol") != symbol or row.get("date") != requested_date:
        raise RuntimeError("Adapter returned a non-exact symbol/date row")
    close = row.get("close")
    if not isinstance(close, (int, float)) or close <= 0:
        raise RuntimeError("Adapter returned an invalid close")


def main() -> int:
    args = parse_args()
    framework_root = Path(args.root_dir).resolve()
    repo_root = framework_root.parents[1]
    config_path = Path(args.config).resolve() if args.config else repo_root / "config" / "a-share-benchmark-proxy.v1.json"
    config = read_json(config_path)
    store_path = Path(args.store).resolve() if args.store else framework_root / "data" / "provider_exports" / "a_share_benchmark_daily.json"
    status_path = framework_root / "model_outputs" / "provider_runs" / f"{BRIDGE_ID}_{max(args.date)}.json"
    existing = read_json_optional(store_path, {"rows": [], "last_success_timestamp": None})
    adapter = load_adapter(args.adapter_module)
    timestamp = datetime.now(timezone.utc).isoformat()
    rows, diagnostics = collect_dates(
        adapter,
        config["symbol"],
        sorted(set(args.date)),
        timeout_seconds=args.timeout,
        max_attempts=args.max_attempts
    )
    if rows:
        write_json(store_path, merge_store(existing, rows, config, timestamp))
    success_dates = {row["date"] for row in rows}
    requested_dates = sorted(set(args.date))
    status_value = "ok" if len(success_dates) == len(requested_dates) else ("partial" if rows else "error")
    status = {
        "bridge_id": BRIDGE_ID,
        "status": status_value,
        "benchmark_symbol": config["symbol"],
        "requested_dates": requested_dates,
        "successful_dates": sorted(success_dates),
        "attempt_count": sum(item["attempt_count"] for item in diagnostics),
        "diagnostics": diagnostics,
        "provider_error": next((item["provider_error"] for item in reversed(diagnostics) if item["provider_error"]), None),
        "last_success_timestamp": timestamp if rows else existing.get("last_success_timestamp"),
        "store_preserved": not rows and store_path.exists(),
        "generated_at": timestamp
    }
    write_json(status_path, status)
    print(json.dumps(status, ensure_ascii=False, indent=2))
    return 0 if status_value == "ok" or args.allow_failure else 2


def load_adapter(module_path: str | None) -> Any:
    if not module_path:
        return EastmoneyHistoryAdapter()
    spec = importlib.util.spec_from_file_location("benchmark_adapter", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load benchmark adapter: {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.Adapter()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch exact-date history for the configured A-share benchmark proxy.")
    parser.add_argument("--root-dir", default=Path(__file__).resolve().parents[2])
    parser.add_argument("--config", default=None)
    parser.add_argument("--store", default=None)
    parser.add_argument("--date", action="append", required=True)
    parser.add_argument("--timeout", type=float, default=15)
    parser.add_argument("--max-attempts", type=int, choices=(1, 2, 3), default=3)
    parser.add_argument("--adapter-module", default=None)
    parser.add_argument("--allow-failure", action="store_true")
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def read_json_optional(path: Path, fallback: dict[str, Any]) -> dict[str, Any]:
    try:
        return read_json(path)
    except FileNotFoundError:
        return fallback


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
