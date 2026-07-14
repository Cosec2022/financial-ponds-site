import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from historical_market_provider import get_etf_daily_bar, sina_symbol

class Frame:
    def __init__(self, rows): self.rows=rows
    def to_dict(self, _): return self.rows
class Ak:
    def __init__(self): self.calls=[]
    def fund_etf_hist_em(self, **kwargs): self.calls.append(("em", kwargs)); raise RuntimeError("SSL")
    def fund_etf_hist_sina(self, **kwargs): self.calls.append(("sina", kwargs)); return Frame([{ "date":"2026-07-13", "open":1, "high":2, "low":1, "close":1.5, "volume":4 }])

class HistoricalMarketProviderTest(unittest.TestCase):
    def test_sina_prefix_and_fallback_schema(self):
        ak=Ak(); row=get_etf_daily_bar(symbol="510300",as_of="2026-07-13",akshare_module=ak)
        self.assertEqual(sina_symbol("510300"), "sh510300"); self.assertEqual(sina_symbol("159819"), "sz159819")
        self.assertEqual(row["status"], "ok"); self.assertEqual(row["trade_date"], "2026-07-13"); self.assertTrue(row["fallback_used"])
        self.assertEqual(ak.calls[-1][1]["symbol"], "sh510300")
    def test_rejects_future_bar(self):
        class Future(Ak):
            def fund_etf_hist_em(self, **kwargs): return Frame([{ "date":"2026-07-14", "close":1 }])
            def fund_etf_hist_sina(self, **kwargs): return Frame([{ "date":"2026-07-14", "close":1 }])
        self.assertEqual(get_etf_daily_bar(symbol="510300",as_of="2026-07-13",akshare_module=Future())["status"], "unavailable")
if __name__ == "__main__": unittest.main()
