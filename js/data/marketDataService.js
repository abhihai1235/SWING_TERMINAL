/**
 * marketDataService.js
 * ---------------------------------------------------------------------
 * Abstracted market-data provider. Every value the Dashboard shows comes
 * through this module so no market figures are hard-coded into the UI.
 *
 * TODAY: returns realistic static/randomized sample data (offline demo).
 * FUTURE: replace the body of each function with a real call to an
 * NSE/BSE data vendor, a broker API, or a local price-feed service —
 * the function *signatures* are the extension contract the rest of the
 * app is written against, so no other file needs to change.
 * ---------------------------------------------------------------------
 */

function jitter(base, spread) {
  return base + (Math.random() * 2 - 1) * spread;
}

/**
 * Computes an overall market-context bias ("supportive" / "unsupportive" /
 * "neutral" for longs) from the index snapshot, and caches it in Store for
 * the rest of the session. The scoring engine reads this synchronously via
 * Store.get(KEYS.MARKET_BIAS, ...) — call this once at app startup (and
 * again whenever the user wants a fresh read) rather than on every score
 * calculation, since getIndexSnapshot() is randomized sample data here and
 * would otherwise make scores flicker between renders.
 */
/**
 * Pure computation of market-context bias from an already-fetched index
 * snapshot + breadth reading (avoids re-fetching, which would jitter to a
 * different random sample and disagree with what the ribbon just showed).
 */
function computeMarketBias(snapshot, breadth) {
  const nifty = snapshot.find((s) => s.name === "NIFTY 50");
  const vix = snapshot.find((s) => s.isVix);
  let score = 0;
  if (nifty && nifty.changePct > 0.2) score += 1;
  if (nifty && nifty.changePct < -0.2) score -= 1;
  if (breadth.adRatio >= 1.2) score += 1;
  if (breadth.adRatio <= 0.8) score -= 1;
  if (vix && vix.value >= 18) score -= 1; // elevated fear works against fresh longs
  return score >= 1 ? "supportive" : score <= -1 ? "unsupportive" : "neutral";
}

/**
 * Fetches a fresh index snapshot + breadth reading, computes the bias, and
 * caches it in Store for the rest of the session. The scoring engine reads
 * this synchronously via Store.get(KEYS.MARKET_BIAS, ...) — call this once
 * at app startup (see app.js) rather than on every score calculation,
 * since getIndexSnapshot() is randomized sample data here and would
 * otherwise make scores flicker between renders.
 */
async function refreshMarketBias() {
  const [snapshot, breadth] = await Promise.all([getIndexSnapshot(), getMarketBreadth()]);
  const bias = computeMarketBias(snapshot, breadth);
  Store.set(KEYS.MARKET_BIAS, bias);
  return bias;
}

/** Same as refreshMarketBias() but reuses a snapshot the caller already fetched. */
async function refreshMarketBiasFromSnapshot(snapshot) {
  const breadth = await getMarketBreadth();
  const bias = computeMarketBias(snapshot, breadth);
  Store.set(KEYS.MARKET_BIAS, bias);
  return bias;
}

function getCachedMarketBias() {
  return Store.get(KEYS.MARKET_BIAS, "neutral");
}
async function getIndexSnapshot() {
  return [
    { name: "NIFTY 50", value: jitter(24812, 60), changePct: jitter(0.35, 0.6) },
    { name: "BANK NIFTY", value: jitter(52340, 150), changePct: jitter(0.2, 0.7) },
    { name: "NIFTY MIDCAP 100", value: jitter(57210, 200), changePct: jitter(0.5, 0.9) },
    { name: "NIFTY SMALLCAP 100", value: jitter(18430, 90), changePct: jitter(0.6, 1.1) },
    { name: "INDIA VIX", value: jitter(13.2, 0.8), changePct: jitter(-0.4, 1.2), isVix: true },
  ];
}

/** Market breadth (advance/decline) for the dashboard. Uses real synced
 *  NSE-wide data if a live data URL is configured (see Settings), else
 *  falls back to demo values. */
async function getMarketBreadth() {
  const live = await getLiveBreadth();
  if (live) {
    return {
      advances: live.advances, declines: live.declines, unchanged: live.unchanged,
      adRatio: live.adRatio, newHighs: live.newHighs, newLows: live.newLows,
      isLive: true, asOf: live.asOf,
    };
  }
  const advances = Math.round(jitter(1450, 250));
  const declines = Math.round(jitter(1150, 250));
  const unchanged = Math.round(jitter(90, 20));
  return { advances, declines, unchanged, adRatio: +(advances / Math.max(declines, 1)).toFixed(2), isLive: false };
}

/** Sector relative strength — powers the strongest/weakest sector panels.
 *  Real, synced sector performance if configured, else demo values. */
async function getSectorStrength() {
  const live = await getLiveSectorPerformance();
  if (live && live.sectors && live.sectors.length) {
    return live.sectors.map((s) => ({ ...s, isLive: true }));
  }
  const sectors = [
    "IT", "Banking", "Pharma", "Auto", "FMCG", "Metals",
    "Energy", "Realty", "Infra", "Capital Goods", "Chemicals", "PSU Bank",
  ];
  return sectors
    .map((name) => ({ name, relativeStrength: +jitter(0, 3.2).toFixed(2), isLive: false }))
    .sort((a, b) => b.relativeStrength - a.relativeStrength);
}

