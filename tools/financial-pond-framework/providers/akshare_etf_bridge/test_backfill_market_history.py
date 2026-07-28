import argparse
import csv
import json
import sys
import tempfile
import unittest
from datetime import date, timedelta
from unittest.mock import patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import backfill_market_history as backfill  # noqa: E402
from backfill_market_history import default_end_date, history_csv_row, merge_history, valid_rows  # noqa: E402


class MarketHistoryBackfillTest(unittest.TestCase):
    def test_merge_is_idempotent_and_history_bar_atomically_replaces_partial_spot(self):
        item = {
            "sector_id": "brokerage",
            "sector_node_id": "brokerage_etf_flow",
            "fund_code": "512000",
            "fund_name_hint": "Brokerage ETF",
        }
        incoming = history_csv_row(bar("2026-07-28"), item, "2026-07-28", "2026-07-28T00:00:00Z")
        existing = [{
            "date": "2026-07-28",
            "trade_date": "2026-07-28",
            "fund_code": "512000",
            "open": "",
            "high": "",
            "low": "",
            "close": "1.234",
            "volume": "",
            "amount": "88888",
            "latest_share": "2000",
            "provider_run_id": "spot_run",
        }]
        once = merge_history(existing, [incoming])
        twice = merge_history(once, [incoming])
        self.assertEqual(once, twice)
        self.assertEqual(len(twice), 1)
        self.assertEqual(twice[0]["open"], 1.0)
        self.assertEqual(twice[0]["high"], 1.1)
        self.assertEqual(twice[0]["low"], 0.9)
        self.assertEqual(twice[0]["close"], 1.05)
        self.assertEqual(twice[0]["volume"], 1000.0)
        self.assertEqual(twice[0]["amount"], 100000.0)
        self.assertEqual(twice[0]["latest_share"], "2000")
        self.assertEqual(twice[0]["provider_run_id"], "spot_run")

    def test_future_and_polluted_rows_are_rejected(self):
        rows = [
            bar("2026-07-28"),
            bar("2026-07-29"),
            {**bar("2026-07-27"), "amount": None},
        ]
        accepted = valid_rows(rows, "2026-07-28")
        self.assertEqual([row["trade_date"] for row in accepted], ["2026-07-28"])

    def test_merge_rejects_invalid_bar_and_excludes_future_existing_rows(self):
        invalid = {**bar("2026-07-28"), "close": 1.2}
        with self.assertRaises(ValueError):
            merge_history([], [{**invalid, "fund_code": "512000"}], "2026-07-28")
        merged = merge_history(
            [{**bar("2026-07-29"), "date": "2026-07-29", "fund_code": "512000"}],
            [],
            "2026-07-28",
        )
        self.assertEqual(merged, [])

    def test_default_end_date_uses_daily_as_of_instead_of_a_fixed_release_date(self):
        with patch.dict("os.environ", {"AS_OF": "2026-08-03"}):
            self.assertEqual(default_end_date(), "2026-08-03")


