/**
 * universeScanner.js
 * ---------------------------------------------------------------------
 * Runs our own scanner definitions directly against the synced NSE
 * universe (price_history.json + full_universe.json, published by
 * tools/sync_market_data.py) — this is what replaces "manually run a
 * scanner on Chartink, export CSV, import it" with one click that scans
 * every single synced stock automatically.
 *
 * Each scanner below is a hand-written JS predicate that mirrors the
 * INTENT of the matching Chartink clause in js/data/scannerLibrary.js
 * (same underlying technical idea — trend, breakout, base quality, etc.)
 * — it's not a generic Chartink-syntax interpreter, just a direct
 * re-implementation of each of our 15 named setups, operating on
 * indicators derived client-side from the synced price history.
 *
 * Requires live data to be configured (Settings → Live Market Data
 * Sync) — with no universe synced yet, runUniverseScanners() returns a
 * clear "not configured" result rather than silently doing nothing.
 * ---------------------------------------------------------------------
 */

/* ---------------------------------------------------------------------- */
/* Indicator helpers — derive SMA/RSI/52w hi-lo from a symbol's price       */
/* history (bhavcopy alone only gives OHLCV, not indicators).               */
/* ---------------------------------------------------------------------- */

function sma(closes, period) {
  if (closes.length < period) return null;
  const window = closes.slice(-period);
  return window.reduce((a, b) => a + b, 0) / period;
}

function smaAt(closes, period, indexFromEnd) {
  // SMA as of `indexFromEnd` days ago (0 = latest) — used to detect "SMA is rising/falling".
  const end = closes.length - indexFromEnd;
  if (end < period) return null;
  const window = closes.slice(end - period, end);
  return window.reduce((a, b) => a + b, 0) / period;
}

