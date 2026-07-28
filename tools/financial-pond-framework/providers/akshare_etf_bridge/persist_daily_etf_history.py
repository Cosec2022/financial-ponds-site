#!/usr/bin/env python3
"""Persist one verified daily AKShare ETF output into cumulative history."""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


EXTRA_HISTORY_COLUMNS = ["open", "high", "low", "volume", "historical_input"]
OHLCVA_FIELDS = ("open", "high", "low", "close", "volume", "amount")
SNAPSHOT_UPDATE_FIELDS = (
    "latest_share",
    "previous_share",
    "share_change",
    "estimated_flow",
    "pct_change",
    "turnover",
    "provider_run_id",
    "collected_at",
)
BACKFILL_PROVENANCE_FIELDS = (
    "historical_input",
    "backfill_source_provider",
    "backfill_source_endpoint",
    "retrieved_at",
    "backfilled_at",
    "cutoff_date",
)


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf8"))


def daily_output_path(root: Path, as_of: str) -> Path:
    return root / "data" / "provider_exports" / "daily" / f"a_share_etf_daily_{as_of}.json"


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    if not path.exists():
        return [], []
    with path.open(newline="", encoding="utf8") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def numeric(value: Any) -> float | None:
    try:
        number = float(value)
        return number if number > 0 else None
    except (TypeError, ValueError):
        return None


def exact_trade_date(row: dict[str, Any]) -> str:
    return str(row.get("trade_date") or row.get("date") or "")


def complete_valid_bar(row: dict[str, Any]) -> bool:
    values = {field: numeric(row.get(field)) for field in OHLCVA_FIELDS}
    if any(value is None for value in values.values()):
        return False
    return (
        values["low"] <= min(values["open"], values["close"])
        <= max(values["open"], values["close"]) <= values["high"]
    )


def merge_daily_row(existing: dict[str, Any], incoming: dict[str, Any], trade_date: str) -> dict[str, Any]:
    """Merge one exact-date snapshot without ever creating a hybrid OHLCVA bar."""
    old_complete = complete_valid_bar(existing)
    incoming_complete = complete_valid_bar(incoming)

    if incoming_complete:
        merged = {**existing, **incoming}
        for field in OHLCVA_FIELDS:
            merged[field] = incoming.get(field)
    elif old_complete:
        merged = dict(existing)
        for field in SNAPSHOT_UPDATE_FIELDS:
            if incoming.get(field) not in (None, ""):
                merged[field] = incoming[field]
    else:
        # A partial spot row is one atomic partial price observation. Do not retain
        # old high/low/volume fields and combine them with a new spot close/amount.
        merged = {**existing, **incoming}
        for field in OHLCVA_FIELDS:
            merged[field] = incoming.get(field)
        for field in BACKFILL_PROVENANCE_FIELDS:
            merged[field] = incoming.get(field, "")

    merged["date"] = trade_date
    merged["trade_date"] = trade_date
    return merged


def validate_daily_rows(payload: dict[str, Any], contract: dict[str, Any], as_of: str) -> list[dict[str, Any]]:
    if payload.get("status") != "ok":
        return []
    if payload.get("as_of") != as_of or payload.get("provider") != "akshare":
        raise ValueError("daily provider output metadata does not match the requested exact date/provider")

    expected = {item["fund_code"]: item for item in contract.get("representative_etfs", [])}
    rows = payload.get("rows")
    if not isinstance(rows, list):
        raise ValueError("daily provider output rows are missing")
    if len(rows) != len(expected):
        raise ValueError(f"daily provider output must contain {len(expected)} representative ETF rows")

    validated: dict[str, dict[str, Any]] = {}
    payload_run_id = str(payload.get("provider_run_id") or "")
    for original in rows:
        row = dict(original)
        code = str(row.get("fund_code") or "")
        required_text = [
            row.get("date"), row.get("sector_id"), row.get("sector_node_id"), code,
            row.get("fund_name"), row.get("source_provider"), row.get("source_endpoint"),
            row.get("provider_run_id"), row.get("collected_at")
        ]
        if any(value in (None, "") for value in required_text):
            raise ValueError(f"daily provider row has incomplete identity/source fields: {code or '<missing>'}")
        trade_date = exact_trade_date(row)
        if row["date"] != as_of or trade_date != as_of:
            raise ValueError(f"daily provider row is not exact-date {as_of}: {code} {trade_date}")
        if code not in expected:
            raise ValueError(f"daily provider row is not a representative industry ETF: {code}")
        if row["sector_id"] != expected[code]["sector_id"] or row["sector_node_id"] != expected[code]["sector_node_id"]:
            raise ValueError(f"daily provider row mapping does not match the contract: {code}")
        if row["source_provider"] != "akshare" or (payload_run_id and row["provider_run_id"] != payload_run_id):
            raise ValueError(f"daily provider row source metadata is inconsistent: {code}")
        if numeric(row.get("close")) is None or numeric(row.get("amount")) is None:
            raise ValueError(f"daily provider row lacks a positive close/amount: {code}")
        if all(row.get(field) not in (None, "") for field in OHLCVA_FIELDS) and not complete_valid_bar(row):
            raise ValueError(f"daily provider row has an invalid OHLCVA relationship: {code}")
        if code in validated:
            raise ValueError(f"daily provider output contains duplicate ETF code: {code}")
        row["date"] = as_of
        row["trade_date"] = as_of
        validated[code] = row

    missing = sorted(set(expected) - set(validated))
    if missing:
        raise ValueError("daily provider output missed representative ETF codes: " + ", ".join(missing))
    return [validated[code] for code in sorted(validated)]