class MarketHistoryResilienceTest(unittest.TestCase):
    def test_complete_local_window_skips_all_providers_and_preserves_history_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = history_fixture(Path(directory), "2026-07-28")
            csv_before = fixture["csv"].read_bytes()
            benchmark_before = fixture["benchmark"].read_bytes()
            with patch.object(backfill, "load_akshare_module") as akshare, \
                    patch.object(backfill.subprocess, "run") as curl:
                result = backfill.run(run_args(fixture, "2026-07-28", "live"))
            report = read_report(fixture, "2026-07-28")
            self.assertEqual(result, 0)
            self.assertEqual(report["status"], "already_complete")
            self.assertEqual(report["provider_calls"], {"akshare": 0, "curl": 0})
            self.assertEqual(report["coverage"]["etf_complete"], 11)
            self.assertEqual(report["latest_complete_date"], "2026-07-28")
            self.assertEqual(fixture["csv"].read_bytes(), csv_before)
            self.assertEqual(fixture["benchmark"].read_bytes(), benchmark_before)
            akshare.assert_not_called()
            curl.assert_not_called()

    def test_live_provider_failure_degrades_to_last_complete_batch(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = history_fixture(Path(directory), "2026-07-27", partial_cutoff="2026-07-28")
            old_complete = complete_rows(fixture["csv"], before="2026-07-28")
            with provider_unavailable():
                result = backfill.run(run_args(fixture, "2026-07-28", "live"))
            report = read_report(fixture, "2026-07-28")
            self.assertEqual(result, 0)
            self.assertEqual(report["status"], "degraded")
            self.assertEqual(report["reason"], "provider_unavailable")
            self.assertTrue(report["fallback_used"])
            self.assertEqual(report["provider_calls"], {"akshare": 1, "curl": 1})
            self.assertEqual(report["latest_complete_date"], "2026-07-27")
            self.assertEqual(report["stale_by_sessions"], 1)
            self.assertEqual(report["hard_failures"], [])
            self.assertEqual(report["cleaned_cutoff_rows"], 11)
            self.assertEqual(complete_rows(fixture["csv"]), old_complete)

    def test_partial_cutoff_rows_are_removed_without_mutating_complete_history(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = history_fixture(Path(directory), "2026-07-27", partial_cutoff="2026-07-28")
            before = complete_rows(fixture["csv"], before="2026-07-28")
            with provider_unavailable():
                self.assertEqual(backfill.run(run_args(fixture, "2026-07-28", "live")), 0)
            after = csv_rows(fixture["csv"])
            self.assertEqual(after, before)
            quality = backfill.assess_local_history(
                after,
                json.loads(fixture["benchmark"].read_text()),
                json.loads(fixture["contract"].read_text()),
                "2026-07-28",
                60,
            )
            self.assertNotIn("field_pollution", quality["hard_failures"])

    def test_live_mode_fails_when_clean_history_is_insufficient(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = history_fixture(Path(directory), "2026-07-27", days=59, partial_cutoff="2026-07-28")
            with provider_unavailable():
                result = backfill.run(run_args(fixture, "2026-07-28", "live"))
            self.assertEqual(result, 2)
            self.assertEqual(read_report(fixture, "2026-07-28")["status"], "unavailable")

    def test_strict_mode_fails_without_stale_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = history_fixture(Path(directory), "2026-07-27", partial_cutoff="2026-07-28")
            csv_before = fixture["csv"].read_bytes()
            with provider_unavailable():
                result = backfill.run(run_args(fixture, "2026-07-28", "strict"))
            report = read_report(fixture, "2026-07-28")
            self.assertEqual(result, 2)
            self.assertEqual(report["status"], "unavailable")
            self.assertFalse(report["fallback_used"])
            self.assertEqual(fixture["csv"].read_bytes(), csv_before)

    def test_live_fallback_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = history_fixture(Path(directory), "2026-07-27", partial_cutoff="2026-07-28")
            with provider_unavailable():
                self.assertEqual(backfill.run(run_args(fixture, "2026-07-28", "live")), 0)
            csv_once = fixture["csv"].read_bytes()
            benchmark_once = fixture["benchmark"].read_bytes()
            with provider_unavailable():
                self.assertEqual(backfill.run(run_args(fixture, "2026-07-28", "live")), 0)
            self.assertEqual(fixture["csv"].read_bytes(), csv_once)
            self.assertEqual(fixture["benchmark"].read_bytes(), benchmark_once)


class provider_unavailable:
    def __enter__(self):
        self.akshare = patch.object(
            backfill,
            "load_akshare_module",
            side_effect=ConnectionError("RemoteDisconnected"),
        )
        self.curl = patch.object(
            backfill.subprocess,
            "run",
            return_value=argparse.Namespace(
                returncode=52,
                stderr="curl: (52) Empty reply from server",
                stdout="",
            ),
        )
        self.akshare.start()
        self.curl.start()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.curl.stop()
        self.akshare.stop()


def history_fixture(root, end_date, days=60, partial_cutoff=None):
    contract = {
        "benchmark": {"symbol": "510300"},
        "representative_etfs": [
            {
                "sector_id": f"sector_{index}",
                "sector_node_id": f"sector_{index}_etf_flow",
                "fund_code": f"{510000 + index}",
                "fund_name_hint": f"ETF {index}",
            }
            for index in range(11)
        ],
    }
    dates = business_dates(end_date, days)
    export_dir = root / "data" / "provider_exports"
    export_dir.mkdir(parents=True)
    csv_path = export_dir / "a_share_etf_daily.csv"
    rows = []
    for trade_date in dates:
        for item in contract["representative_etfs"]:
            rows.append({
                **bar(trade_date),
                "date": trade_date,
                "fund_code": item["fund_code"],
                "sector_id": item["sector_id"],
                "sector_node_id": item["sector_node_id"],
                "fund_name": item["fund_name_hint"],
            })
    if partial_cutoff:
        for item in contract["representative_etfs"]:
            rows.append({
                "date": partial_cutoff,
                "trade_date": partial_cutoff,
                "fund_code": item["fund_code"],
                "sector_id": item["sector_id"],
                "sector_node_id": item["sector_node_id"],
                "close": 1.05,
                "amount": 100000.0,
                "source_provider": "akshare",
            })
    fields = list(dict.fromkeys(backfill.CSV_FIELDS + [key for row in rows for key in row]))
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    benchmark_path = export_dir / "a_share_benchmark_daily.json"
    benchmark_path.write_text(json.dumps({
        "module_id": "fixture",
        "last_success_timestamp": "preserve-me",
        "rows": [{"date": trade_date, "trade_date": trade_date, "symbol": "510300", **bar(trade_date)}
                 for trade_date in dates],
    }, indent=2) + "\n")
    contract_path = root / "provider_contract.json"
    contract_path.write_text(json.dumps(contract, indent=2) + "\n")
    return {"root": root, "csv": csv_path, "benchmark": benchmark_path, "contract": contract_path}


def run_args(fixture, cutoff, mode):
    return argparse.Namespace(
        root_dir=str(fixture["root"]),
        contract=str(fixture["contract"]),
        end_date=cutoff,
        target_trade_days=60,
        calendar_days=150,
        retrieved_at="2026-07-28T10:00:00Z",
        mode=mode,
    )


def read_report(fixture, cutoff):
    path = fixture["root"] / "model_outputs" / "provider_runs" / f"market_history_backfill_{cutoff}.json"
    return json.loads(path.read_text())


def csv_rows(path):
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def complete_rows(path, before=None):
    return [
        row for row in csv_rows(path)
        if (before is None or row["trade_date"] < before) and backfill.complete_valid_bar(row)
    ]


def business_dates(end_date, count):
    current = date.fromisoformat(end_date)
    dates = []
    while len(dates) < count:
        if current.weekday() < 5:
            dates.append(current.isoformat())
        current -= timedelta(days=1)
    return sorted(dates)


def bar(date):
    return {
        "trade_date": date,
        "open": 1.0,
        "high": 1.1,
        "low": 0.9,
        "close": 1.05,
        "volume": 1000.0,
        "amount": 100000.0,
        "pct_change": 0.5,
        "turnover": 1.0,
    }


if __name__ == "__main__":
    unittest.main()
