# Swing Terminal

An offline, institutional-styled swing trading **decision support system** for
Indian equities (NSE/BSE). It helps you run scanners, import and rank
candidates, review each one on a chart with a structured trade plan, apply an
objective checklist, size the position by risk, and journal the outcome.

**This tool does not predict prices or guarantee profitable trades.** Every
score and checklist is an objective summary of technical conditions you
supply or import — the trading decision is always yours.

## Live data — what's real vs. demo

- **Genuinely live, free, no signup, works immediately:** the scrolling
  index ticker at the top of every screen and the "Live Technical Rating"
  gauges (Dashboard + Trade Workspace) are real TradingView widgets.
- **Real, full-NSE-market data — free, but needs a one-time setup:**
  Market Breadth, Sector Analytics, Top Gainers, Past Winners, RRG, Bulk &
  Block Deals, Circuit List, Results Calendar, and the **Universe
  Scanner** (runs all our scanner definitions against the entire synced
  market automatically — no manual Chartink export needed) are all driven
  by NSE's own free daily Bhavcopy and reports, synced once a day via a
  free GitHub Actions job. **See [`docs/LIVE_DATA_SETUP.md`](docs/LIVE_DATA_SETUP.md)
  — this is the single most valuable thing to set up.** Until you do, these
  sections show clearly-labeled realistic demo data instead of pretending
  to be live.
- **Your manually-imported scanner CSVs** are exactly what was in the file
  when you exported it from Chartink — the Universe Scanner is the
  automatic alternative once live data is configured.

## Quick start

There are two ways to run this — use whichever fits how you'll open it:

- **On a phone, or if you just want to double-tap and go:** open
  **`index.standalone.html`**. Everything (CSS + JS) is inlined into this one
  file, so there are no other files to reference — it works no matter how
  your browser opens it, including when a mobile file manager hands the page
  to Chrome via a `content://` link instead of a real file path (which breaks
  relative links to separate `css/`/`js/` files).
- **On desktop, or if you plan to edit the source:** open `index.html`, which
  loads the separate `css/` and `js/` files — this is the actual source of
  truth for development (see `docs/ARCHITECTURE.md`). If you edit any source
  file, re-run the build step described in that doc to regenerate
  `index.standalone.html`.

Either way: unzip the project first. No installs, no build tooling needed to
just *use* the app — everything (scoring, ranking, journal, analytics) works
fully offline except the embedded TradingView chart in **Trade Workspace**,
which needs internet to load and shows a graceful message if you're offline.

## Daily workflow (under 15 minutes)

1. **Scanner Library** — copy one or more Chartink scanner clauses, run them at
   [chartink.com/screener/new](https://chartink.com/screener/new), export each result as CSV.
2. **Scanner Import** — drag & drop (or paste) the CSV(s). They're merged and
   de-duplicated by symbol automatically.
3. **Ranked Candidates** — review the Top 10 Long / Top 10 Short tabs
   (curated by the techno-funda score, auto-backfilling as you exclude
   candidates), or the Full List for everything at once.
4. **Trade Workspace** — click a candidate to open its chart, write a thesis,
   set entry/stop/target, see position size and reward:risk, and work through
   the checklist.
5. **Accept** into the **Journal**, or **Reject** and move on.
6. Check **Analytics** periodically for win rate, expectancy, drawdown, and
   setup-wise performance.

## Documentation

- [`docs/USER_MANUAL.md`](docs/USER_MANUAL.md) — full walkthrough of every screen
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — module map and data flow
- [`docs/FUTURE_ENHANCEMENTS.md`](docs/FUTURE_ENHANCEMENTS.md) — extension points (broker APIs, alerts, live data, Android)

## Data & privacy

Everything is stored in your browser's `localStorage` — nothing is sent to a
server. Use **Settings → Export Backup** to save a JSON snapshot of your
candidates, journal, and configuration before clearing browser data or
switching machines.

## Folder structure

```
swing-trading-system/
├── index.html                 # multi-file source (desktop/dev — edit this)
├── index.standalone.html       # single-file build (open this on mobile)
├── .github/workflows/
│   └── sync-market-data.yml   # scheduled GitHub Action — runs the sync daily
├── tools/
│   ├── sync_market_data.py    # NSE/BSE Bhavcopy sync + analytics computation
│   ├── requirements.txt       # Python deps for the sync script
│   └── build_standalone.py    # regenerates index.standalone.html from source
├── css/
│   ├── styles.css          # design tokens + base styles
│   └── components.css      # component-level styles
├── js/
│   ├── app.js               # shell: sidebar, ribbon, router
│   ├── utils.js              # DOM helpers, CSV parser, formatting, toast
│   ├── data/
│   │   ├── liveDataService.js     # fetches synced data from your GitHub Pages URL
│   │   ├── marketDataService.js   # demo data + TradingView-live index snapshot
│   │   └── scannerLibrary.js      # predefined Chartink scanner clauses (long + short)
│   ├── modules/
│   │   ├── storage.js         # localStorage abstraction
│   │   ├── candidates.js      # merge/dedupe/rank candidate pool, source batches
│   │   ├── universeScanner.js # runs our scanners against the synced full market
│   │   ├── scoring.js         # long/short techno-funda scoring engine
│   │   ├── checklist.js       # objective go/no-go checklist
│   │   ├── riskManager.js     # position sizing & exposure math
│   │   ├── journal.js         # trade journal CRUD
│   │   ├── analytics.js       # win rate / expectancy / drawdown
│   │   └── chartProvider.js   # TradingView embed wrapper (chart + live widgets)
│   └── views/
│       ├── dashboardView.js
│       ├── scannerImportView.js
│       ├── scannerLibraryView.js
│       ├── candidatesView.js
│       ├── marketIntelView.js     # Sector Analytics, RRG, deals, circuit list, etc.
│       ├── tradeWorkspaceView.js
│       ├── journalView.js
│       ├── analyticsView.js
│       └── settingsView.js
├── data/
│   ├── live/                  # synced output JSON lands here (created by the sync)
│   └── sample-candidates.csv  # example scanner export for testing manual import
└── docs/
    ├── LIVE_DATA_SETUP.md     # start here — one-time free setup for real data
    ├── USER_MANUAL.md
    ├── ARCHITECTURE.md
    └── FUTURE_ENHANCEMENTS.md
```

## Browser support

Latest Chrome, Edge, Firefox, or Safari. Uses ES2022+ modules, CSS Grid, and
`localStorage` — no transpilation or bundler needed.