def persist_daily_output(root: Path, contract: dict[str, Any], as_of: str, input_path: Path | None = None) -> dict[str, Any]:
    source = input_path or daily_output_path(root, as_of)
    cumulative = root / "data" / "provider_exports" / "a_share_etf_daily.csv"
    fields, existing = read_csv(cumulative)
    before = len(existing)

    if not source.exists():
        return {"status": "no_provider_output", "as_of": as_of, "rows_written": 0, "source": str(source)}
    payload = read_json(source)
    daily_rows = validate_daily_rows(payload, contract, as_of)
    if not daily_rows:
        return {"status": "no_valid_provider_rows", "as_of": as_of, "rows_written": 0, "source": str(source)}

    # Historical replay is no-lookahead: preserve only rows at or before as_of.
    by_key: dict[tuple[str, str], dict[str, Any]] = {}
    for row in existing:
        trade_date = exact_trade_date(row)
        code = str(row.get("fund_code") or "")
        if not trade_date or trade_date > as_of or not code:
            continue
        normalized = {**row, "date": trade_date, "trade_date": trade_date}
        key = (code, trade_date)
        previous = by_key.get(key)
        if previous is None or (not complete_valid_bar(previous) and complete_valid_bar(normalized)):
            by_key[key] = normalized
        elif not complete_valid_bar(previous) and not complete_valid_bar(normalized):
            by_key[key] = normalized
    for row in daily_rows:
        key = (str(row["fund_code"]), as_of)
        by_key[key] = merge_daily_row(by_key.get(key, {}), row, as_of)

    output_fields = list(dict.fromkeys(fields + contract.get("row_level_columns", []) + EXTRA_HISTORY_COLUMNS))
    cumulative.parent.mkdir(parents=True, exist_ok=True)
    temp = cumulative.with_suffix(".csv.tmp")
    with temp.open("w", newline="", encoding="utf8") as handle:
        writer = csv.DictWriter(handle, fieldnames=output_fields, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        for row in sorted(by_key.values(), key=lambda item: (item.get("date", ""), item.get("fund_code", ""))):
            writer.writerow({field: row.get(field, "") for field in output_fields})
    temp.replace(cumulative)

    dates = sorted({row.get("date") for row in by_key.values() if row.get("date")})
    return {
        "status": "ok",
        "as_of": as_of,
        "source": str(source),
        "rows_before": before,
        "rows_after": len(by_key),
        "rows_written": len(daily_rows),
        "available_dates": dates,
        "latest_date": dates[-1] if dates else None
    }


def payload_from_verified_csv(path: Path, as_of: str, recovery_source: str) -> dict[str, Any]:
    _, rows = read_csv(path)
    exact_rows = [row for row in rows if row.get("date") == as_of]
    run_ids = {row.get("provider_run_id") for row in exact_rows if row.get("provider_run_id")}
    if len(run_ids) != 1:
        raise ValueError("verified recovery CSV must have one provider_run_id for the exact date")
    return {
        "schema_version": "akshare_daily_etf_rows_recovery_v1",
        "provider": "akshare",
        "mode": "verified_repository_recovery",
        "status": "ok",
        "as_of": as_of,
        "provider_run_id": next(iter(run_ids)),
        "recovery_source": recovery_source,
        "records": len(exact_rows),
        "rows": exact_rows
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Exact-date upsert of verified daily ETF rows into cumulative history.")
    parser.add_argument("--as-of", required=True)
    parser.add_argument("--root-dir", default=Path(__file__).resolve().parents[2])
    parser.add_argument("--contract", default=Path(__file__).with_name("provider_contract.json"))
    parser.add_argument("--input", default=None)
    parser.add_argument("--input-csv", default=None, help="Verified repository CSV used only for explicit exact-date recovery.")
    parser.add_argument("--recovery-source", default=None, help="Auditable repository ref/path for --input-csv.")
    args = parser.parse_args()
    root = Path(args.root_dir).resolve()
    contract = read_json(Path(args.contract).resolve())
    try:
        if args.input and args.input_csv:
            raise ValueError("use only one of --input or --input-csv")
        if args.input_csv:
            if not args.recovery_source:
                raise ValueError("--input-csv requires --recovery-source")
            recovery_path = Path(args.input_csv)
            payload = payload_from_verified_csv(recovery_path, args.as_of, args.recovery_source)
            recovery_json = daily_output_path(root, args.as_of)
            recovery_json.parent.mkdir(parents=True, exist_ok=True)
            recovery_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
            result = persist_daily_output(root, contract, args.as_of, recovery_json)
            result["recovery_source"] = args.recovery_source
        else:
            result = persist_daily_output(root, contract, args.as_of, Path(args.input).resolve() if args.input else None)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (ValueError, json.JSONDecodeError) as error:
        print(json.dumps({"status": "rejected", "as_of": args.as_of, "error": str(error)}, ensure_ascii=False, indent=2))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
