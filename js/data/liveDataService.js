/**
 * liveDataService.js
 * ---------------------------------------------------------------------
 * Fetches the REAL, full-NSE-universe data published by
 * tools/sync_market_data.py (via GitHub Actions + GitHub Pages — see
 * docs/LIVE_DATA_SETUP.md). This is the module that turns "demo data"
 * into genuine daily-synced market data once the user has deployed the
 * sync workflow.
 *
 * Every function here fails soft: if no live-data URL is configured yet,
 * or the fetch fails (offline, not deployed yet, sync hasn't run yet),
 * callers get `null` back and should fall back to sample data — exactly
 * the same honest-fallback pattern used by the chart and other TradingView
 * widgets elsewhere in this app.
 * ---------------------------------------------------------------------
 */

/** Shared "Live · <date>" / "Demo data" badge used across every view that shows synced data. */
function liveBadge(isLive, asOf) {
  return el("span", { class: `badge ${isLive ? "badge-long" : ""}`, style: "text-transform:none; letter-spacing:0;" },
    isLive ? `Live${asOf ? " · " + asOf : ""}` : "Demo data — see Settings to sync real data");
}

const LIVE_DATA_CACHE = {};
const LIVE_DATA_CACHE_MS = 5 * 60 * 1000; // 5 min — this data only changes once/day anyway

function getLiveDataBaseUrl() {
  const url = Store.get(KEYS.LIVE_DATA_URL, "");
  return url ? url.replace(/\/$/, "") : "";
}

function saveLiveDataBaseUrl(url) {
  Store.set(KEYS.LIVE_DATA_URL, (url || "").trim().replace(/\/$/, ""));
}

function isLiveDataConfigured() {
  return !!getLiveDataBaseUrl();
}

async function fetchLiveJson(filename) {
  const base = getLiveDataBaseUrl();
  if (!base) return null;

  const cached = LIVE_DATA_CACHE[filename];
  if (cached && Date.now() - cached.fetchedAt < LIVE_DATA_CACHE_MS) return cached.data;

  try {
    const res = await fetch(`${base}/data/live/${filename}?t=${Math.floor(Date.now() / 600000)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    LIVE_DATA_CACHE[filename] = { data, fetchedAt: Date.now() };
    return data;
  } catch (err) {
    console.warn(`liveDataService: could not fetch ${filename}`, err);
    return null;
  }
}

/** Full synced NSE universe (all EQ-series stocks) with sector + RS Rating attached. Or null if unavailable. */
async function getLiveFullUniverse() {
  return fetchLiveJson("full_universe.json");
}

/** Real full-market breadth (advances/declines/52w hi-lo across the whole synced universe). Or null. */
async function getLiveBreadth() {
  return fetchLiveJson("breadth.json");
}

/** Real sector performance, averaged from actual constituent price moves. Or null. */
async function getLiveSectorPerformance() {
  return fetchLiveJson("sector_performance.json");
}

/** Real top gainers/losers for the day. Or null. */
async function getLiveTopMovers() {
  return fetchLiveJson("top_movers.json");
}

/** Best performers over the trailing year across the synced universe. Or null. */
async function getLivePastWinners() {
  return fetchLiveJson("past_winners.json");
}

/** Bulk/block/short-selling deals reported to NSE. Or null. */
async function getLiveBulkBlockDeals() {
  return fetchLiveJson("bulk_block_deals.json");
}

/** Daily circuit/price-band revision list. Or null. */
async function getLiveCircuitList() {
  return fetchLiveJson("circuit_list.json");
}

/** Upcoming board meetings / results calendar. Or null. */
async function getLiveResultsCalendar() {
  return fetchLiveJson("results_calendar.json");
}

/** Rolling per-symbol price history (for RRG / performance-since-added calculations). Or null. */
async function getLivePriceHistory() {
  return fetchLiveJson("price_history.json");
}

/** Quick reachability check used by the Settings page's "Test connection" button. */
async function testLiveDataConnection() {
  const breadth = await fetchLiveJson("breadth.json");
  if (!breadth) return { ok: false, message: "Could not reach or parse breadth.json at that URL. Check the URL and that the sync workflow has run at least once." };
  return { ok: true, message: `Connected. Data as of ${breadth.asOf}.` };
}
