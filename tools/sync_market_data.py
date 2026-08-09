#!/usr/bin/env python3
"""
sync_market_data.py
==============================================================================
Syncs the FULL NSE universe (~2,000 listed equities) daily and computes the
real, full-market analytics the app needs: market breadth, sector/industry
performance, RS Rating (percentile rank across the whole market — genuine
cross-sectional relative strength, not a single-stock proxy), top gainers,
past winners, 52-week highs/lows, circuit-band revisions, and bulk/block
deals — all sourced from NSE's own free, official end-of-day reports.

WHY THIS RUNS ON A SCHEDULE, NOT IN THE BROWSER
--------------------------------------------------------------------------
NSE's website blocks plain scripted requests (it expects a real browser
session with proper cookies), and it isn't reachable from this project's
offline, no-backend HTML/JS app at all — browsers can't make this kind of
authenticated cross-origin request, and nseindia.com sets no CORS headers
that would allow it. So this script is meant to run OUTSIDE the browser, on
a schedule, and the app reads whatever it published. See
.github/workflows/sync-market-data.yml for the free, zero-maintenance way to
run this daily (GitHub Actions + GitHub Pages).

WHY DAILY, NOT LIVE-TICK
--------------------------------------------------------------------------
This system is for SWING trading, which is decided on daily bars, not
ticks. NSE publishes its official Bhavcopy once per day, ~8 PM IST after
market close — that cadence is the right granularity for this tool, not a
compromise. (For what it's worth, ChartsMaze — the platform we're
benchmarking against — also only refreshes once daily after market close.)

DEPENDENCY
--------------------------------------------------------------------------
Uses the `nse` PyPI package (https://pypi.org/project/nse/), a
well-maintained, actively-updated wrapper that already handles NSE's
session/cookie requirements correctly — this script does not hand-roll
scraping logic. Install with: pip install nse pandas

NSE occasionally restructures its site/report formats. If a fetch in here
starts failing, check the `nse` package's changelog/issues first — it's
usually already been patched there before this script needs to change.
==============================================================================
"""

import json
import sys
import traceback
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
from nse import NSE

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "live"
HISTORY_FILE = OUT_DIR / "price_history.json"
SECTOR_MAP_FILE = OUT_DIR / "sector_map.json"
DOWNLOAD_DIR = ROOT / ".sync_tmp"

MAX_HISTORY_DAYS = 300  # ~14 months of trading days per symbol, enough for 52w + RS lookbacks

# NSE sectoral indices used to build the symbol -> sector map. Re-fetched
# only every SECTOR_MAP_REFRESH_DAYS since constituents rarely change.
SECTOR_INDICES = [
    "NIFTY IT", "NIFTY BANK", "NIFTY AUTO", "NIFTY PHARMA", "NIFTY FMCG",
    "NIFTY METAL", "NIFTY ENERGY", "NIFTY REALTY", "NIFTY INFRASTRUCTURE",
    "NIFTY MEDIA", "NIFTY PSU BANK", "NIFTY FINANCIAL SERVICES",
    "NIFTY HEALTHCARE INDEX", "NIFTY CONSUMER DURABLES", "NIFTY OIL & GAS",
    "NIFTY CHEMICALS",
]
SECTOR_MAP_REFRESH_DAYS = 30

# Indices used for the RRG (Relative Rotation Graph) — sector indices plotted
# relative to a broad-market benchmark. NOTE: "RRG" is a trademark of
# Julius de Kempenaer / RRG Research. We compute our OWN relative-strength
# ratio and momentum using the same published, widely-used conceptual
# approach (normalized relative ratio + its rate of change, plotted in four
# quadrants) — this is not a claim of pixel/formula parity with the
# trademarked product.
RRG_BENCHMARK_INDEX = "NIFTY 500"
RRG_LOOKBACK_DAYS = 90


def log(msg):
    print(f"[sync] {msg}", flush=True)


def most_recent_trading_day(nse: NSE, max_back=7):
    """NSE has no bhavcopy on weekends/holidays — walk back until one exists."""
    d = datetime.now()
    for _ in range(max_back):
        try:
            nse.equityBhavcopy(d, folder=DOWNLOAD_DIR)
            return d
        except Exception:
            d -= timedelta(days=1)
    raise RuntimeError("Could not find a recent trading day with a published bhavcopy.")


def load_json(path, default):
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            return default
    return default


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str))
    log(f"wrote {path.relative_to(ROOT)} ({len(json.dumps(data))} bytes)")


# ---------------------------------------------------------------------------
# Step 1: bhavcopy -> today's full-universe snapshot + rolling price history
# ---------------------------------------------------------------------------

