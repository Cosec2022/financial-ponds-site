#!/usr/bin/env python3
"""Backfill A-share industry ETF history through the AKShare bridge boundary.

Purpose:
- create enough local history for relative-strength and flow review research;
- use real historical ETF shares only when the provider exposes them;
- never fabricate `estimated_flow` when historical share data is missing.

This script remains outside `src/core` so provider-specific schema handling does
not leak into the graph engine.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from export_a_share_etf_daily import (
    BRIDGE_ID,
    build_row,
    call_provider,
    compact_date,
    dataframe_records,
    load_akshare_module,
    numeric_value,
    read_existing_csv,
    read_json,
    string_value,
    upsert_csv,
    upsert_sector_flow_csv,
    write_json
)


BACKFILL_ID = f"{BRIDGE_ID}_history_backfill"


def main() -> int:
    args = parse_args()
    root_dir = Path(args.root_dir).resolve()
    contract_path = Path(args.contract).resolve() if args.contract else Path(__file__).with_name("provider_contract.json")
    contract = read_json(contract_path)
    end_date = args.end_date or datetime.now(timezone.utc).date().isoformat()
    start_date = args.start_date or iso_days_before(end_date, args.days - 1)
    provider_run_id = f"{BACKFILL_ID}_{start_date}_{end_date}_{datetime.now(timezone.utc).strftime('%H%M%S')}"
    collected_at = datetime.now(timezone.utc).isoformat()

    status: dict[str, Any] = {
        "bridge_id": BACKFILL_ID,
        "provider": "akshare",
        "mode": "fixture" if args.fixture else "real",
        "start_date": start_date,
        "end_date": end_date,
        "provider_run_id": provider_run_id,
        "started_at": collected_at,
        "status": "started",
        "warnings": [],
        "errors": []
    }

    row_csv_path = root_dir / "data" / "provider_exports" / "a_share_etf_daily.csv"
    sector_flow_path = root_dir / "data" / "provider_exports" / "a_share_sector_flow.csv"
    raw_path = root_dir / "raw_data" / "provider" / "akshare" / "history_backfill" / f"{start_date}_{end_date}.json"
    run_status_path = root_dir / "model_outputs" / "provider_runs" / f"{BACKFILL_ID}_{end_date}.json"

    try:
        if args.fixture:
            rows, raw_payload, warnings = build_fixture_backfill_rows(contract, start_date, end_date, provider_run_id, collected_at)
        else:
            rows, raw_payload, warnings = build_real_backfill_rows(contract, start_date, end_date, provider_run_id, collected_at)

        rows = calculate_share_change(rows)
        expected_codes = {item["fund_code"] for item in contract["representative_etfs"]}
        observed_codes = {string_value(row.get("fund_code")) for row in rows if string_value(row.get("fund_code"))}
        missing_history_codes = sorted(expected_codes - observed_codes)
        if not rows:
            status_value = "no_history_available"
            warnings.append(
                "Historical backfill returned no representative ETF rows. "
                "Daily AKShare export can still create the current baseline; historical flow must be accumulated from future daily runs."
            )
        else:
            status_value = "ok" if not missing_history_codes else "partial"
        if missing_history_codes:
            warnings.append(
                "Historical backfill missed representative ETF codes: "
                + ", ".join(missing_history_codes)
                + ". This usually means the historical price endpoint failed for those ETFs; run the daily AKShare export to refresh the latest full quote row."
            )
        write_json(raw_path, raw_payload | {"rows": rows, "warnings": warnings})
        if rows:
            upsert_csv(row_csv_path, contract["row_level_columns"], rows, ["date", "fund_code"])
            for date in sorted({row["date"] for row in rows}):
                upsert_sector_flow_csv(sector_flow_path, contract["sector_flow_columns"], [row for row in rows if row["date"] == date], date)

        rows_with_share = [row for row in rows if numeric_value(row.get("latest_share")) is not None]
        rows_with_flow = [row for row in rows if numeric_value(row.get("estimated_flow")) is not None]
        status.update(
            {
                "status": status_value,
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "warnings": warnings,
                "records": len(rows),
                "counts": {
                    "dates": len({row["date"] for row in rows}),
                    "representative_etfs": len(contract["representative_etfs"]),
                    "representative_codes_observed": len(observed_codes),
                    "missing_history_codes": missing_history_codes,
                    "rows_with_share": len(rows_with_share),
                    "rows_with_estimated_flow": len(rows_with_flow)
                },
                "outputs": {
                    "raw_json": str(raw_path.relative_to(root_dir)),
                    "run_status_json": str(run_status_path.relative_to(root_dir))
                }
            }
        )
        if rows:
            status["outputs"].update(
                {
                    "row_csv": str(row_csv_path.relative_to(root_dir)),
                    "sector_flow_csv": str(sector_flow_path.relative_to(root_dir))
                }
            )
        write_json(run_status_path, status)
        print(json.dumps(status, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:  # noqa: BLE001 - provider CLIs must fail closed with a clear report.
        status.update(
            {
                "status": "error",
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "errors": [str(error)],
                "outputs": {
                    "run_status_json": str(run_status_path.relative_to(root_dir))
                }
            }
        )
        write_json(run_status_path, status)
        print(json.dumps(status, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill A-share ETF history from AKShare into local provider CSV files.")
    parser.add_argument("--root-dir", default=Path(__file__).resolve().parents[2], help="Project root directory.")
    parser.add_argument("--contract", default=None, help="Provider contract JSON path.")
    parser.add_argument("--start-date", default=None, help="Start date in YYYY-MM-DD format.")
    parser.add_argument("--end-date", default=None, help="End date in YYYY-MM-DD format.")
    parser.add_argument("--days", type=int, default=31, help="Calendar-day lookback when --start-date is omitted.")
    parser.add_argument("--fixture", action="store_true", help="Write deterministic history without importing AKShare.")
    return parser.parse_args()


def build_fixture_backfill_rows(
    contract: dict[str, Any],
    start_date: str,
    end_date: str,
    provider_run_id: str,
    collected_at: str
) -> tuple[list[dict[str, Any]], dict[str, Any], list[str]]:
    dates = business_dates(start_date, end_date)
    rows: list[dict[str, Any]] = []
    for date_index, date in enumerate(dates):
        for index, item in enumerate(contract["representative_etfs"], start=1):
            close = round(0.82 + index * 0.047 + date_index * 0.006, 4)
            pct_change = round(((index + date_index) % 7 - 3) * 0.48, 4)
            amount = 180_000_000 + index * 38_000_000 + date_index * 12_000_000
            turnover = round(1.2 + index * 0.18 + date_index * 0.015, 4)
            latest_share = 1_000_000_000 + index * 52_000_000 + date_index * (index - 6) * 1_700_000
            rows.append(
                build_row(
                    as_of=date,
                    item=item,
                    close=close,
                    pct_change=pct_change,
                    amount=amount,
                    turnover=turnover,
                    latest_share=latest_share,
                    previous_share=None,
                    share_change=None,
                    estimated_flow=None,
                    source_endpoint="fixture_history",
                    provider_run_id=provider_run_id,
                    collected_at=collected_at,
                    fund_name=item["fund_name_hint"]
                )
            )
    return rows, {"mode": "fixture", "dates": dates}, []


def build_real_backfill_rows(
    contract: dict[str, Any],
    start_date: str,
    end_date: str,
    provider_run_id: str,
    collected_at: str
) -> tuple[list[dict[str, Any]], dict[str, Any], list[str]]:
    ak = load_akshare_module()
    warnings: list[str] = []
    share_by_date_code = collect_share_history(ak, contract, start_date, end_date, warnings)
    rows: list[dict[str, Any]] = []
    raw_history_samples: dict[str, list[dict[str, Any]]] = {}

    for item in contract["representative_etfs"]:
        code = item["fund_code"]
        history_rows = fetch_price_history(ak, code, start_date, end_date, warnings)
        raw_history_samples[code] = history_rows[:5]
        for price_row in history_rows:
            date = normalize_date(price_row.get("日期") or price_row.get("date"))
            if not date:
                continue
            share_row = share_by_date_code.get(date, {}).get(code, {})
            latest_share = numeric_value(share_row.get("基金份额")) or numeric_value(share_row.get("latest_share"))
            rows.append(
                build_row(
                    as_of=date,
                    item=item,
                    close=numeric_value(price_row.get("收盘") or price_row.get("close")),
                    pct_change=numeric_value(price_row.get("涨跌幅") or price_row.get("pct_change")),
                    amount=numeric_value(price_row.get("成交额") or price_row.get("amount")),
                    turnover=numeric_value(price_row.get("换手率") or price_row.get("turnover")),
                    latest_share=latest_share,
                    previous_share=None,
                    share_change=None,
                    estimated_flow=None,
                    source_endpoint="fund_etf_hist_em+fund_etf_scale_history",
                    provider_run_id=provider_run_id,
                    collected_at=collected_at,
                    fund_name=item["fund_name_hint"]
                )
            )

    if not rows:
        warnings.append("AKShare historical export returned no representative ETF rows.")

    return rows, {"mode": "real", "price_history_samples": raw_history_samples}, warnings


def fetch_price_history(ak: Any, code: str, start_date: str, end_date: str, warnings: list[str]) -> list[dict[str, Any]]:
    if not hasattr(ak, "fund_etf_hist_em"):
        raise RuntimeError("AKShare function fund_etf_hist_em is unavailable; cannot backfill ETF price history.")
    try:
        return dataframe_records(
            ak.fund_etf_hist_em(
                symbol=code,
                period="daily",
                start_date=compact_date(start_date),
                end_date=compact_date(end_date),
                adjust=""
            )
        )
    except Exception as error:  # noqa: BLE001
        warnings.append(f"Price history failed for {code}: {error}")
        return []


def collect_share_history(
    ak: Any,
    contract: dict[str, Any],
    start_date: str,
    end_date: str,
    warnings: list[str]
) -> dict[str, dict[str, dict[str, Any]]]:
    by_date_code: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    dates = business_dates(start_date, end_date)
    need_sse = any(item["fund_code"].startswith("5") for item in contract["representative_etfs"])
    need_szse = any(item["fund_code"].startswith("1") for item in contract["representative_etfs"])

    if need_sse and hasattr(ak, "fund_etf_scale_sse"):
        for date in dates:
            for row in optional_records(f"fund_etf_scale_sse:{date}", warnings, lambda date=date: call_provider(ak.fund_etf_scale_sse, symbol=compact_date(date))):
                code = string_value(row.get("基金代码"))
                if code:
                    by_date_code[date][code] = row

    if need_szse and hasattr(ak, "fund_etf_scale_szse"):
        warned_unsupported = False
        for date in dates:
            try:
                records = dataframe_records(ak.fund_etf_scale_szse(symbol=compact_date(date)))
            except TypeError:
                if not warned_unsupported:
                    warnings.append("fund_etf_scale_szse does not accept a date argument in this AKShare build; Shenzhen ETF historical shares are left empty.")
                    warned_unsupported = True
                break
            except Exception as error:  # noqa: BLE001
                warnings.append(f"fund_etf_scale_szse failed for {date}: {error}")
                continue
            for row in records:
                code = string_value(row.get("基金代码"))
                if code:
                    by_date_code[date][code] = row

    return by_date_code


def optional_records(endpoint_id: str, warnings: list[str], call: Any) -> list[dict[str, Any]]:
    try:
        return dataframe_records(call())
    except Exception as error:  # noqa: BLE001
        warnings.append(f"Optional AKShare endpoint failed: {endpoint_id}: {error}")
        return []


def calculate_share_change(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_code: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_code[string_value(row.get("fund_code"))].append(row)

    for code_rows in by_code.values():
        previous_share = None
        for row in sorted(code_rows, key=lambda item: string_value(item.get("date"))):
            latest_share = numeric_value(row.get("latest_share"))
            close = numeric_value(row.get("close"))
            if latest_share is None:
                previous_share = None
                continue
            if previous_share is not None:
                share_change = latest_share - previous_share
                row["previous_share"] = previous_share
                row["share_change"] = share_change
                row["estimated_flow"] = None if close is None else share_change * close
            previous_share = latest_share
    return rows


def business_dates(start_date: str, end_date: str) -> list[str]:
    start = parse_date(start_date)
    end = parse_date(end_date)
    dates: list[str] = []
    current = start
    while current <= end:
        if current.weekday() < 5:
            dates.append(current.date().isoformat())
        current += timedelta(days=1)
    return dates


def parse_date(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%d")


def iso_days_before(end_date: str, days: int) -> str:
    return (parse_date(end_date) - timedelta(days=days)).date().isoformat()


def normalize_date(value: Any) -> str:
    text = string_value(value)
    if not text:
        return ""
    if len(text) == 8 and text.isdigit():
        return f"{text[:4]}-{text[4:6]}-{text[6:]}"
    return text[:10]


if __name__ == "__main__":
    raise SystemExit(main())