function rsi14(closes) {
  const period = 14;
  if (closes.length < period + 1) return null;
  const changes = [];
  for (let i = closes.length - period; i < closes.length; i++) changes.push(closes[i] - closes[i - 1]);
  const gains = changes.filter((c) => c > 0);
  const losses = changes.filter((c) => c < 0).map((c) => -c);
  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function deriveIndicators(series) {
  // series: [{date, close, volume}, ...] oldest -> newest
  if (!series || series.length < 5) return null;
  const closes = series.map((d) => d.close);
  const volumes = series.map((d) => d.volume);
  const window52w = series.slice(-252);

  const avgVol20 = volumes.length >= 20 ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20 : volumes.reduce((a, b) => a + b, 0) / volumes.length;

  return {
    ltp: closes[closes.length - 1],
    prevClose: closes.length > 1 ? closes[closes.length - 2] : closes[closes.length - 1],
    volume: volumes[volumes.length - 1],
    avgVolume20: avgVol20,
    high52w: Math.max(...window52w.map((d) => d.close)),
    low52w: Math.min(...window52w.map((d) => d.close)),
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma50Prev: smaAt(closes, 50, 5), // 5 sessions ago, to detect direction
    sma150: sma(closes, 150),
    sma200: sma(closes, 200),
    rsi: rsi14(closes),
  };
}

/* ---------------------------------------------------------------------- */
/* Scanner predicates — mirror scannerLibrary.js intent, id-matched         */
/* ---------------------------------------------------------------------- */

const UNIVERSE_SCANNERS = {
  "trend-continuation": (ind) =>
    ind.sma50 && ind.sma200 && ind.ltp > ind.sma50 && ind.sma50 > ind.sma200 &&
    ind.ltp > ind.prevClose && ind.volume > ind.avgVolume20,

  "breakout": (ind) =>
    ind.high52w && ind.ltp >= 0.98 * ind.high52w && ind.volume > 1.5 * ind.avgVolume20 && ind.ltp > ind.prevClose,

  "pullback": (ind) =>
    ind.sma50 && ind.sma200 && ind.ltp > ind.sma200 &&
    ind.ltp <= 1.02 * ind.sma50 && ind.ltp >= 0.97 * ind.sma50 && ind.volume < ind.avgVolume20,

  "darvas-consolidation": (ind) =>
    ind.high52w && ind.ltp >= 0.95 * ind.high52w,

  "stage2-candidates": (ind) =>
    ind.sma50 && ind.sma150 && ind.sma200 && ind.ltp > ind.sma50 && ind.sma50 > ind.sma150 && ind.sma150 > ind.sma200 &&
    ind.low52w && ind.ltp >= 1.25 * ind.low52w,

  "momentum": (ind) =>
    ind.rsi && ind.rsi > 60 && ind.rsi < 80 && ind.volume > ind.avgVolume20,

  "high-rs": (ind) => ind.rsRating !== undefined && ind.rsRating !== null && ind.rsRating >= 80,

  "tight-consolidation": (ind) =>
    ind.sma50 && ind.volume < ind.avgVolume20 * 0.9,

  "ipo-base": (ind) =>
    ind.sma50 && ind.ltp > ind.sma50 && ind.low52w && ind.ltp < 1.15 * ind.low52w,

  "breakdown": (ind) =>
    ind.low52w && ind.ltp <= 1.02 * ind.low52w && ind.volume > 1.5 * ind.avgVolume20 && ind.ltp < ind.prevClose,

  "distribution-topping": (ind) =>
    ind.sma50 && ind.sma50Prev && ind.ltp < ind.sma50 && ind.sma50 < ind.sma50Prev &&
    ind.volume > 1.3 * ind.avgVolume20 && ind.ltp < ind.prevClose,

  "relative-weakness": (ind) => ind.rsRating !== undefined && ind.rsRating !== null && ind.rsRating <= 20,

  "downtrend-continuation": (ind) =>
    ind.sma50 && ind.sma150 && ind.sma200 && ind.ltp < ind.sma50 && ind.sma50 < ind.sma150 && ind.sma150 < ind.sma200 &&
    ind.high52w && ind.ltp <= 0.80 * ind.high52w,

  "bearish-rally-failure": (ind) =>
    ind.sma50 && ind.sma200 && ind.sma50Prev && ind.ltp < ind.sma200 && ind.sma50 < ind.sma50Prev &&
    ind.ltp >= 0.98 * ind.sma50 && ind.ltp <= 1.02 * ind.sma50 && ind.volume < ind.avgVolume20,
};

/* ---------------------------------------------------------------------- */
/* Orchestration                                                           */
/* ---------------------------------------------------------------------- */

/**
 * Runs every scanner in UNIVERSE_SCANNERS against the full synced universe
 * and merges matches into the candidate pool, exactly like a CSV import —
 * each match's scannerSource lists which scanner(s) it satisfied.
 */
async function runUniverseScanners(selectedScannerIds = null) {
  if (!isLiveDataConfigured()) {
    return { ok: false, reason: "not-configured", message: "Live data isn't configured yet. Set your GitHub Pages URL in Settings first." };
  }

  const [history, universe] = await Promise.all([getLivePriceHistory(), getLiveFullUniverse()]);
  if (!history || !universe) {
    return { ok: false, reason: "unreachable", message: "Could not load synced data. Check Settings → Test Connection, and that the sync workflow has run at least once." };
  }

  const universeBySymbol = new Map(universe.stocks.map((s) => [s.symbol, s]));
  const idsToRun = selectedScannerIds && selectedScannerIds.length ? selectedScannerIds : Object.keys(UNIVERSE_SCANNERS);

  const matchesByScanner = {};
  const rawRecordsBySymbol = new Map();

  for (const [symbol, series] of Object.entries(history)) {
    const ind = deriveIndicators(series);
    if (!ind) continue;
    const meta = universeBySymbol.get(symbol) || {};
    ind.rsRating = meta.rsRating;
    const sector = meta.sector;

    for (const scannerId of idsToRun) {
      const predicate = UNIVERSE_SCANNERS[scannerId];
      if (!predicate) continue;
      let passed = false;
      try { passed = !!predicate(ind); } catch (e) { passed = false; }
      if (!passed) continue;

      matchesByScanner[scannerId] = (matchesByScanner[scannerId] || 0) + 1;
      const scannerDef = getScannerById(scannerId);
      const label = scannerDef ? scannerDef.name : scannerId;

      const existing = rawRecordsBySymbol.get(symbol);
      const sources = existing ? new Set([...(existing.scannerSource || "").split(",").map((s) => s.trim()), label]) : new Set([label]);
      rawRecordsBySymbol.set(symbol, {
        symbol, ltp: ind.ltp, changePct: ind.prevClose ? +(((ind.ltp - ind.prevClose) / ind.prevClose) * 100).toFixed(2) : 0,
        volume: ind.volume, avgVolume20: Math.round(ind.avgVolume20), high52w: ind.high52w, low52w: ind.low52w,
        sma50: ind.sma50 ? +ind.sma50.toFixed(2) : undefined, sma200: ind.sma200 ? +ind.sma200.toFixed(2) : undefined,
        rsi: ind.rsi ? +ind.rsi.toFixed(1) : undefined, rsRating: ind.rsRating, sector,
        scannerSource: Array.from(sources).join(", "),
      });
    }
  }

  const records = Array.from(rawRecordsBySymbol.values());
  if (records.length) mergeCandidates(records, "Universe Scan");

  return {
    ok: true,
    totalMatched: records.length,
    byScanner: matchesByScanner,
    universeSize: Object.keys(history).length,
    asOf: universe.asOf,
  };
}

/** List of scanner ids this engine actually implements (a subset of the full library — some, like Failed Breakouts, are watchlist-only by design and intentionally excluded). */
function getRunnableScannerIds() {
  return Object.keys(UNIVERSE_SCANNERS);
}