def sync_bhavcopy(nse: NSE, trade_date):
    bhav_path = nse.equityBhavcopy(trade_date, folder=DOWNLOAD_DIR)
    df = pd.read_csv(bhav_path)
    df.columns = [c.strip() for c in df.columns]

    # UDiFF bhavcopy columns include: TckrSymb, ClsPric, OpnPric, HghPric,
    # LwPric, PrvsClsgPric, TtlTradgVol, TtlNbOfShrsTraded, SctySrs, etc.
    # Column names have shifted before (old vs UDiFF format) — normalize here
    # in one place so the rest of the script doesn't care.
    colmap = {
        "TckrSymb": "symbol", "SYMBOL": "symbol",
        "ClsPric": "close", "CLOSE": "close",
        "PrvsClsgPric": "prevClose", "PREV_CLOSE": "prevClose",
        "OpnPric": "open", "OPEN": "open",
        "HghPric": "high", "HIGH": "high",
        "LwPric": "low", "LOW": "low",
        "TtlTradgVol": "volume", "TOTTRDQTY": "volume",
        "SctySrs": "series", "SERIES": "series",
    }
    df = df.rename(columns={k: v for k, v in colmap.items() if k in df.columns})
    df = df[df.get("series", "EQ") == "EQ"] if "series" in df.columns else df

    needed = ["symbol", "close", "prevClose", "open", "high", "low", "volume"]
    missing = [c for c in needed if c not in df.columns]
    if missing:
        raise RuntimeError(f"Bhavcopy is missing expected columns {missing} — NSE may have changed the format again. Check the `nse` package changelog.")

    df = df[needed].dropna(subset=["symbol", "close"])
    df["changePct"] = ((df["close"] - df["prevClose"]) / df["prevClose"] * 100).round(2)

    snapshot = df.to_dict(orient="records")
    log(f"parsed {len(snapshot)} EQ-series symbols from bhavcopy for {trade_date:%Y-%m-%d}")
    return snapshot


def update_price_history(snapshot, trade_date):
    history = load_json(HISTORY_FILE, {})
    date_str = trade_date.strftime("%Y-%m-%d")
    for row in snapshot:
        sym = row["symbol"]
        series = history.setdefault(sym, [])
        if series and series[-1]["date"] == date_str:
            series[-1] = {"date": date_str, "close": row["close"], "volume": row["volume"]}
        else:
            series.append({"date": date_str, "close": row["close"], "volume": row["volume"]})
        if len(series) > MAX_HISTORY_DAYS:
            history[sym] = series[-MAX_HISTORY_DAYS:]
    save_json(HISTORY_FILE, history)
    return history


# ---------------------------------------------------------------------------
# Step 2: sector/industry mapping (refreshed periodically, not daily)
# ---------------------------------------------------------------------------

def refresh_sector_map(nse: NSE, force=False):
    cached = load_json(SECTOR_MAP_FILE, None)
    if cached and not force:
        age_days = (datetime.now() - datetime.fromisoformat(cached["_updated"])).days
        if age_days < SECTOR_MAP_REFRESH_DAYS:
            log(f"sector map is {age_days}d old, skipping refresh")
            return cached["map"]

    sector_map = {}
    for idx_name in SECTOR_INDICES:
        try:
            constituents = nse.listEquityStocksByIndex(idx_name)
            symbols = constituents.get("data", constituents) if isinstance(constituents, dict) else constituents
            for row in symbols:
                sym = row.get("symbol") or row.get("SYMBOL")
                if sym:
                    sector_map[sym] = idx_name.replace("NIFTY ", "").title()
        except Exception as e:
            log(f"WARNING: could not fetch constituents for {idx_name}: {e}")
    save_json(SECTOR_MAP_FILE, {"_updated": datetime.now().isoformat(), "map": sector_map})
    return sector_map


# ---------------------------------------------------------------------------
# Step 3: derived analytics — the real payload the app consumes
# ---------------------------------------------------------------------------

def compute_breadth(snapshot):
    advances = sum(1 for r in snapshot if r["changePct"] > 0)
    declines = sum(1 for r in snapshot if r["changePct"] < 0)
    unchanged = len(snapshot) - advances - declines
    return {
        "advances": advances, "declines": declines, "unchanged": unchanged,
        "adRatio": round(advances / max(declines, 1), 2),
        "total": len(snapshot),
    }


def compute_52w_hilo(history):
    highs, lows = 0, 0
    for sym, series in history.items():
        if len(series) < 20:
            continue
        closes = [d["close"] for d in series]
        latest = closes[-1]
        if latest >= max(closes):
            highs += 1
        if latest <= min(closes):
            lows += 1
    return {"newHighs": highs, "newLows": lows}


