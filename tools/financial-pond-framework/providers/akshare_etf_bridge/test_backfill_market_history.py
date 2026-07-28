import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from backfill_market_history import history_csv_row, merge_history, valid_rows  # noqa: E402


class MarketHistoryBackfillTest(unittest.TestCase):
    def test_merge_is_idempotent_and_preserves_existing_correct_values(self):
        item = {
            "sector_id": "brokerage",
            "sector_node_id": "brokerage_etf_flow",
            "fund_code": "512000",
            "fund_name_hint": "Brokerage ETF",
        }
        incoming = history_csv_row(bar("2026-07-28"), item, "2026-07-28", "2026-07-28T00:00:00Z")
        existing = [{"date": "2026-07-28", "fund_code": "512000", "close": "1.234"}]
        once = merge_history(existing, [incoming])
        twice = merge_history(once, [incoming])
        self.assertEqual(once, twice)
        self.assertEqual(len(twice), 1)
        self.assertEqual(twice[0]["close"], "1.234")
        self.assertEqual(twice[0]["amount"], 100000.0)

    def test_future_and_polluted_rows_are_rejected(self):
        rows = [
            bar("2026-07-28"),
            bar("2026-07-29"),
            {**bar("2026-07-27"), "amount": None},
        ]
        accepted = valid_rows(rows, "2026-07-28")
        self.assertEqual([row["trade_date"] for row in accepted], ["2026-07-28"])


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
