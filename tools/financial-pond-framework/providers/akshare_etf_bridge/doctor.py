#!/usr/bin/env python3
"""Preflight checks for the AKShare ETF bridge.

The doctor command is intentionally read-only against provider exports. It
answers whether the current runtime can even attempt a real AKShare run.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DOCTOR_ID = "akshare_etf_bridge_doctor_v0_10_24"


def main() -> int:
    args = parse_args()
    root_dir = Path(args.root_dir).resolve()
    output_path = root_dir / "model_outputs" / "provider_runs" / "akshare_etf_bridge_doctor.json"
    started_at = datetime.now(timezone.utc).isoformat()
    checks: list[dict[str, Any]] = []

    checks.append({
        "id": "python_runtime",
        "status": "ok",
        "detail": sys.version.replace("\n", " ")
    })

    akshare_check = check_akshare_import()
    checks.append(akshare_check)

    if akshare_check["status"] == "ok" and args.probe_endpoint:
        checks.append(check_spot_endpoint(akshare_check["module"]))

    status = "ok" if all(item["status"] == "ok" for item in checks) else "blocked"
    payload = {
        "doctor_id": DOCTOR_ID,
        "provider": "akshare",
        "status": status,
        "started_at": started_at,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "checks": [{key: value for key, value in item.items() if key != "module"} for item in checks],
        "install_hint": "python3 -m pip install -r providers/requirements.txt",
        "run_hint": "npm run provider:akshare && npm run provider:akshare:validate && npm run provider:akshare:inspect"
    }
    write_json(output_path, payload)
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if status == "ok" else 2


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check whether AKShare bridge real mode can run.")
    parser.add_argument("--root-dir", default=Path(__file__).resolve().parents[2], help="Project root directory.")
    parser.add_argument("--probe-endpoint", action="store_true", help="Call fund_etf_spot_em after import succeeds.")
    return parser.parse_args()


def check_akshare_import() -> dict[str, Any]:
    module_path = os.environ.get("AKSHARE_BRIDGE_MODULE_PATH")
    if module_path:
      try:
          spec = importlib.util.spec_from_file_location("akshare", module_path)
          if spec is None or spec.loader is None:
              raise RuntimeError(f"Could not load AKShare test module from {module_path}")
          module = importlib.util.module_from_spec(spec)
          spec.loader.exec_module(module)
          return {
              "id": "akshare_import",
              "status": "ok",
              "detail": f"loaded from AKSHARE_BRIDGE_MODULE_PATH={module_path}",
              "version": getattr(module, "__version__", "unknown"),
              "module": module
          }
      except Exception as error:  # noqa: BLE001
          return {
              "id": "akshare_import",
              "status": "blocked",
              "detail": str(error),
              "remediation": "Check AKSHARE_BRIDGE_MODULE_PATH or unset it for normal package import."
          }

    try:
        import akshare as ak  # type: ignore[import-not-found]
        return {
            "id": "akshare_import",
            "status": "ok",
            "detail": "akshare package imported",
            "version": getattr(ak, "__version__", "unknown"),
            "module": ak
        }
    except Exception as error:  # noqa: BLE001
        return {
            "id": "akshare_import",
            "status": "blocked",
            "detail": str(error),
            "remediation": "Install with `python3 -m pip install -r providers/requirements.txt`."
        }


def check_spot_endpoint(ak: Any) -> dict[str, Any]:
    try:
        rows = ak.fund_etf_spot_em()
        shape = getattr(rows, "shape", None)
        return {
            "id": "fund_etf_spot_em",
            "status": "ok",
            "detail": f"endpoint returned shape={shape}"
        }
    except Exception as error:  # noqa: BLE001
        return {
            "id": "fund_etf_spot_em",
            "status": "blocked",
            "detail": str(error),
            "remediation": "Check network access and AKShare endpoint schema."
        }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
