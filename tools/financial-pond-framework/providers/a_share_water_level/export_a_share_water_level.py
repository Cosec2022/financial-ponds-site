#!/usr/bin/env python3
"""Export A-share market water-level data to project-local CSV.

Purpose:
- summarize broad A-share market participation from current-day market data;
- keep provider-specific AKShare schema handling outside `src/core`;
- feed market-liquidity observations into the Flow Engine without enabling
  direct graph sources.

The first real signal set is intentionally small:
- total A-share turnover from all-stock quote rows;
- advance/decline breadth from all-stock quote rows;
- optional margin balance if a compatible AKShare endpoint is available.
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


PROVIDER_ID = "a_share_water_level_provider"
CSV_COLUMNS = [
    "date",
    "total_amount",
    "up_count",
    "down_count",
    "flat_count",
    "active_count",
    "breadth_ratio",
    "margin_balance",
    "margin_buy_amount",
    "margin_repay_amount",
    "source_provider",
    "source_endpoint",
    "provider_run_id",
    "collected_at"
]


def main() -> int:
    args = parse_args()
    root_dir = Path(args.root_dir).resolve()
    as_of = args.as_of or datetime.now(timezone.utc).date().isoformat()
    provider_run_id = f"{PROVIDER_ID}_{as_of}_{datetime.now(timezone.utc).strftime('%H%M%S')}"
    collected_at = datetime.now(timezone.utc).isoformat()
    raw_path = root_dir / "raw_data" / "provider" / "a_share_water_level" / as_of / "a_share_water_level_raw.json"
    csv_path = root_dir / "data" / "provider_exports" / "a_share_water_level.csv"
    run_status_path = root_dir / "model_outputs" / "provider_runs" / f"a_share_water_level_{as_of}.json"

    status: dict[str, Any] = {
        "provider_id": PROVIDER_ID,
        "provider": "akshare",
        "mode": "fixture" if args.fixture else "real",
        "as_of": as_of,
        "provider_run_id": provider_run_id,
        "started_at": collected_at,
        "status": "started",
        "warnings": [],
        "errors": []
    }

    try:
        if args.fixture:
            row, raw_payload, warnings = build_fixture_row(as_of, provider_run_id, collected_at)
        else:
            row, raw_payload, warnings = build_real_row(as_of, provider_run_id, collected_at)

        upsert_csv(csv_path, [row], ["date"])
        write_json(raw_path, raw_payload | {"row": row, "warnings": warnings})
        status.update(
            {
                "status": "ok",
                "warnings": warnings,
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "outputs": {
                    "raw_json": str(raw_path.relative_to(root_dir)),
                    "row_csv": str(csv_path.relative_to(root_dir)),
                    "run_status_json": str(run_status_path.relative_to(root_dir))
                },
                "counts": {
                    "active_count": row["active_count"],
                    "up_count": row["up_count"],
                    "down_count": row["down_count"],
                    "has_margin_balance": row["margin_balance"] not in (None, "")
                }
            }
        )
        write_json(run_status_path, status)
        print(json.dumps(status, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:  # noqa: BLE001 - provider CLI must fail closed and explain the source.
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
    parser = argparse.ArgumentParser(description="Export A-share market water-level data.")
    parser.add_argument("--root-dir", default=Path(__file__).resolve().parents[2], help="Project root directory.")
    parser.add_argument("--as-of", default=None, help="Run date in YYYY-MM-DD format.")
    parser.add_argument("--fixture", action="store_true", help="Write deterministic fixture data without importing AKShare.")
    return parser.parse_args()


def build_fixture_row(as_of: str, provider_run_id: str, collected_at: str) -> tuple[dict[str, Any], dict[str, Any], list[str]]:
    active_count = 5300
    up_count = 3100
    down_count = 1900
    flat_count = active_count - up_count - down_count
    row = build_row(
        as_of=as_of,
        total_amount=1_080_000_000_000,
        up_count=up_count,
        down_count=down_count,
        flat_count=flat_count,
        active_count=active_count,
        margin_balance=None,
        margin_buy_amount=None,
        margin_repay_amount=None,
        source_endpoint="fixture",
        provider_run_id=provider_run_id,
        collected_at=collected_at
    )
    return row, {"mode": "fixture"}, []


def build_real_row(as_of: str, provider_run_id: str, collected_at: str) -> tuple[dict[str, Any], dict[str, Any], list[str]]:
    ak = load_akshare_module()
    warnings: list[str] = []
    if not hasattr(ak, "stock_zh_a_spot_em"):
        raise RuntimeError("AKShare function stock_zh_a_spot_em is unavailable; cannot calculate A-share turnover and breadth.")

    spot_rows = dataframe_records(ak.stock_zh_a_spot_em())
    total_amount = 0.0
    up_count = 0
    down_count = 0
    flat_count = 0
    active_count = 0

    for row in spot_rows:
        pct_change = numeric_value(row.get("涨跌幅"))
        amount = numeric_value(row.get("成交额"))
        if amount is not None and amount > 0:
            total_amount += amount
        if pct_change is None:
            continue
        active_count += 1
        if pct_change > 0:
            up_count += 1
        elif pct_change < 0:
            down_count += 1
        else:
            flat_count += 1

    if active_count == 0:
        raise RuntimeError("AKShare stock_zh_a_spot_em returned no usable pct_change rows.")

    margin = collect_margin_snapshot(ak, warnings)
    return (
        build_row(
            as_of=as_of,
            total_amount=total_amount,
            up_count=up_count,
            down_count=down_count,
            flat_count=flat_count,
            active_count=active_count,
            margin_balance=margin.get("margin_balance"),
            margin_buy_amount=margin.get("margin_buy_amount"),
            margin_repay_amount=margin.get("margin_repay_amount"),
            source_endpoint="stock_zh_a_spot_em+optional_margin",
            provider_run_id=provider_run_id,
            collected_at=collected_at
        ),
        {
            "mode": "real",
            "spot_rows_sample": spot_rows[:10],
            "margin": margin
        },
        warnings
    )


def collect_margin_snapshot(ak: Any, warnings: list[str]) -> dict[str, Any]:
    """Best-effort margin snapshot.

    AKShare's margin endpoint names and schemas have changed across versions.
    This function intentionally treats margin as optional so market turnover and
    breadth remain available when margin data cannot be collected.
    """
    candidates = [
        "stock_margin_sse",
        "stock_margin_szse",
        "stock_margin_detail_sse",
        "stock_margin_detail_szse"
    ]
    for name in candidates:
        if not hasattr(ak, name):
            continue
        try:
            rows = dataframe_records(getattr(ak, name)())
        except Exception as error:  # noqa: BLE001
            warnings.append(f"Optional AKShare margin endpoint failed: {name}: {error}")
            continue
        if not rows:
            continue
        latest = rows[-1]
        return {
            "endpoint": name,
            "margin_balance": first_numeric(latest, ["融资余额", "融资余额(元)", "融资融券余额", "融资融券余额(元)"]),
            "margin_buy_amount": first_numeric(latest, ["融资买入额", "融资买入额(元)"]),
            "margin_repay_amount": first_numeric(latest, ["融资偿还额", "融资偿还额(元)"]),
            "raw_latest": latest
        }
    warnings.append("No compatible AKShare margin endpoint produced data; margin_balance is left empty.")
    return {}


def build_row(
    *,
    as_of: str,
    total_amount: Any,
    up_count: Any,
    down_count: Any,
    flat_count: Any,
    active_count: Any,
    margin_balance: Any,
    margin_buy_amount: Any,
    margin_repay_amount: Any,
    source_endpoint: str,
    provider_run_id: str,
    collected_at: str
) -> dict[str, Any]:
    breadth_ratio = None
    if active_count:
        breadth_ratio = (float(up_count) - float(down_count)) / float(active_count)
    return {
        "date": as_of,
        "total_amount": total_amount,
        "up_count": up_count,
        "down_count": down_count,
        "flat_count": flat_count,
        "active_count": active_count,
        "breadth_ratio": breadth_ratio,
        "margin_balance": margin_balance,
        "margin_buy_amount": margin_buy_amount,
        "margin_repay_amount": margin_repay_amount,
        "source_provider": "akshare",
        "source_endpoint": source_endpoint,
        "provider_run_id": provider_run_id,
        "collected_at": collected_at
    }


def load_akshare_module() -> Any:
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


def upsert_csv(path: Path, rows: list[dict[str, Any]], key_columns: list[str]) -> None:
    existing = read_existing_csv(path)
    by_key = {row_key(row, key_columns): row for row in existing}
    for row in rows:
        by_key[row_key(row, key_columns)] = row
    merged = sorted(by_key.values(), key=lambda row: row_key(row, key_columns))
    write_row_csv(path, merged)


def write_row_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    with temp_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS, extrasaction="ignore")
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


def dataframe_records(dataframe: Any) -> list[dict[str, Any]]:
    return json.loads(dataframe.to_json(orient="records", force_ascii=False))


def first_numeric(row: dict[str, Any], keys: list[str]) -> float | None:
    for key in keys:
        value = numeric_value(row.get(key))
        if value is not None:
            return value
    return None


def numeric_value(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp_path.replace(path)


if __name__ == "__main__":
    raise SystemExit(main())
