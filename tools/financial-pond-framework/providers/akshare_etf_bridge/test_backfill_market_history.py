import sys
import unittest
from unittest.mock import patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

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