def compute_sector_performance(snapshot, sector_map):
    by_sector = {}
    for row in snapshot:
        sector = sector_map.get(row["symbol"])
        if not sector:
            continue
        by_sector.setdefault(sector, []).append(row["changePct"])
    return sorted(
        [{"name": s, "relativeStrength": round(sum(v) / len(v), 2), "count": len(v)} for s, v in by_sector.items()],
        key=lambda x: -x["relativeStrength"],
    )


def compute_rs_ratings(history, lookback_days=63):
    """Genuine cross-sectional RS Rating: percentile rank of trailing return
    across the WHOLE synced universe (IBD-style), not a single-stock proxy."""
    returns = {}
    for sym, series in history.items():
        if len(series) <= lookback_days:
            continue
        past = series[-lookback_days - 1]["close"]
        latest = series[-1]["close"]
        if past:
            returns[sym] = (latest - past) / past * 100

    if not returns:
        return {}
    ranked = sorted(returns.items(), key=lambda kv: kv[1])
    n = len(ranked)
    return {sym: round((i / max(n - 1, 1)) * 100, 1) for i, (sym, _) in enumerate(ranked)}


def compute_top_movers(snapshot, count=25):
    ranked = sorted(snapshot, key=lambda r: r["changePct"])
    return {"gainers": list(reversed(ranked[-count:])), "losers": ranked[:count]}


def compute_past_winners(history, lookback_days=252, count=25):
    """Best performers over the trailing ~1 year in the synced universe."""
    perf = []
    for sym, series in history.items():
        if len(series) < 20:
            continue
        window = series[-lookback_days:] if len(series) >= lookback_days else series
        first, last = window[0]["close"], window[-1]["close"]
        if first:
            perf.append({"symbol": sym, "returnPct": round((last - first) / first * 100, 1)})
    return sorted(perf, key=lambda x: -x["returnPct"])[:count]


# ---------------------------------------------------------------------------
# Step 3b: RRG (relative rotation) — sector indices vs a broad-market benchmark
# ---------------------------------------------------------------------------

def compute_rrg_series(sector_closes, benchmark_closes, tail_length=10, smoothing=10):
    """
    Computes a relative-rotation-style (RS-Ratio, RS-Momentum) tail for one
    sector against a benchmark, using the standard published approach:
    normalize the relative-strength ratio's rolling z-score (RS-Ratio) and
    the rate of change of that z-score (RS-Momentum), each centered on 100.
    This is our own implementation of the well-known underlying concept —
    "RRG" itself is a trademark of Julius de Kempenaer / RRG Research, and
    this does not claim to reproduce their exact proprietary formula.
    """
    n = min(len(sector_closes), len(benchmark_closes))
    if n < smoothing + tail_length + 2:
        return []
    sector_closes, benchmark_closes = sector_closes[-n:], benchmark_closes[-n:]
    relative = [100 * s / b for s, b in zip(sector_closes, benchmark_closes)]

    def rolling_mean(vals, w):
        return [sum(vals[max(0, i - w + 1):i + 1]) / len(vals[max(0, i - w + 1):i + 1]) for i in range(len(vals))]

    def rolling_std(vals, w):
        means = rolling_mean(vals, w)
        out = []
        for i in range(len(vals)):
            window = vals[max(0, i - w + 1):i + 1]
            m = means[i]
            var = sum((v - m) ** 2 for v in window) / len(window)
            out.append(var ** 0.5 or 1e-9)
        return out

    rel_mean = rolling_mean(relative, smoothing)
    rel_std = rolling_std(relative, smoothing)
    rs_ratio = [100 + (relative[i] - rel_mean[i]) / rel_std[i] for i in range(n)]

    momentum_raw = [0] + [rs_ratio[i] - rs_ratio[i - 1] for i in range(1, n)]
    mom_mean = rolling_mean(momentum_raw, smoothing)
    mom_std = rolling_std(momentum_raw, smoothing)
    rs_momentum = [100 + (momentum_raw[i] - mom_mean[i]) / mom_std[i] for i in range(n)]

    tail = [{"rsRatio": round(rs_ratio[i], 2), "rsMomentum": round(rs_momentum[i], 2)} for i in range(n - tail_length, n)]
    return tail


