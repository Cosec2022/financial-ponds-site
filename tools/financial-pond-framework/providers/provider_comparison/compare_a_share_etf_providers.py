#!/usr/bin/env python3
"""Compare A-share ETF provider outputs without changing model inputs."""

from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


COMPARISON_ID = "a_share_etf_provider_comparison"


def main() -> int:
    args = parse_args()
    root_dir = Path(args.root_dir).resolve()
    contract_path = Path(args.contract).resolve() if args.contract else default_contract_path(root_dir)
    contract = read_json(contract_path)
    report = compare_providers(root_dir, contract)
    output_dir = root_dir / "model_outputs" / "provider_comparison"
    write_json(output_dir / "a_share_etf_provider_comparison.json", report)
    write_text(output_dir / "a_share_etf_provider_comparison.md", render_markdown(report))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] in ("ok", "partial") else 2


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compare A-share ETF provider outputs.")
    parser.add_argument("--root-dir", default=Path(__file__).resolve().parents[2], help="Project root directory.")
    parser.add_argument("--contract", default=None, help="Representative ETF provider contract JSON path.")
    return parser.parse_args()


def default_contract_path(root_dir: Path) -> Path:
    root_candidate = root_dir / "providers" / "akshare_etf_bridge" / "provider_contract.json"
    if root_candidate.exists():
        return root_candidate
    return Path(__file__).resolve().parents[1] / "akshare_etf_bridge" / "provider_contract.json"


def compare_providers(root_dir: Path, contract: dict[str, Any]) -> dict[str, Any]:
    akshare_rows = latest_rows_from_csv(root_dir / "data" / "provider_exports" / "a_share_etf_daily.csv")
    efinance_report = read_optional_json(root_dir / "model_outputs" / "provider_probes" / "efinance_a_share_etf_quote_probe.json")
    qstock_report = read_optional_json(root_dir / "model_outputs" / "provider_probes" / "qstock_a_share_structure_probe.json")
    efinance_rows = {row.get("fund_code"): row for row in efinance_report.get("rows", [])} if efinance_report else {}
    qstock_rows = {row.get("fund_code"): row for row in qstock_report.get("representative_etfs", [])} if qstock_report else {}

    comparisons = []
    for item in contract["representative_etfs"]:
        code = item["fund_code"]
        provider_rows = {
            "akshare": akshare_rows.get(code),
            "efinance": efinance_rows.get(code),
            "qstock": qstock_rows.get(code)
        }
        comparisons.append(compare_one(item, provider_rows))

    provider_status = {
        "akshare": provider_status_from_rows(akshare_rows),
        "efinance": provider_status_from_probe(efinance_report),
        "qstock": provider_status_from_probe(qstock_report)
    }
    available_provider_count = sum(1 for item in provider_status.values() if item["available"])
    quote_provider_count = sum(1 for item in provider_status.values() if item.get("usable_quote_records", 0) > 0)
    status = "ok" if quote_provider_count >= 2 else ("partial" if quote_provider_count == 1 else "error")
    recommendations = build_recommendations(provider_status, comparisons)

    return {
        "comparison_id": COMPARISON_ID,
        "status": status,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "provider_status": provider_status,
        "counts": {
            "representative_etfs": len(contract["representative_etfs"]),
            "providers_available": available_provider_count,
            "quote_providers_available": quote_provider_count,
            "multi_provider_rows": sum(1 for row in comparisons if row["available_provider_count"] >= 2),
            "cross_checked_quote_rows": sum(1 for row in comparisons if row["quote_provider_count"] >= 2)
        },
        "recommendations": recommendations,
        "comparisons": comparisons
    }


def compare_one(item: dict[str, Any], provider_rows: dict[str, dict[str, Any] | None]) -> dict[str, Any]:
    values = {}
    for provider, row in provider_rows.items():
        values[provider] = {
            "available": bool(row),
            "fund_name": None if not row else row.get("fund_name"),
            "close": None if not row else numeric_value(row.get("close")),
            "amount": None if not row else numeric_value(row.get("amount")),
            "pct_change": None if not row else numeric_value(row.get("pct_change"))
        }
        values[provider]["quote_available"] = quote_available(values[provider])
    close_values = [value["close"] for value in values.values() if value["close"] is not None]
    amount_values = [value["amount"] for value in values.values() if value["amount"] is not None]
    return {
        "sector_id": item["sector_id"],
        "node_id": item["sector_node_id"],
        "fund_code": item["fund_code"],
        "fund_name_hint": item["fund_name_hint"],
        "available_provider_count": sum(1 for value in values.values() if value["available"]),
        "quote_provider_count": sum(1 for value in values.values() if value["quote_available"]),
        "values": values,
        "close_spread_pct": spread_pct(close_values),
        "amount_spread_pct": spread_pct(amount_values),
        "recommended_use": recommendation_for_row(values, close_values, amount_values)
    }


