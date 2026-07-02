#!/usr/bin/env python3
"""Validate AKShare ETF bridge export files against the provider contract."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


VALIDATOR_ID = "akshare_etf_bridge_export_validator"


def main() -> int:
    args = parse_args()
    root_dir = Path(args.root_dir).resolve()
    contract_path = Path(args.contract).resolve() if args.contract else Path(__file__).with_name("provider_contract.json")
    contract = read_json(contract_path)
    row_csv_path = root_dir / "data" / "provider_exports" / "a_share_etf_daily.csv"
    sector_csv_path = root_dir / "data" / "provider_exports" / "a_share_sector_flow.csv"

    report = validate_exports(contract, row_csv_path, sector_csv_path)
    append_provider_run_check(report, root_dir, args.require_latest_run_ok)
    report.update(
        {
            "validator_id": VALIDATOR_ID,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "row_csv": str(row_csv_path.relative_to(root_dir)),
            "sector_flow_csv": str(sector_csv_path.relative_to(root_dir))
        }
    )

    output_path = root_dir / "model_outputs" / "provider_validation" / "akshare_etf_bridge_validation.json"
    write_json(output_path, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] in ("ok", "partial") else 2


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate AKShare ETF bridge exports.")
    parser.add_argument("--root-dir", default=Path(__file__).resolve().parents[2], help="Project root directory.")
    parser.add_argument("--contract", default=None, help="Provider contract JSON path.")
    parser.add_argument(
        "--require-latest-run-ok",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Require the latest AKShare bridge run-status file to be ok."
    )
    return parser.parse_args()


def validate_exports(contract: dict[str, Any], row_csv_path: Path, sector_csv_path: Path) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    partial_reasons: list[str] = []

    row_records = read_csv(row_csv_path, errors)
    sector_records = read_csv(sector_csv_path, errors)

    row_columns = set(row_records[0].keys()) if row_records else set()
    sector_columns = set(sector_records[0].keys()) if sector_records else set()

    missing_row_columns = [column for column in contract["row_level_columns"] if column not in row_columns]
    missing_sector_columns = [column for column in contract["sector_flow_columns"] if column not in sector_columns]
    if missing_row_columns:
        errors.append(f"Missing row CSV columns: {', '.join(missing_row_columns)}")
    if missing_sector_columns:
        errors.append(f"Missing sector flow CSV columns: {', '.join(missing_sector_columns)}")

    expected_codes = {item["fund_code"] for item in contract["representative_etfs"]}
    observed_codes = {row.get("fund_code", "") for row in row_records}
    missing_codes = sorted(expected_codes - observed_codes)
    if missing_codes:
        partial_reasons.append(f"Missing representative ETF codes: {', '.join(missing_codes)}")

    dates = sorted({row.get("date", "") for row in row_records if row.get("date")})
    sector_dates = sorted({row.get("date", "") for row in sector_records if row.get("date")})
    if dates != sector_dates:
        warnings.append("Row-level dates and sector-flow dates differ.")
    if len(dates) < 2:
        warnings.append("Fewer than two dates are available; change-based normalization will be weak.")

    empty_flow_columns = []
    for column in contract["sector_flow_columns"]:
        if column == "date":
            continue
        if all(record.get(column, "") in ("", "None", None) for record in sector_records):
            empty_flow_columns.append(column)
    if empty_flow_columns:
        if len(dates) < 2 and not missing_sector_columns and sector_records:
            warnings.append(
                "Sector flow columns have no values yet. This is acceptable for a first baseline run; "
                "run the provider again on a later trading date before enabling ETF-flow sources."
            )
        else:
            partial_reasons.append(f"Sector flow columns have no values: {', '.join(empty_flow_columns)}")

    flow_readiness = build_flow_readiness(dates, empty_flow_columns, errors)
    status = "error" if errors else ("partial" if partial_reasons else "ok")

    return {
        "status": status,
        "errors": errors,
        "warnings": warnings,
        "partial_reasons": partial_reasons,
        "flow_readiness": flow_readiness,
        "counts": {
            "row_records": len(row_records),
            "sector_flow_records": len(sector_records),
            "dates": len(dates),
            "representative_codes_expected": len(expected_codes),
            "representative_codes_observed": len(observed_codes)
        },
        "dates": dates
    }


def build_flow_readiness(dates: list[str], empty_flow_columns: list[str], errors: list[str]) -> dict[str, Any]:
    if errors:
        status = "blocked"
        reason = "Validation errors must be fixed before ETF-flow sources are reviewed."
    elif len(dates) < 2 and empty_flow_columns:
        status = "baseline_only"
        reason = "Only one date is available. Latest share can be stored, but share-change flow needs a later date."
    elif empty_flow_columns:
        status = "incomplete"
        reason = "Some ETF-flow columns are empty."
    else:
        status = "ready_for_manual_review"
        reason = "ETF-flow columns have values and can be reviewed before source enabling."

    return {
        "status": status,
        "reason": reason,
        "empty_flow_columns": empty_flow_columns
    }


def append_provider_run_check(report: dict[str, Any], root_dir: Path, required: bool) -> None:
    run_dir = root_dir / "model_outputs" / "provider_runs"
    runs = sorted(run_dir.glob("akshare_etf_bridge_*.json")) if run_dir.exists() else []
    report["latest_run"] = None
    if not runs:
        message = "No AKShare bridge run-status file found."
        (report["errors"] if required else report["warnings"]).append(message)
        report["status"] = "error" if required else report["status"]
        return

    latest_path = max(runs, key=lambda path: path.stat().st_mtime)
    try:
        latest = read_json(latest_path)
    except Exception as error:  # noqa: BLE001
        report["errors"].append(f"Could not read latest run-status file: {error}")
        report["status"] = "error"
        return

    report["latest_run"] = {
        "path": str(latest_path.relative_to(root_dir)),
        "mode": latest.get("mode"),
        "as_of": latest.get("as_of"),
        "status": latest.get("status"),
        "errors": latest.get("errors", [])
    }

    if required and latest.get("status") not in ("ok", "partial"):
        report["errors"].append(
            f"Latest AKShare bridge run is not ok: {latest.get('status')} at {latest_path.name}"
        )
        report["status"] = "error"
    elif required and latest.get("status") == "partial":
        report["warnings"].append(
            f"Latest AKShare bridge run is partial: {latest_path.name}. Review missing codes before using flow as strong evidence."
        )
        if report["status"] == "ok":
            report["status"] = "partial"


def read_csv(path: Path, errors: list[str]) -> list[dict[str, str]]:
    if not path.exists():
        errors.append(f"Missing file: {path}")
        return []
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp_path.replace(path)


if __name__ == "__main__":
    raise SystemExit(main())
