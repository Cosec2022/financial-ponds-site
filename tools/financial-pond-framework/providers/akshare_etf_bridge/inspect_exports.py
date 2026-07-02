#!/usr/bin/env python3
"""Inspect AKShare ETF bridge exports before enabling collector sources.

This script is intentionally read-only against model configuration. It reviews
provider output quality and writes an inspection report, but it never enables
collector sources or changes graph behavior.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


INSPECTOR_ID = "akshare_etf_bridge_export_inspector"


def main() -> int:
    args = parse_args()
    root_dir = Path(args.root_dir).resolve()
    contract_path = Path(args.contract).resolve() if args.contract else Path(__file__).with_name("provider_contract.json")
    contract = read_json(contract_path)
    row_csv_path = root_dir / "data" / "provider_exports" / "a_share_etf_daily.csv"
    sector_csv_path = root_dir / "data" / "provider_exports" / "a_share_sector_flow.csv"

    report = inspect_exports(contract, row_csv_path, sector_csv_path, args.as_of)
    report.update(
        {
            "inspector_id": INSPECTOR_ID,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "row_csv": str(row_csv_path.relative_to(root_dir)),
            "sector_flow_csv": str(sector_csv_path.relative_to(root_dir))
        }
    )

    output_dir = root_dir / "model_outputs" / "provider_inspection"
    json_path = output_dir / "akshare_etf_bridge_inspection.json"
    markdown_path = output_dir / "akshare_etf_bridge_inspection.md"
    write_json(json_path, report)
    write_text(markdown_path, render_markdown(report))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "ok" else 2


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Inspect AKShare ETF bridge exports before source enabling.")
    parser.add_argument("--root-dir", default=Path(__file__).resolve().parents[2], help="Project root directory.")
    parser.add_argument("--contract", default=None, help="Provider contract JSON path.")
    parser.add_argument("--as-of", default=None, help="Inspect a specific date in YYYY-MM-DD format. Defaults to latest CSV date.")
    return parser.parse_args()


def inspect_exports(
    contract: dict[str, Any],
    row_csv_path: Path,
    sector_csv_path: Path,
    requested_date: str | None
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    row_records = read_csv(row_csv_path, errors)
    sector_records = read_csv(sector_csv_path, errors)

    dates = sorted({row.get("date", "") for row in row_records if row.get("date")})
    as_of = requested_date or (dates[-1] if dates else None)
    if requested_date and requested_date not in dates:
        errors.append(f"Requested date is not present in row CSV: {requested_date}")
    if as_of is None:
        errors.append("No dated row records are available for inspection.")

    expected_by_code = {item["fund_code"]: item for item in contract["representative_etfs"]}
    latest_rows = [row for row in row_records if row.get("date") == as_of]
    sector_row = next((row for row in sector_records if row.get("date") == as_of), None)

    missing_codes = sorted(set(expected_by_code) - {row.get("fund_code", "") for row in latest_rows})
    extra_codes = sorted({row.get("fund_code", "") for row in latest_rows} - set(expected_by_code))
    if missing_codes:
        errors.append(f"Missing representative ETF codes on {as_of}: {', '.join(missing_codes)}")
    if extra_codes:
        warnings.append(f"Unexpected ETF codes on {as_of}: {', '.join(extra_codes)}")
    if sector_row is None and as_of is not None:
        errors.append(f"Missing sector-flow row on {as_of}")

    row_findings = []
    source_recommendations = []
    for item in contract["representative_etfs"]:
        row = next((record for record in latest_rows if record.get("fund_code") == item["fund_code"]), None)
        finding = inspect_row(item, row)
        row_findings.append(finding)
        if finding["enable_candidate"]:
            source_recommendations.append(
                {
                    "node_id": item["sector_node_id"],
                    "sector_id": item["sector_id"],
                    "fund_code": item["fund_code"],
                    "recommendation": "candidate_for_manual_review",
                    "reason": "Latest row has positive price, positive amount, and non-empty estimated_flow."
                }
            )
        else:
            source_recommendations.append(
                {
                    "node_id": item["sector_node_id"],
                    "sector_id": item["sector_id"],
                    "fund_code": item["fund_code"],
                    "recommendation": "keep_disabled",
                    "reason": finding["blocking_reason"]
                }
            )
            warnings.append(f"{item['sector_node_id']} should remain disabled: {finding['blocking_reason']}")

    sector_flow_findings = inspect_sector_flow_columns(contract, sector_row)
    for finding in sector_flow_findings:
        if not finding["has_value"]:
            warnings.append(f"{finding['column']} has no latest sector-flow value on {as_of}")

    ranked_by_amount = sorted(
        [item for item in row_findings if item["amount"] is not None],
        key=lambda item: item["amount"],
        reverse=True
    )
    ranked_by_estimated_flow = sorted(
        [item for item in row_findings if item["estimated_flow"] is not None],
        key=lambda item: item["estimated_flow"],
        reverse=True
    )

    has_enable_candidate = any(item["recommendation"] == "candidate_for_manual_review" for item in source_recommendations)
    status = "ok" if not errors else "error"
    overall_recommendation = "review_candidates_before_enabling" if status == "ok" and has_enable_candidate else "keep_all_provider_sources_disabled"

    return {
        "status": status,
        "errors": errors,
        "warnings": warnings,
        "as_of": as_of,
        "counts": {
            "dates": len(dates),
            "row_records_total": len(row_records),
            "sector_flow_records_total": len(sector_records),
            "latest_row_records": len(latest_rows),
            "expected_representative_codes": len(expected_by_code),
            "missing_representative_codes": len(missing_codes),
            "enable_candidates": sum(1 for item in source_recommendations if item["recommendation"] == "candidate_for_manual_review")
        },
        "overall_recommendation": overall_recommendation,
        "row_findings": row_findings,
        "sector_flow_findings": sector_flow_findings,
        "source_recommendations": source_recommendations,
        "ranked_by_amount": ranked_by_amount,
        "ranked_by_estimated_flow": ranked_by_estimated_flow
    }


def inspect_row(item: dict[str, Any], row: dict[str, str] | None) -> dict[str, Any]:
    if row is None:
        return {
            "sector_id": item["sector_id"],
            "node_id": item["sector_node_id"],
            "fund_code": item["fund_code"],
            "fund_name": None,
            "close": None,
            "amount": None,
            "latest_share": None,
            "estimated_flow": None,
            "enable_candidate": False,
            "blocking_reason": "missing latest ETF row"
        }

    close = parse_number(row.get("close"))
    amount = parse_number(row.get("amount"))
    latest_share = parse_number(row.get("latest_share"))
    estimated_flow = parse_number(row.get("estimated_flow"))
    blockers = []
    if close is None or close <= 0:
        blockers.append("close is missing or not positive")
    if amount is None or amount <= 0:
        blockers.append("amount is missing or not positive")
    if latest_share is None or latest_share <= 0:
        blockers.append("latest_share is missing or not positive")
    if estimated_flow is None:
        blockers.append("estimated_flow is missing")

    return {
        "sector_id": item["sector_id"],
        "node_id": item["sector_node_id"],
        "fund_code": item["fund_code"],
        "fund_name": row.get("fund_name") or None,
        "close": close,
        "amount": amount,
        "latest_share": latest_share,
        "estimated_flow": estimated_flow,
        "enable_candidate": not blockers,
        "blocking_reason": "; ".join(blockers) if blockers else ""
    }


def inspect_sector_flow_columns(contract: dict[str, Any], sector_row: dict[str, str] | None) -> list[dict[str, Any]]:
    findings = []
    for column in contract["sector_flow_columns"]:
        if column == "date":
            continue
        raw_value = None if sector_row is None else sector_row.get(column)
        value = parse_number(raw_value)
        findings.append(
            {
                "column": column,
                "value": value,
                "has_value": value is not None
            }
        )
    return findings


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# AKShare ETF Bridge Inspection",
        "",
        f"- Status: `{report['status']}`",
        f"- As of: `{report.get('as_of')}`",
        f"- Overall recommendation: `{report['overall_recommendation']}`",
        f"- Enable candidates: `{report['counts']['enable_candidates']}`",
        ""
    ]
    if report["errors"]:
        lines.extend(["## Errors", ""])
        lines.extend([f"- {item}" for item in report["errors"]])
        lines.append("")
    if report["warnings"]:
        lines.extend(["## Warnings", ""])
        lines.extend([f"- {item}" for item in report["warnings"]])
        lines.append("")

    lines.extend(["## Source Recommendations", ""])
    lines.extend(["| Node | Sector | Fund | Recommendation | Reason |", "|---|---|---|---|---|"])
    for item in report["source_recommendations"]:
        lines.append(
            f"| `{item['node_id']}` | `{item['sector_id']}` | `{item['fund_code']}` | "
            f"`{item['recommendation']}` | {item['reason']} |"
        )

    lines.extend(["", "## Ranked By Amount", ""])
    lines.extend(["| Fund | Name | Sector | Amount | Estimated Flow |", "|---|---|---|---:|---:|"])
    for item in report["ranked_by_amount"]:
        lines.append(
            f"| `{item['fund_code']}` | {item.get('fund_name') or ''} | `{item['sector_id']}` | "
            f"{format_number(item.get('amount'))} | {format_number(item.get('estimated_flow'))} |"
        )

    lines.extend(["", "## Ranked By Estimated Flow", ""])
    lines.extend(["| Fund | Name | Sector | Estimated Flow | Amount |", "|---|---|---|---:|---:|"])
    for item in report["ranked_by_estimated_flow"]:
        lines.append(
            f"| `{item['fund_code']}` | {item.get('fund_name') or ''} | `{item['sector_id']}` | "
            f"{format_number(item.get('estimated_flow'))} | {format_number(item.get('amount'))} |"
        )
    lines.append("")
    return "\n".join(lines)


def parse_number(value: Any) -> float | None:
    if value in (None, "", "None"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def format_number(value: Any) -> str:
    parsed = parse_number(value)
    if parsed is None:
        return ""
    return f"{parsed:,.2f}"


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


def write_text(path: Path, payload: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(payload, encoding="utf-8")
    temp_path.replace(path)


if __name__ == "__main__":
    raise SystemExit(main())