def recommendation_for_row(values: dict[str, Any], close_values: list[float], amount_values: list[float]) -> str:
    if sum(1 for value in values.values() if value["quote_available"]) < 2:
        return "single_provider_only"
    if spread_pct(close_values) is not None and spread_pct(close_values) > 0.02:
        return "review_price_disagreement"
    if spread_pct(amount_values) is not None and spread_pct(amount_values) > 0.35:
        return "review_amount_disagreement"
    return "candidate_for_cross_checked_quote"


def build_recommendations(provider_status: dict[str, Any], comparisons: list[dict[str, Any]]) -> list[str]:
    messages = []
    if provider_status["akshare"]["available"]:
        messages.append("Keep AKShare as the primary source for ETF share and quote fields.")
    if provider_status["efinance"]["available"]:
        messages.append("Use efinance as a quote backup for close, pct_change, amount, and turnover-style fields.")
    elif provider_status["efinance"]["status"] == "no_usable_fields":
        messages.append("Do not treat efinance rows as backup quotes until close, pct_change, or amount fields are populated.")
    if provider_status["qstock"]["available"]:
        messages.append("Use qstock as a structure probe for ETF quotes plus industry/concept board coverage.")
    if any(item["recommended_use"] == "review_price_disagreement" for item in comparisons):
        messages.append("Do not enable affected quote sources until price disagreements are reviewed.")
    if not messages:
        messages.append("No provider is ready; keep all real-data collector sources disabled.")
    return messages


def latest_rows_from_csv(path: Path) -> dict[str, dict[str, Any]]:
    rows = read_csv(path)
    if not rows:
        return {}
    latest_date = sorted({row.get("date", "") for row in rows if row.get("date")})[-1]
    return {row.get("fund_code"): row for row in rows if row.get("date") == latest_date}


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def provider_status_from_rows(rows: dict[str, Any]) -> dict[str, Any]:
    usable = sum(1 for row in rows.values() if row_has_quote_value(row))
    return {
        "available": bool(rows),
        "records": len(rows),
        "usable_quote_records": usable,
        "status": "ok" if rows else "missing"
    }


def provider_status_from_probe(report: dict[str, Any] | None) -> dict[str, Any]:
    if not report:
        return {"available": False, "records": 0, "status": "missing"}
    records = report.get("records")
    if isinstance(records, dict):
        record_count = sum(int(value) for value in records.values() if isinstance(value, int))
    else:
        record_count = int(records or 0)
    usable_quote_records = int(report.get("usable_quote_records") or 0)
    if not usable_quote_records and report.get("representative_etfs"):
        usable_quote_records = sum(1 for row in report.get("representative_etfs", []) if row_has_quote_value(row))
    if not usable_quote_records and report.get("rows"):
        usable_quote_records = sum(1 for row in report.get("rows", []) if row_has_quote_value(row))
    return {
        "available": report.get("status") == "ok" and record_count > 0,
        "records": record_count,
        "usable_quote_records": usable_quote_records,
        "status": report.get("status")
    }


def quote_available(value: dict[str, Any]) -> bool:
    return any(value.get(field) is not None for field in ["close", "amount", "pct_change"])


def row_has_quote_value(row: dict[str, Any]) -> bool:
    return any(numeric_value(row.get(field)) is not None for field in ["close", "amount", "pct_change"])


def spread_pct(values: list[float]) -> float | None:
    if len(values) < 2:
        return None
    low = min(values)
    high = max(values)
    if low == 0:
        return None
    return (high - low) / abs(low)


def numeric_value(value: Any) -> float | None:
    if value in (None, "", "None"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def read_optional_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return read_json(path)


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


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# A-share ETF Provider Comparison",
        "",
        f"- Status: `{report['status']}`",
        f"- Providers available: `{report['counts']['providers_available']}`",
        f"- Quote providers available: `{report['counts']['quote_providers_available']}`",
        f"- Multi-provider ETF rows: `{report['counts']['multi_provider_rows']}`",
        f"- Cross-checked quote rows: `{report['counts']['cross_checked_quote_rows']}`",
        "",
        "## Provider Status",
        "",
        "| Provider | Status | Records | Usable Quote Records | Available |",
        "|---|---|---:|---:|---|"
    ]
    for provider, status in report["provider_status"].items():
        lines.append(
            f"| `{provider}` | `{status['status']}` | {status['records']} | "
            f"{status.get('usable_quote_records', 0)} | `{status['available']}` |"
        )

    lines.extend(["", "## Recommendations", ""])
    lines.extend([f"- {item}" for item in report["recommendations"]])
    lines.extend(["", "## ETF Comparison", ""])
    lines.extend(["| Fund | Sector | Providers | Quote Providers | Close Spread | Amount Spread | Recommendation |", "|---|---|---:|---:|---:|---:|---|"])
    for item in report["comparisons"]:
        close_spread = "" if item["close_spread_pct"] is None else f"{item['close_spread_pct']:.2%}"
        amount_spread = "" if item["amount_spread_pct"] is None else f"{item['amount_spread_pct']:.2%}"
        lines.append(
            f"| `{item['fund_code']}` | `{item['sector_id']}` | {item['available_provider_count']} | "
            f"{item['quote_provider_count']} | {close_spread} | {amount_spread} | `{item['recommended_use']}` |"
        )
    lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    raise SystemExit(main())
