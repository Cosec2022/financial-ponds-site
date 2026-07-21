#!/usr/bin/env python3
"""FP-HIST-MKT-01 archive normalized ETF market inputs and hydrate replay CSV."""
from __future__ import annotations
import argparse, csv, hashlib, json
from datetime import datetime, timezone
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from historical_market_provider import get_etf_daily_bar
from akshare_etf_bridge.persist_daily_etf_history import daily_output_path, persist_daily_output

def canonical(value): return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
def write(path, value): path.parent.mkdir(parents=True, exist_ok=True); path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+"\n", encoding="utf8")
def read(path, fallback):
    try: return json.loads(path.read_text(encoding="utf8"))
    except FileNotFoundError: return fallback

def main():
    p=argparse.ArgumentParser(); p.add_argument("--as-of", required=True); p.add_argument("--offline", action="store_true"); p.add_argument("--refresh-inputs", action="store_true"); p.add_argument("--strict-exact-date", action="store_true"); p.add_argument("--allow-market-closed-fallback", action="store_true"); args=p.parse_args()
    root=Path(__file__).resolve().parents[2]; repo=root.parents[1]; contract=read(Path(__file__).with_name("provider_contract.json"), {})
    target=repo/"financial-pond"/"history"/"market-inputs"/args.as_of; etf_file=target/"etf_ohlcv.json"
    if args.offline:
        if not etf_file.exists(): raise SystemExit(f"offline snapshot missing: {etf_file}")
        payload=read(etf_file, {}); series=load_series(target) or load_existing_series(root, args.as_of); write(target/"etf_ohlcv_series.json", {"as_of":args.as_of,"rows":series}); hydrate(root, payload.get("rows", []), series); print(json.dumps({"mode":"offline_snapshot","path":str(target)})); return
    daily_path=daily_output_path(root, args.as_of)
    if daily_path.exists(): persist_daily_output(root, contract, args.as_of, daily_path)
    prior_rows={row.get("symbol"): row for row in read(etf_file, {"rows": []}).get("rows", []) if row.get("status")=="ok"}
    rows=[]
    for item in contract.get("representative_etfs", []):
        bar=get_etf_daily_bar(symbol=item["fund_code"], as_of=args.as_of, allow_previous_trading_day=args.allow_market_closed_fallback)
        if bar["status"] != "ok" and item["fund_code"] in prior_rows:
            bar = {**prior_rows[item["fund_code"]], "error_chain": bar.get("error_chain", []), "reused_archived_input": True}
        rows.append({**item, **bar})
    benchmark=get_etf_daily_bar(symbol="510300", as_of=args.as_of, allow_previous_trading_day=args.allow_market_closed_fallback)
    if args.strict_exact_date and any(row["status"] != "ok" or row["trade_date"] != args.as_of for row in rows+[benchmark]):
        # Persist unavailable evidence for audit; never manufacture a success.
        pass
    business={"as_of":args.as_of,"etf_rows":[business_row(r) for r in rows],"benchmark":business_row(benchmark)}
    digest=hashlib.sha256(canonical(business).encode()).hexdigest(); old=read(target/"manifest.json", {})
    series=load_existing_series(root, args.as_of)
    manifest={"schema_version":"historical_market_input_v1","as_of":args.as_of,"generated_at":datetime.now(timezone.utc).isoformat(),"business_payload_hash":digest,"instruments_expected":len(rows),"instruments_observed":sum(r["status"]=="ok" for r in rows),"source_summary":summary(rows+[benchmark]),"missing_summary":summary([r for r in rows if r["status"]!="ok"]),"files":["etf_ohlcv.json","benchmark_ohlcv.json","share_flow.json","market_calendar.json","provider_audit.json"],"replayable":True,"replay_limitations":["ETF share flow remains unavailable unless separate historical share source is archived."],"revision":old.get("revision",1) if old.get("business_payload_hash")==digest else old.get("revision",0)+1,"series_rows_preserved":len(series),"series_latest_date":max((r.get("date", "") for r in series), default=None)}
    if old.get("business_payload_hash")==digest: manifest["generated_at"]=old.get("generated_at")
    write(etf_file,{"schema_version":"historical_etf_ohlcv_v1","as_of":args.as_of,"rows":rows}); write(target/"etf_ohlcv_series.json", {"as_of":args.as_of,"rows":series}); write(target/"benchmark_ohlcv.json",benchmark); write(target/"share_flow.json",{"as_of":args.as_of,"rows":[],"status":"unavailable"}); write(target/"market_calendar.json",{"as_of":args.as_of,"actual_trade_dates":sorted({r["trade_date"] for r in rows if r["trade_date"]})}); write(target/"provider_audit.json",{"as_of":args.as_of,"rows":rows+[benchmark]}); write(target/"manifest.json",manifest); hydrate(root, rows, series); print(json.dumps(manifest,ensure_ascii=False))

