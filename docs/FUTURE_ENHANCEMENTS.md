# Future Enhancement Guide

## Already built: free live TradingView widgets

The ribbon ticker, Dashboard's "Live Market Technical Rating," and Trade
Workspace's "Live Technical Rating" gauge are genuinely live — they're
TradingView's free public embed widgets (`js/modules/chartProvider.js:
renderTickerTape / renderTechnicalAnalysisGauge / renderSingleQuote`), which
require no API key and no backend.

## Already built: full-NSE-universe daily data sync

Market Breadth, Sector Analytics, RS Rating, Top Gainers, Past Winners,
RRG, Bulk & Block Deals, Circuit List, Results Calendar, and the Universe
Scanner are all real, computed daily from NSE's own free Bhavcopy and
reports via `tools/sync_market_data.py` + `.github/workflows/
sync-market-data.yml` (GitHub Actions, free tier) — see
`docs/LIVE_DATA_SETUP.md` for the one-time deployment. This required
stepping outside the pure client-side app (NSE isn't reachable from a
browser), which is why it needed a real decision from the user about
hosting rather than just being more code — see `docs/ARCHITECTURE.md` for
how the pipeline is structured.

Every extension point below maps to exactly one file (or a small, contained
set of files) — that's by design, so a future contributor doesn't need to
understand the whole app to add one capability.

## 1. True intraday/live-tick data

The remaining gap: everything above refreshes once per trading day
(matching how swing trading actually operates, and how ChartsMaze itself
operates). Genuine intraday ticks need a paid data vendor (TrueData, Global
Datafeeds) or a broker API (Zerodha Kite Connect, Upstox, Angel One — which
need a trading account + API subscription) and are a materially bigger,
different project — likely warranting its own backend rather than a
GitHub Actions cron job. Only worth doing if/when intraday or scalping
setups become part of the goal; for swing trading, the daily sync is the
right granularity, not a stopgap.

## 2. Broker integration (order placement)

Add a new `js/modules/brokerService.js` exposing functions like
`placeOrder(candidate, plan)`, `getPositions()`, `getHoldings()`. Wire a
"Send Order" button into `tradeWorkspaceView.js` next to Accept/Reject. Keep
order placement behind an explicit confirm step — this app is decision
support, not an auto-trading bot, and that boundary should stay visible in
the UI (e.g. "Review order" modal before submission).

## 3. Telegram / email alerts

Add `js/modules/notificationService.js` with a `notify(event, payload)`
function. Call it from:
- `candidates.js: mergeCandidates` when a new symbol crosses a score threshold,
- `journal.js` when a position's stop-loss or target is reached (once live
  prices are wired in).

Keep credentials (bot tokens, SMTP config) out of client-side code — proxy
through a small server endpoint if this ships to real users.

## 4. AI-assisted notes

The Trade Thesis and Personal Notes fields in `tradeWorkspaceView.js` are
plain `<textarea>`s. A "Suggest thesis" button could call an LLM API with
the candidate's normalized fields as context and insert a draft the trader
edits — keep it clearly labeled as a draft, never auto-submitted.

## 5. Additional scanners / custom scoring formulas

- New scanners: add an entry to `js/data/scannerLibrary.js` (id, name,
  category, description, Chartink clause). It appears in the Scanner Library
  view automatically. To also make it runnable by the Universe Scanner (not
  just the manual Chartink-CSV path), add a matching predicate keyed by the
  same `id` to `UNIVERSE_SCANNERS` in `js/modules/universeScanner.js`.
- New scoring categories: add a `scoreXxx(candidate)` function in
  `js/modules/scoring.js`, add it to the `sub` object in `scoreCandidate`,
  add a default weight in `DEFAULT_WEIGHTS`, and add a label in
  `settingsView.js: WEIGHT_LABELS`. The Settings slider UI picks it up with
  no further changes.

## 6. Converting to a live Android app

This app was built with that migration in mind:

- **Wrap it now, evolve later.** The fastest path is wrapping this exact
  codebase in a WebView shell (e.g. Capacitor or a plain Android WebView
  Activity) — since there's no build step and no framework lock-in, the
  HTML/CSS/JS ships as-is into `assets/` of the Android project.
- **Storage.** Replace `js/modules/storage.js`'s internals with a bridge to
  SQLite (via a JS-to-native bridge) or `IndexedDB` if staying in a WebView —
  the `Store.get/set/remove/exportAll/importAll` contract used by every other
  module doesn't need to change.
- **Live prices.** Implement `marketDataService.js` against a native module
  that streams NSE/BSE ticks (broadcast into the WebView via a JS bridge, or
  polled through a REST endpoint if using a licensed data vendor).
- **Push notifications.** Android's native notification APIs replace/augment
  the Telegram/email notification service above for on-device alerts.
- **Offline-first stays true.** Because scoring, checklist, risk math, and
  journal/analytics never depended on network access, the Android app keeps
  working on a plane exactly like the browser version does — only the chart
  and live price feed need connectivity.

## 7. Testing

Add unit tests for the pure modules first — `scoring.js`, `riskManager.js`,
`checklist.js`, and `analytics.js` are all side-effect-free and straightforward to test with any
test runner (Vitest, Jest, or Node's built-in `node:test`) without a DOM.
