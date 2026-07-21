#!/usr/bin/env python3
"""Export A-share industry ETF data to local files.

This bridge is intentionally outside the Node.js graph core. It writes raw and
CSV exports that the existing collector layer can read later.
"""

from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


BRIDGE_ID = "akshare_etf_bridge"


def main() -> int:
    args = parse_args()
    root_dir = Path(args.root_dir).resolve()
    contract_path = Path(args.contract).resolve() if args.contract else Path(__file__).with_name("provider_contract.json")
    as_of = args.as_of or datetime.now(timezone.utc).date().isoformat()
    provider_run_id = f"{BRIDGE_ID}_{as_of}_{datetime.now(timezone.utc).strftime('%H%M%S')}"
    collected_at = datetime.now(timezone.utc).isoformat()

    contract = read_json(contract_path)
    raw_path = root_dir / "raw_data" / "provider" / "akshare" / as_of / "a_share_etf_daily_raw.json"
    row_csv_path = root_dir / "data" / "provider_exports" / "a_share_etf_daily.csv"
    sector_flow_path = root_dir / "data" / "provider_exports" / "a_share_sector_flow.csv"
    run_status_path = root_dir / "model_outputs" / "provider_runs" / f"akshare_etf_bridge_{as_of}.json"
    daily_rows_path = root_dir / "data" / "provider_exports" / "daily" / f"a_share_etf_daily_{as_of}.json"
    status: dict[str, Any] = {
        "bridge_id": BRIDGE_ID,
        "provider": "akshare",
        "mode": "fixture" if args.fixture else "real",
        "as_of": as_of,
        "provider_run_id": provider_run_id,
        "started_at": collected_at,
        "status": "started",
        "warnings": [],
        "errors": [],
        "outputs": {}
    }

    try:
        if args.fixture:
            rows = build_fixture_rows(contract, as_of, provider_run_id, collected_at)
            raw_payload = {
                "mode": "fixture",
                "contract_id": contract["id"],
                "rows": rows
            }
        else:
            rows, raw_payload = build_akshare_rows(contract, as_of, provider_run_id, collected_at)
            rows = fill_previous_share_from_history(rows, read_existing_csv(row_csv_path))
            raw_payload["rows"] = rows
            status["warnings"] = raw_payload.get("warnings", [])

        write_json(raw_path, raw_payload)
        write_json(daily_rows_path, {
            "schema_version": "akshare_daily_etf_rows_v1",
            "provider": "akshare",
            "mode": "fixture" if args.fixture else "real",
            "status": "ok",
            "as_of": as_of,
            "provider_run_id": provider_run_id,
            "generated_at": collected_at,
            "records": len(rows),
            "rows": rows
        })
        upsert_csv(row_csv_path, contract["row_level_columns"], rows, ["date", "fund_code"])
        upsert_sector_flow_csv(sector_flow_path, contract["sector_flow_columns"], rows, as_of)

        status.update(
            {
                "status": "ok",
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "records": len(rows),
                "outputs": {
                    "raw_json": str(raw_path.relative_to(root_dir)),
                    "daily_rows_json": str(daily_rows_path.relative_to(root_dir)),
                    "row_csv": str(row_csv_path.relative_to(root_dir)),
                    "sector_flow_csv": str(sector_flow_path.relative_to(root_dir)),
                    "run_status_json": str(run_status_path.relative_to(root_dir))
                }
            }
        )
        write_json(run_status_path, status)
        print(json.dumps(status, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:  # noqa: BLE001 - CLI must report provider failures clearly.
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
    parser = argparse.ArgumentParser(description="Export A-share ETF data from AKShare into local CSV files.")
    parser.add_argument("--root-dir", default=Path(__file__).resolve().parents[2], help="Project root directory.")
    parser.add_argument("--contract", default=None, help="Provider contract JSON path.")
    parser.add_argument("--as-of", default=None, help="Trade date or run date in YYYY-MM-DD format.")
    parser.add_argument("--fixture", action="store_true", help="Write deterministic fixture data without importing AKShare.")
    return parser.parse_args()


def build_fixture_rows(contract: dict[str, Any], as_of: str, provider_run_id: str, collected_at: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for index, item in enumerate(contract["representative_etfs"], start=1):
        close = round(0.82 + index * 0.047, 4)
        pct_change = round(((index % 5) - 2) * 0.72, 4)
        amount = 180_000_000 + index * 38_000_000
        turnover = round(1.2 + index * 0.18, 4)
        previous_share = 1_000_000_000 + index * 52_000_000
        share_change = (index - 6) * 8_500_000
        latest_share = previous_share + share_change
        estimated_flow = round(share_change * close, 2)
        rows.append(
            build_row(
                as_of=as_of,
                item=item,
                close=close,
                pct_change=pct_change,
                amount=amount,
                turnover=turnover,
                latest_share=latest_share,
                previous_share=previous_share,
                share_change=share_change,
                estimated_flow=estimated_flow,
                source_endpoint="fixture",
                provider_run_id=provider_run_id,
                collected_at=collected_at,
                fund_name=item["fund_name_hint"]
            )
        )
    return rows


def build_akshare_rows(
    contract: dict[str, Any],
    as_of: str,
    provider_run_id: str,
    collected_at: str
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    ak = load_akshare_module()

    warnings: list[str] = []
    spot_rows = dataframe_records(ak.fund_etf_spot_em())
    sse_share_rows = optional_provider_records(
        "fund_etf_scale_sse",
        warnings,
        lambda: call_provider(ak.fund_etf_scale_sse, symbol=compact_date(as_of))
    )
    szse_share_rows = optional_provider_records(
        "fund_etf_scale_szse",
        warnings,
        lambda: call_provider(ak.fund_etf_scale_szse)
    )
    share_by_code = merge_share_rows(sse_share_rows, szse_share_rows)
    spot_by_code = {string_value(row.get("代码")): row for row in spot_rows}

    rows: list[dict[str, Any]] = []
    missing_codes: list[str] = []
    for item in contract["representative_etfs"]:
        code = item["fund_code"]
        spot = spot_by_code.get(code)
        if spot is None:
            missing_codes.append(code)
            continue
        share = share_by_code.get(code, {})
        close = numeric_value(spot.get("最新价"))
        latest_share = numeric_value(spot.get("最新份额")) or numeric_value(share.get("基金份额"))
        previous_share = numeric_value(share.get("previous_share"))
        share_change = None if latest_share is None or previous_share is None else latest_share - previous_share
        estimated_flow = None if share_change is None or close is None else share_change * close
        rows.append(
            build_row(
                as_of=as_of,
                item=item,
                close=close,
                pct_change=numeric_value(spot.get("涨跌幅")),
                amount=numeric_value(spot.get("成交额")),
                turnover=numeric_value(spot.get("换手率")),
                latest_share=latest_share,
                previous_share=previous_share,
                share_change=share_change,
                estimated_flow=estimated_flow,
                source_endpoint="fund_etf_spot_em+fund_etf_scale",
                provider_run_id=provider_run_id,
                collected_at=collected_at,
                fund_name=string_value(spot.get("名称")) or item["fund_name_hint"]
            )
        )

    if missing_codes:
        raise RuntimeError(f"AKShare output missed representative ETF codes: {', '.join(missing_codes)}")

    raw_payload = {
        "mode": "real",
        "contract_id": contract["id"],
        "spot_rows_sample": spot_rows[:20],
        "sse_share_rows_sample": sse_share_rows[:20],
        "szse_share_rows_sample": szse_share_rows[:20],
        "warnings": warnings,
        "rows": rows
    }
    return rows, raw_payload


def load_akshare_module() -> Any:
    """Load AKShare, with an explicit module path hook for deterministic tests."""
    module_path = os.environ.get("AKSHARE_BRIDGE_MODULE_PATH")
    if module_path:
        spec = importlib.util.spec_from_file_location("akshare", module_path)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Could not load AKShare test module from {module_path}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    try:
        import akshare as ak  # type: ignore[import-not-found]
    except Exception as error:  # noqa: BLE001
        raise RuntimeError("AKShare is not installed. Run `python3 -m pip install akshare` or use --fixture.") from error
    return ak


def optional_provider_records(endpoint_id: str, warnings: list[str], call: Any) -> list[dict[str, Any]]:
    try:
        return dataframe_records(call())
    except Exception as error:  # noqa: BLE001 - optional endpoints should degrade to warnings.
        warnings.append(f"Optional AKShare endpoint failed: {endpoint_id}: {error}")
        return []


def call_provider(function: Any, **kwargs: Any) -> Any:
    """Call an AKShare endpoint while tolerating documented signature drift."""
    if not kwargs:
        return function()
    try:
        return function(**kwargs)
    except TypeError as error:
        if "unexpected keyword argument" not in str(error):
            raise
        return function()


def build_row(
    *,
    as_of: str,
    item: dict[str, Any],
    close: Any,
    pct_change: Any,
    amount: Any,
    turnover: Any,
    latest_share: Any,
    previous_share: Any,
    share_change: Any,
    estimated_flow: Any,
    source_endpoint: str,
    provider_run_id: str,
    collected_at: str,
    fund_name: str
) -> dict[str, Any]:
    return {
        "date": as_of,
        "sector_id": item["sector_id"],
        "sector_node_id": item["sector_node_id"],
        "fund_code": item["fund_code"],
        "fund_name": fund_name,
        "close": close,
        "pct_change": pct_change,
        "amount": amount,
        "turnover": turnover,
        "latest_share": latest_share,
        "previous_share": previous_share,
        "share_change": share_change,
        "estimated_flow": estimated_flow,
        "source_provider": "akshare",
        "source_endpoint": source_endpoint,
        "provider_run_id": provider_run_id,
        "collected_at": collected_at
    }


def upsert_sector_flow_csv(path: Path, columns: list[str], rows: list[dict[str, Any]], as_of: str) -> None:
    by_node = {row["sector_node_id"]: row["estimated_flow"] for row in rows}
    output_row = {"date": as_of}
    for column in columns:
        if column == "date":
            continue
        output_row[column] = by_node.get(column, "")
    upsert_csv(path, columns, [output_row], ["date"])


def fill_previous_share_from_history(rows: list[dict[str, Any]], history_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    latest_history_by_code: dict[str, dict[str, Any]] = {}
    for row in sorted(history_rows, key=lambda item: string_value(item.get("date"))):
        code = string_value(row.get("fund_code"))
        if code:
            latest_history_by_code[code] = row

    for row in rows:
        if row.get("previous_share") not in (None, ""):
            continue
        history = latest_history_by_code.get(string_value(row.get("fund_code")))
        if not history:
            continue
        previous_share = numeric_value(history.get("latest_share"))
        latest_share = numeric_value(row.get("latest_share"))
        close = numeric_value(row.get("close"))
        if previous_share is None or latest_share is None:
            continue
        share_change = latest_share - previous_share
        row["previous_share"] = previous_share
        row["share_change"] = share_change
        row["estimated_flow"] = None if close is None else share_change * close
    return rows


def upsert_csv(path: Path, columns: list[str], rows: list[dict[str, Any]], key_columns: list[str]) -> None:
    existing = read_existing_csv(path)
    by_key = {row_key(row, key_columns): row for row in existing}
    for row in rows:
        by_key[row_key(row, key_columns)] = row
    merged = sorted(by_key.values(), key=lambda row: row_key(row, key_columns))
    write_row_csv(path, columns, merged)


def write_row_csv(path: Path, columns: list[str], rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    with temp_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    temp_path.replace(path)


def read_existing_csv(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def row_key(row: dict[str, Any], key_columns: list[str]) -> tuple[str, ...]:
    return tuple(str(row.get(column, "")) for column in key_columns)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp_path.replace(path)


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def dataframe_records(dataframe: Any) -> list[dict[str, Any]]:
    return json.loads(dataframe.to_json(orient="records", force_ascii=False))


def merge_share_rows(*groups: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for group in groups:
        for row in group:
            code = string_value(row.get("基金代码"))
            if code:
                merged[code] = row
    return merged


def compact_date(value: str) -> str:
    return value.replace("-", "")


def string_value(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def numeric_value(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


if __name__ == "__main__":
    raise SystemExit(main())