/**
 * Sample swing candidates — representative of what a Chartink scanner
 * CSV export looks like once normalized. Used to seed the app on first
 * run and for the "Load Sample Data" action in Scanner Import.
 */
async function getSampleCandidates() {
  return [
    { symbol: "TATAELXSI", companyName: "Tata Elxsi Ltd", sector: "IT", ltp: 7145, changePct: 2.1, volume: 412000, avgVolume20: 260000, high52w: 7460, low52w: 5890, sma50: 6810, sma200: 6320, rsi: 63, epsGrowth: 18, salesGrowth: 12, roe: 24, scannerSource: "Stage-2 Candidates" },
    { symbol: "KAYNES", companyName: "Kaynes Technology", sector: "Capital Goods", ltp: 5320, changePct: 3.4, volume: 890000, avgVolume20: 410000, high52w: 5480, low52w: 3200, sma50: 4850, sma200: 4100, rsi: 68, epsGrowth: 34, salesGrowth: 28, roe: 19, scannerSource: "Breakout" },
    { symbol: "COFORGE", companyName: "Coforge Ltd", sector: "IT", ltp: 8210, changePct: 1.6, volume: 320000, avgVolume20: 280000, high52w: 8450, low52w: 5600, sma50: 7690, sma200: 6900, rsi: 61, rsRating: 88, scannerSource: "High Relative Strength" },
    { symbol: "POLYCAB", companyName: "Polycab India", sector: "Capital Goods", ltp: 7260, changePct: -0.4, volume: 210000, avgVolume20: 260000, high52w: 7690, low52w: 4700, sma50: 6980, sma200: 6100, rsi: 54, scannerSource: "Pullback" },
    { symbol: "JSWENERGY", companyName: "JSW Energy Ltd", sector: "Energy", ltp: 612, changePct: 4.2, volume: 5200000, avgVolume20: 2100000, high52w: 645, low52w: 380, sma50: 560, sma200: 480, rsi: 71, scannerSource: "Momentum" },
    { symbol: "CDSL", companyName: "Central Depository Services", sector: "Financial Services", ltp: 2680, changePct: 1.1, volume: 980000, avgVolume20: 700000, high52w: 2810, low52w: 1550, sma50: 2510, sma200: 2100, rsi: 59, scannerSource: "Tight Consolidation" },
    { symbol: "MAZDOCK", companyName: "Mazagon Dock Shipbuilders", sector: "Defence", ltp: 4310, changePct: 2.8, volume: 610000, avgVolume20: 320000, high52w: 4450, low52w: 1900, sma50: 3900, sma200: 3100, rsi: 66, scannerSource: "Trend Continuation" },
    { symbol: "IREDA", companyName: "Indian Renewable Energy Dev. Agency", sector: "Financial Services", ltp: 218, changePct: 0.6, volume: 8900000, avgVolume20: 7200000, high52w: 310, low52w: 130, sma50: 205, sma200: 190, rsi: 52, scannerSource: "IPO Base" },
    { symbol: "PGEL", companyName: "PG Electroplast", sector: "Consumer Durables", ltp: 890, changePct: 5.1, volume: 1900000, avgVolume20: 780000, high52w: 920, low52w: 340, sma50: 760, sma200: 560, rsi: 74, scannerSource: "Darvas-style Consolidation" },
    // Bearish sample candidates — exercise the short-side scoring path.
    { symbol: "SUZLON", companyName: "Suzlon Energy", sector: "Energy", ltp: 62, changePct: -2.4, volume: 51000000, avgVolume20: 32000000, high52w: 86, low52w: 32, sma50: 71, sma200: 78, rsi: 34, epsGrowth: -12, salesGrowth: -5, scannerSource: "Downtrend Continuation" },
    { symbol: "PAYTM", companyName: "One97 Communications", sector: "Financial Services", ltp: 410, changePct: -1.8, volume: 6200000, avgVolume20: 3800000, high52w: 998, low52w: 318, sma50: 455, sma200: 610, rsi: 38, roe: -6, scannerSource: "Breakdown" },
    { symbol: "ZOMATO", companyName: "Eternal Ltd (Zomato)", sector: "Consumer Services", ltp: 168, changePct: -0.9, volume: 18500000, avgVolume20: 14000000, high52w: 304, low52w: 148, sma50: 188, sma200: 232, rsi: 41, rsRating: 22, scannerSource: "Relative Weakness" },
    { symbol: "IDEA", companyName: "Vodafone Idea", sector: "Telecom", ltp: 7.2, changePct: -3.1, volume: 210000000, avgVolume20: 145000000, high52w: 19.2, low52w: 6.5, sma50: 8.1, sma200: 11.4, rsi: 29, epsGrowth: -40, scannerSource: "Distribution / Topping" },
  ];
}