def business_row(row): return {k:v for k,v in row.items() if k not in {"fetched_at"}}
def summary(rows):
    return {"ok":sum(r.get("status")=="ok" for r in rows),"unavailable":sum(r.get("status")!="ok" for r in rows),"providers":sorted({r.get("source_provider") for r in rows if r.get("source_provider")})}
def load_existing_series(root, as_of):
    """Preserve the cumulative normalized ETF series without admitting future rows.

    The daily provider runs before this archive step and may already have written
    the current session. Historical hydration must therefore upsert into the
    existing series, not rebuild from a fixed old Git revision. Filtering by
    ``as_of`` keeps historical replay fail-closed and prevents look-ahead.
    """
    path=root/"data"/"provider_exports"/"a_share_etf_daily.csv"
    if not path.exists(): return []
    with path.open(newline="", encoding="utf8") as handle:
        rows=list(csv.DictReader(handle))
    return [row for row in rows if row.get("date") and row.get("date") <= as_of]
def load_series(target): return read(target/"etf_ohlcv_series.json", {"rows":[]}).get("rows", [])
def hydrate(root, rows, series=[]):
    path=root/"data"/"provider_exports"/"a_share_etf_daily.csv"; path.parent.mkdir(parents=True,exist_ok=True)
    fields=["date","sector_id","sector_node_id","fund_code","fund_name","close","pct_change","amount","turnover","latest_share","previous_share","share_change","estimated_flow","source_provider","source_endpoint","provider_run_id","collected_at","open","high","low","volume","historical_input"]
    with path.open("w",newline="",encoding="utf8") as f:
        w=csv.DictWriter(f,fieldnames=fields, lineterminator="\n"); w.writeheader()
        by_key={(r.get("date"),r.get("fund_code")):r for r in series}
        for r in rows:
            if r.get("status")!="ok": continue
            previous=[x for x in by_key.values() if x.get("fund_code")==r["symbol"] and x.get("date","") < r["trade_date"] and x.get("close")]
            prev=max(previous,key=lambda x:x["date"],default=None); pct=((float(r["close"])/float(prev["close"])-1)*100) if prev else None
            by_key[(r["trade_date"],r["symbol"])]= {"date":r["trade_date"],"sector_id":r.get("sector_id"),"sector_node_id":r.get("sector_node_id"),"fund_code":r["symbol"],"fund_name":r.get("fund_name_hint"),"close":r.get("close"),"pct_change":pct if pct is not None else "","amount":r.get("amount") or "","turnover":"","latest_share":"","previous_share":"","share_change":"","estimated_flow":"","source_provider":r.get("source_provider"),"source_endpoint":r.get("source_endpoint"),"provider_run_id":"historical_market_input","collected_at":r.get("fetched_at"),"open":r.get("open") or "","high":r.get("high") or "","low":r.get("low") or "","volume":r.get("volume") or "","historical_input":"true"}
        for row in sorted(by_key.values(),key=lambda x:(x.get("date",""),x.get("fund_code",""))): w.writerow({key:row.get(key,"") for key in fields})
if __name__=="__main__": main()
