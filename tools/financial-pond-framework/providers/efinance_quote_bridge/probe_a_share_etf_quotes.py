#!/usr/bin/env python3
"""Probe efinance coverage for representative A-share industry ETFs.

This probe is intentionally separate from the graph core. It checks whether
efinance can provide quote-style ETF fields that can cross-check AKShare.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROBE_ID = "efinance_a_share_etf_quote_probe"


def main() -> int:
    args = parse_args()
    root_dir = Path(args.root_dir).resolve()
    contract_path = Path(args.contract).resolve() if args.contract else default_contract_path(root_dir)
    contract = read_json(contract_path)
    as_of = args.as_of or datetime.now(timezone.utc).date().isoformat()
    started_at = datetime.now(timezone.utc).isoformat()

    if args.fixture:
        rows = build_fixture_rows(contract, as_of, started_at)
        status = "ok"
        errors: list[str] = []
        warnings: list[str] = []
    else:
        rows, status, errors, warnings = build_real_rows(contract, as_of, started_at)

    field_coverage = summarize_field_coverage(rows, ["close", "pct_change", "amount", "volume", "turnover"])
    usable_quote_records = sum(1 for row in rows if row_has_quote_value(row))
    if status == "ok" and rows and usable_quote_records == 0:
        status = "no_usable_fields"
        warnings.append(
            "efinance returned representative rows, but no close, pct_change, amount, volume, or turnover fields were usable."
        )

    report = {
        "probe_id": PROBE_ID,
        "provider": "efinance",
        "mode": "fixture" if args.fixture else "real",
        "status": status,
        "as_of": as_of,
        "started_at": started_at,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "errors": errors,
        "warnings": warnings,
        "records": len(rows),
        "usable_quote_records": usable_quote_records,
        "field_coverage": field_coverage,
        "rows": rows
    }

    raw_path = root_dir / "raw_data" / "provider" / "efinance" / as_of / "a_share_etf_quote_probe.json"
    report_path = root_dir / "model_outputs" / "provider_probes" / "efinance_a_share_etf_quote_probe.json"
    csv_path = root_dir / "data" / "provider_probes" / "efinance_a_share_etf_quotes.csv"
    write_json(raw_path, report)
    write_json(report_path, report)
    write_csv(csv_path, rows)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Probe efinance A-share ETF quote coverage.")
    parser.add_argument("--root-dir", default=Path(__file__).resolve().parents[2], help="Project root directory.")
    parser.add_argument("--contract", default=None, help="Representative ETF provider contract JSON path.")
    parser.add_argument("--as-of", default=None, help="Probe date in YYYY-MM-DD format.")
    parser.add_argument("--fixture", action="store_true", help="Write deterministic fixture output without importing efinance.")
    return parser.parse_args()


def default_contract_path(root_dir: Path) -> Path:
    root_candidate = root_dir / "providers" / "akshare_etf_bridge" / "provider_contract.json"
    if root_candidate.exists():
        return root_candidate
    return Path(__file__).resolve().parents[1] / "akshare_etf_bridge" / "provider_contract.json"


def build_fixture_rows(contract: dict[str, Any], as_of: str, collected_at: str) -> list[dict[str, Any]]:
    rows = []
    for index, item in enumerate(contract["representative_etfs"], start=1):
        rows.append(
            build_row(
                item=item,
                as_of=as_of,
                collected_at=collected_at,
                fund_name=f"efinance {item['fund_name_hint']}",
                close=0.9 + index * 0.041,
                pct_change=((index % 4) - 1.5) * 0.7,
                amount=160_000_000 + index * 42_000_000,
                volume=90_000_000 + index * 3_000_000,
                turnover=0.8 + index * 0.11,
                source_endpoint="fixture"
            )
        )
    return rows


def build_real_rows(contract: dict[str, Any], as_of: str, collected_at: str) -> tuple[list[dict[str, Any]], str, list[str], list[str]]:
    if os.environ.get("FINANCIAL_POND_FORCE_MISSING_EFINANCE") == "1":
        return [], "missing_dependency", ["efinance probe forced missing by test environment."], []

    try:
        import efinance as ef  # type: ignore[import-not-found]
    except Exception as error:  # noqa: BLE001
        return [], "missing_dependency", [f"efinance is not installed: {error}"], []

    rows = []
    errors = []
    warnings = []
    for item in contract["representative_etfs"]:
        try:
            quote = load_latest_quote(ef, item["fund_code"])
            rows.append(
                build_row(
                    item=item,
                    as_of=as_of,
                    collected_at=collected_at,
                    fund_name=string_value(first_value(quote, ["股票名称", "名称", "基金名称", "name"])) or item["fund_name_hint"],
                    close=numeric_value(first_value(quote, ["收盘", "收盘价", "最新价", "close"])),
                    pct_change=numeric_value(first_value(quote, ["涨跌幅", "pct_change"])),
                    amount=numeric_value(first_value(quote, ["成交额", "amount"])),
                    volume=numeric_value(first_value(quote, ["成交量", "volume"])),
                    turnover=numeric_value(first_value(quote, ["换手率", "turnover"])),
                    source_endpoint=string_value(quote.get("_source_endpoint")) or "efinance"
                )
            )
        except Exception as error:  # noqa: BLE001
            warnings.append(f"{item['fund_code']} probe failed: {error}")

    status = "ok" if rows else "error"
    if not rows and not errors:
        errors.append("efinance probe returned no representative ETF rows.")
    return rows, status, errors, warnings


def load_latest_quote(ef: Any, fund_code: str) -> dict[str, Any]:
    candidates = []
    if hasattr(ef, "fund") and hasattr(ef.fund, "get_quote_history"):
        candidates.append(("ef.fund.get_quote_history", ef.fund.get_quote_history))
    if hasattr(ef, "stock") and hasattr(ef.stock, "get_quote_history"):
        candidates.append(("ef.stock.get_quote_history", ef.stock.get_quote_history))

    last_error: Exception | None = None
    for endpoint_id, function in candidates:
        for query_code in code_candidates(fund_code):
            try:
                dataframe = function(query_code)
                records = dataframe_records(dataframe)
                if records:
                    latest = records[-1]
                    latest["_source_endpoint"] = endpoint_id
                    latest["_query_code"] = query_code
                    if quote_record_has_supported_fields(latest):
                        return latest
            except Exception as error:  # noqa: BLE001
                last_error = error
    if last_error:
        raise last_error
    raise RuntimeError("No supported efinance quote endpoint found.")


def code_candidates(fund_code: str) -> list[str]:
    # efinance emits noisy "code may be wrong" messages and can block for a long
    # time when ETF codes are tried with sh/sz prefixes. Keep real probing
    # conservative: one canonical code, then report whether fields are usable.
    return [fund_code]


def quote_record_has_supported_fields(row: dict[str, Any]) -> bool:
    return any(
        first_value(row, keys) not in (None, "")
        for keys in [
            ["收盘", "收盘价", "最新价", "close"],
            ["涨跌幅", "pct_change"],
            ["成交额", "amount"],
            ["成交量", "volume"],
            ["换手率", "turnover"]
        ]
    )


def build_row(
    *,
    item: dict[str, Any],
    as_of: str,
    collected_at: str,
    fund_name: str,
    close: Any,
    pct_change: Any,
    amount: Any,
    volume: Any,
    turnover: Any,
    source_endpoint: str
) -> dict[str, Any]:
    return {
        "date": as_of,
        "provider": "efinance",
        "sector_id": item["sector_id"],
        "sector_node_id": item["sector_node_id"],
        "fund_code": item["fund_code"],
        "fund_name": fund_name,
        "close": close,
        "pct_change": pct_change,
        "amount": amount,
        "volume": volume,
        "turnover": turnover,
        "source_endpoint": source_endpoint,
        "collected_at": collected_at
    }


def summarize_field_coverage(rows: list[dict[str, Any]], fields: list[str]) -> dict[str, Any]:
    return {
        field: {
            "present": sum(1 for row in rows if row.get(field) not in (None, "")),
            "total": len(rows)
        }
        for field in fields
    }


def row_has_quote_value(row: dict[str, Any]) -> bool:
    return any(row.get(field) not in (None, "") for field in ["close", "pct_change", "amount", "volume", "turnover"])


def first_value(row: dict[str, Any], keys: list[str]) -> Any:
    for key in keys:
        if key in row and row[key] not in (None, ""):
            return row[key]
    return None


def dataframe_records(dataframe: Any) -> list[dict[str, Any]]:
    return json.loads(dataframe.to_json(orient="records", force_ascii=False))


def numeric_value(value: Any) -> float | None:
    if value in (None, "", "None"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def string_value(value: Any) -> str:
    return "" if value is None else str(value).strip()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp_path.replace(path)


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    columns = ["date", "provider", "sector_id", "sector_node_id", "fund_code", "fund_name", "close", "pct_change", "amount", "volume", "turnover", "source_endpoint", "collected_at"]
    temp_path = path.with_suffix(path.suffix + ".tmp")
    with temp_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    temp_path.replace(path)


if __name__ == "__main__":
    raise SystemExit(main())
