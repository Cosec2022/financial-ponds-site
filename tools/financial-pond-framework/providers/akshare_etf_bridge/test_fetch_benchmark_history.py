import importlib.util
import json
import ssl
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("fetch_benchmark_history.py")
SPEC = importlib.util.spec_from_file_location("benchmark_history", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SequenceAdapter:
    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = []

    def fetch_exact_close(self, symbol, requested_date, timeout_seconds):
        self.calls.append((symbol, requested_date, timeout_seconds))
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def row(date, close=4.0):
    return {"date": date, "symbol": "510300", "close": close, "source_provider": "fixture", "source_endpoint": "fixture"}


class BenchmarkHistoryTests(unittest.TestCase):
    def collect(self, adapter, dates, attempts=3):
        return MODULE.collect_dates(adapter, "510300", dates, timeout_seconds=2, max_attempts=attempts, sleeper=lambda _: None, jitter=lambda _a, _b: 0)

    def test_first_failure_second_success(self):
        adapter = SequenceAdapter([TimeoutError("timeout"), row("2026-07-09")])
        rows, diagnostics = self.collect(adapter, ["2026-07-09"])
        self.assertEqual(len(rows), 1)
        self.assertEqual(diagnostics[0]["attempt_count"], 2)
        self.assertEqual(adapter.calls[0][2], 2)

    def test_three_failures_are_bounded_for_timeout_and_ssl(self):
        adapter = SequenceAdapter([TimeoutError("timeout"), ssl.SSLError("ssl"), RuntimeError("down")])
        rows, diagnostics = self.collect(adapter, ["2026-07-09"])
        self.assertEqual(rows, [])
        self.assertEqual(diagnostics[0]["attempt_count"], 3)
        self.assertIn("RuntimeError", diagnostics[0]["provider_error"])

    def test_partial_dates_only_persist_valid_exact_rows(self):
        adapter = SequenceAdapter([row("2026-07-09"), TimeoutError("x"), TimeoutError("x"), TimeoutError("x")])
        rows, diagnostics = self.collect(adapter, ["2026-07-09", "2026-07-10"])
        self.assertEqual([item["date"] for item in rows], ["2026-07-09"])
        self.assertEqual(diagnostics[1]["status"], "error")

    def test_non_exact_temporary_result_is_rejected(self):
        adapter = SequenceAdapter([row("2026-07-08"), row("2026-07-08"), row("2026-07-08")])
        rows, diagnostics = self.collect(adapter, ["2026-07-09"])
        self.assertEqual(rows, [])
        self.assertIn("non-exact", diagnostics[0]["provider_error"])

    def test_failed_run_does_not_overwrite_last_known_good(self):
        existing = MODULE.merge_store({"rows": []}, [row("2026-07-09")], {"symbol": "510300"}, "t1")
        unchanged = json.dumps(existing, sort_keys=True)
        rows, _ = self.collect(SequenceAdapter([TimeoutError(), TimeoutError(), TimeoutError()]), ["2026-07-10"])
        self.assertEqual(rows, [])
        self.assertEqual(json.dumps(existing, sort_keys=True), unchanged)
        self.assertEqual(existing["last_success_timestamp"], "t1")

    def test_merge_is_idempotent_and_does_not_duplicate_archive_rows(self):
        first = MODULE.merge_store({"rows": []}, [row("2026-07-09")], {"symbol": "510300"}, "t1")
        second = MODULE.merge_store(first, [row("2026-07-09")], {"symbol": "510300"}, "t2")
        self.assertEqual(len(second["rows"]), 1)
        self.assertEqual(second["rows"][0]["collected_at"], "t2")


if __name__ == "__main__":
    unittest.main()
