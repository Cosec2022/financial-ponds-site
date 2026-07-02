#!/usr/bin/env python3
"""Probe qstock coverage for A-share ETF, industry, and concept structure.

This is a provider capability probe. It writes raw reports for manual review
and provider comparison, but it does not change collector configuration.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROBE_ID = "qstock_a_share_structure_probe"


def main() -> int:
    args = parse_args()
    root_dir = Path(args.root_dir).resolve()
    contract_path = Path(args.contract).resolve() if args.contract else default_contract_path(root_dir)
    contract = read_json(contract_path)
    as_of = args.as_of or datetime.now(timezone.utc).date().isoformat()
    started_at = datetime.now(timezone.utc).isoformat()

    if args.fixture:
        report = build_fixture_report(contract, as_of, started_at)
    else:
        report = build_real_report(contract, as_of, started_at)

    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    raw_path = root_dir / "raw_data" / "provider" / "qstock" / as_of / "a_share_structure_probe.json"
    report_path = root_dir / "model_outputs" / "provider_probes" / "qstock_a_share_structure_probe.json"
    write_json(raw_path, report)
    write_json(report_path, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Probe qstock A-share ETF and board coverage.")
    parser.add_argument("--root-dir", default=Path(__file__).resolve().parents[2], help="Project root directory.")
    parser.add_argument("--contract", default=None, help="Representative ETF provider contract JSON path.")
    parser.add_argument("--as-of", default=None, help="Probe date in YYYY-MM-DD format.")
    parser.add_argument("--fixture", action="store_true", help="Write deterministic fixture output without importing qstock.")
    return parser.parse_args()


def default_contract_path(root_dir: Path) -> Path:
    root_candidate = root_dir / "providers" / "akshare_etf_bridge" / "provider_contract.json"
    if root_candidate.exists():
        return root_candidate
    return Path(__file__).resolve().parents[1] / "akshare_etf_bridge" / "provider_contract.json"


def build_fixture_report(contract: dict[str, Any], as_of: str, started_at: str) -> dict[str, Any]:
    etf_rows = []
    for index, item in enumerate(contract["representative_etfs"], start=1):
        etf_rows.append(
            {
                "date": as_of,
                "provider": "qstock",
                "sector_id": item["sector_id"],
                "sector_node_id": item["sector_node_id"],
                "fund_code": item["fund_code"],
                "fund_name": f"qstock {item['fund_name_hint']}",
                "close": 0.88 + index * 0.039,
                "pct_change": ((index % 5) - 2) * 0.62,
                "amount": 150_000_000 + index * 40_000_000,
                "source_endpoint": "fixture"
            }
        )
    industry_rows = [
        {"name": "半导体", "pct_change": 1.2, "amount": 38_000_000_000},
        {"name": "通信设备", "pct_change": 0.8, "amount": 26_000_000_000},
        {"name": "证券", "pct_change": -0.4, "amount": 31_000_000_000}
    ]
    concept_rows = [
        {"name": "人工智能", "pct_change": 1.5, "amount": 45_000_000_000},
        {"name": "新能源车", "pct_change": -0.6, "amount": 20_000_000_000}
    ]
    return build_report("fixture", "ok", as_of, started_at, [], [], etf_rows, industry_rows, concept_rows)


def build_real_report(contract: dict[str, Any], as_of: str, started_at: str) -> dict[str, Any]:
    try:
        import qstock as qs  # type: ignore[import-not-found]
    except Exception as error:  # noqa: BLE001
        status = "missing_dependency" if "No module named" in str(error) else "dependency_error"
        return build_report("real", status, as_of, started_at, [f"qstock import failed: {error}"], [], [], [], [])

    warnings = []
    errors = []
    etf_rows = []
    industry_rows = []
    concept_rows = []
    try:
        etf_rows = map_representative_etfs(dataframe_records(qs.realtime_data("ETF")), contract, as_of)
    except Exception as error:  # noqa: BLE001
        warnings.append(f"qstock ETF realtime probe failed: {error}")
    try:
        industry_rows = dataframe_records(qs.realtime_data("行业板块"))[:30]
    except Exception as error:  # noqa: BLE001
        warnings.append(f"qstock industry board probe failed: {error}")
    try:
        concept_rows = dataframe_records(qs.realtime_data("概念板块"))[:30]
    except Exception as error:  # noqa: BLE001
        warnings.append(f"qstock concept board probe failed: {error}")

    status = "ok" if etf_rows or industry_rows or concept_rows else "error"
    if status == "error":
        errors.append("qstock probe returned no ETF, industry, or concept records.")
    return build_report("real", status, as_of, started_at, errors, warnings, etf_rows, industry_rows, concept_rows)


def build_report(
    mode: str,
    status: str,
    as_of: str,
    started_at: str,
    errors: list[str],
    warnings: list[str],
    etf_rows: list[dict[str, Any]],
    industry_rows: list[dict[str, Any]],
    concept_rows: list[dict[str, Any]]
) -> dict[str, Any]:
    return {
        "probe_id": PROBE_ID,
        "provider": "qstock",
        "mode": mode,
        "status": status,
        "as_of": as_of,
        "started_at": started_at,
        "errors": errors,
        "warnings": warnings,
        "records": {
            "representative_etfs": len(etf_rows),
            "industry_boards": len(industry_rows),
            "concept_boards": len(concept_rows)
        },
        "capabilities": {
            "representative_etf_quotes": bool(etf_rows),
            "industry_boards": bool(industry_rows),
            "concept_boards": bool(concept_rows)
        },
        "representative_etfs": etf_rows,
        "industry_boards_sample": industry_rows[:20],
        "concept_boards_sample": concept_rows[:20]
    }


def map_representative_etfs(records: list[dict[str, Any]], contract: dict[str, Any], as_of: str) -> list[dict[str, Any]]:
    by_code = {}
    for record in records:
        code = string_value(first_value(record, ["代码", "code", "股票代码"]))
        if code:
            by_code[code] = record
    rows = []
    for item in contract["representative_etfs"]:
        record = by_code.get(item["fund_code"])
        if not record:
            continue
        rows.append(
            {
                "date": as_of,
                "provider": "qstock",
                "sector_id": item["sector_id"],
                "sector_node_id": item["sector_node_id"],
                "fund_code": item["fund_code"],
                "fund_name": string_value(first_value(record, ["名称", "name", "股票名称"])) or item["fund_name_hint"],
                "close": numeric_value(first_value(record, ["最新价", "现价", "close"])),
                "pct_change": numeric_value(first_value(record, ["涨跌幅", "pct_change"])),
                "amount": numeric_value(first_value(record, ["成交额", "amount"])),
                "source_endpoint": "qstock.realtime_data(ETF)"
            }
        )
    return rows


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


if __name__ == "__main__":
    raise SystemExit(main())