def sync_rrg_data(nse: NSE):
    to_date = datetime.now()
    from_date = to_date - timedelta(days=RRG_LOOKBACK_DAYS)
    try:
        benchmark = nse.fetch_historical_index_data(RRG_BENCHMARK_INDEX, from_date, to_date)
        benchmark_closes = [row["close"] for row in benchmark if "close" in row] or [row.get("CLOSE") for row in benchmark]
    except Exception as e:
        log(f"WARNING: could not fetch RRG benchmark ({RRG_BENCHMARK_INDEX}): {e}")
        return {}

    rrg = {}
    for idx_name in SECTOR_INDICES:
        try:
            series = nse.fetch_historical_index_data(idx_name, from_date, to_date)
            closes = [row["close"] for row in series if "close" in row] or [row.get("CLOSE") for row in series]
            tail = compute_rrg_series(closes, benchmark_closes)
            if tail:
                rrg[idx_name.replace("NIFTY ", "").title()] = tail
        except Exception as e:
            log(f"WARNING: RRG fetch failed for {idx_name}: {e}")
    return rrg


# ---------------------------------------------------------------------------
# Step 4: deals, circuit list, results calendar — separate free NSE reports
# ---------------------------------------------------------------------------

def sync_bulk_block_deals(nse: NSE, trade_date):
    out = {}
    for kind in ["bulk_deals", "block_deals", "short_selling"]:
        try:
            out[kind] = nse.bulkdeals(kind, trade_date - timedelta(days=1), trade_date)
        except Exception as e:
            log(f"WARNING: {kind} fetch failed: {e}")
            out[kind] = []
    return out


def sync_circuit_list(nse: NSE, trade_date):
    try:
        path = nse.priceband_report(trade_date, folder=DOWNLOAD_DIR)
        df = pd.read_csv(path)
        return df.to_dict(orient="records")
    except Exception as e:
        log(f"WARNING: circuit/price-band report fetch failed: {e}")
        return []


def sync_results_calendar(nse: NSE):
    try:
        meetings = nse.boardMeetings(from_date=datetime.now(), to_date=datetime.now() + timedelta(days=21))
        return meetings
    except Exception as e:
        log(f"WARNING: board meetings (results calendar) fetch failed: {e}")
        return []


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    DOWNLOAD_DIR.mkdir(exist_ok=True)
    nse = NSE(download_folder=DOWNLOAD_DIR)
    try:
        trade_date = most_recent_trading_day(nse)
        log(f"syncing for trading day {trade_date:%Y-%m-%d}")

        snapshot = sync_bhavcopy(nse, trade_date)
        history = update_price_history(snapshot, trade_date)
        sector_map = refresh_sector_map(nse)

        breadth = compute_breadth(snapshot)
        hilo = compute_52w_hilo(history)
        sector_perf = compute_sector_performance(snapshot, sector_map)
        rs_ratings = compute_rs_ratings(history)
        movers = compute_top_movers(snapshot)
        past_winners = compute_past_winners(history)
        deals = sync_bulk_block_deals(nse, trade_date)
        circuit_list = sync_circuit_list(nse, trade_date)
        results_cal = sync_results_calendar(nse)
        rrg = sync_rrg_data(nse)

        # Attach RS rating + sector onto the full snapshot so the in-app
        # scanner/candidates engine can use real cross-sectional data.
        for row in snapshot:
            row["rsRating"] = rs_ratings.get(row["symbol"])
            row["sector"] = sector_map.get(row["symbol"])

        save_json(OUT_DIR / "full_universe.json", {"asOf": trade_date.strftime("%Y-%m-%d"), "stocks": snapshot})
        save_json(OUT_DIR / "breadth.json", {"asOf": trade_date.strftime("%Y-%m-%d"), **breadth, **hilo})
        save_json(OUT_DIR / "sector_performance.json", {"asOf": trade_date.strftime("%Y-%m-%d"), "sectors": sector_perf})
        save_json(OUT_DIR / "top_movers.json", {"asOf": trade_date.strftime("%Y-%m-%d"), **movers})
        save_json(OUT_DIR / "past_winners.json", {"asOf": trade_date.strftime("%Y-%m-%d"), "winners": past_winners})
        save_json(OUT_DIR / "bulk_block_deals.json", {"asOf": trade_date.strftime("%Y-%m-%d"), **deals})
        save_json(OUT_DIR / "circuit_list.json", {"asOf": trade_date.strftime("%Y-%m-%d"), "stocks": circuit_list})
        save_json(OUT_DIR / "results_calendar.json", {"asOf": trade_date.strftime("%Y-%m-%d"), "meetings": results_cal})
        save_json(OUT_DIR / "rrg.json", {"asOf": trade_date.strftime("%Y-%m-%d"), "benchmark": RRG_BENCHMARK_INDEX, "sectors": rrg})

        log("sync complete.")
    finally:
        nse.exit()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
