# Architecture

## Design goals

1. **No build step.** Plain `<script>` tags loaded in dependency order by the
   browser — no ES module `import`/`export`, so the app works by simply
   double-clicking `index.html` (ES modules are blocked by CORS on the
   `file://` protocol in every major browser, which would force a trader to
   run a local server just to open the app each morning). Every file adds a
   small number of uniquely-named functions to the shared global scope.
2. **Service abstraction.** Every external concern — market data, chart
   rendering, persistence — sits behind a small file with a stable set of
   function signatures, so the *implementation* can change (sample data → live
   feed, TradingView → another charting library, localStorage → a real
   backend) without touching any view code.
3. **Views are dumb.** Files under `js/views/` only read from modules and
   render DOM; they hold no business logic (scoring math, risk math, merge
   logic all live in `js/modules/`).
4. **One source of truth per concern.** Candidates live in one place
   (`modules/candidates.js`), journal entries in one place
   (`modules/journal.js`), etc. Every view reads/writes through those files.

## Layers

```
┌─────────────────────────────────────────────────────────┐
│ views/*.js         — render DOM, wire up event handlers  │
├─────────────────────────────────────────────────────────┤
│ modules/*.js       — business logic (pure where possible) │
│   candidates.js  scoring.js  checklist.js  riskManager.js │
│   journal.js  analytics.js  chartProvider.js  storage.js  │
├─────────────────────────────────────────────────────────┤
│ data/*.js          — data providers (currently sample data)│
│   marketDataService.js   scannerLibrary.js                │
├─────────────────────────────────────────────────────────┤
│ localStorage       — persistence (namespaced, JSON)        │
└─────────────────────────────────────────────────────────┘
```

## Data flow: a single morning workflow

1. **Scanner Library** hands the user a Chartink clause (static data, no
   app state involved).
2. **Scanner Import** parses CSV text with a hand-written parser
   (`utils.js: parseCSV`) — no external CSV library dependency, so the app
   has zero runtime dependencies and works with no network at all.
3. Parsed rows are normalized (header aliases → canonical field names in
   `utils.js: normalizeRecord`) and merged into the candidate pool via
   `modules/candidates.js: mergeCandidates`, which de-duplicates by symbol
   and persists through `modules/storage.js`.
4. **Ranked Candidates** calls `candidates.js: getRankedCandidates()`, which
   re-scores every candidate on the fly using `modules/scoring.js` and the
   user's configured weights (`Settings`), then sorts descending.
5. **Trade Workspace** reads one candidate, renders a chart through
   `modules/chartProvider.js` (the only file that talks to TradingView),
   computes live position sizing through `modules/riskManager.js`, and
   evaluates the checklist through `modules/checklist.js`.
6. **Accept** writes a new record via `modules/journal.js: addJournalEntry`,
   which snapshots the plan, checklist results, and score at that moment (so
   later changes to scoring weights don't rewrite history).
7. **Analytics** derives every statistic from closed journal entries only
   (`modules/analytics.js`) — nothing is stored twice; win rate, expectancy,
   and drawdown are computed on read.

## Live data pipeline

`tools/sync_market_data.py` runs OUTSIDE the browser (on a schedule, via
`.github/workflows/sync-market-data.yml` — GitHub Actions, free tier) since
NSE's site can't be reached from a browser (no CORS headers, and it blocks
plain scripted requests without a real session). It downloads NSE's own
free daily Bhavcopy (every listed equity's EOD OHLCV) plus a handful of
other free NSE reports, using the actively-maintained `nse` PyPI package
rather than hand-rolled scraping. It maintains a rolling per-symbol price
history (`data/live/price_history.json`, ~300 trading days) and computes,
in one place, every derived analytic the app needs: market breadth,
sector performance, a genuine cross-sectional RS Rating (percentile rank
across the whole synced universe, not a single-stock proxy), top movers,
past winners, and an RRG-style relative-rotation tail per sector. Results
are committed back to the repo and published via GitHub Pages.

`js/data/liveDataService.js` is the only file that knows about this
published data — it fetches each JSON file from the user's configured
GitHub Pages URL (`Settings → Live Market Data Sync`), with an in-memory
5-minute cache, and fails soft (returns `null`) if unreachable or not yet
configured. Every view that shows this data (`dashboardView.js`,
`marketIntelView.js`) checks for `null`/`isLive` and falls back to a
clearly-labeled demo state — the same honest-fallback pattern used for the
TradingView chart and widgets elsewhere in the app.

`js/modules/universeScanner.js` is what turns "manually run a scanner on
Chartink, export CSV, import it" into one click: it derives SMA/RSI/52-week
fields from the synced price history (Bhavcopy alone only has OHLCV, not
indicators) and runs a JS predicate per scanner — a direct re-implementation
of each `scannerLibrary.js` entry's intent, not a generic Chartink-syntax
interpreter — against every synced symbol, then merges matches into the
candidate pool through the exact same `mergeCandidates()` used by manual
CSV import, so the rest of the app (scoring, Top 10, journal) doesn't need
to know or care which path a candidate came from.

## Scoring engine

`modules/scoring.js` computes **two separate composite scores per
candidate** — a long-setup score and a short-setup score — each a weighted
blend of eleven categories (Trend/Stage Analysis, Relative Strength, Volume,
Liquidity, Proximity to High/Low, Momentum, Base Quality (VCP), Breakout/
Breakdown Quality, Risk/Reward, Fundamentals, Market Context). The long and
short sub-scores are NOT mirror images computed as `100 - score` — each
category has its own direction-appropriate implementation (e.g.
`scoreTrendLong` checks price above rising 50/200 SMA; `scoreTrendShort`
checks price below falling 50/200 SMA — a stock with no clear trend either
way scores modestly on both, rather than being forced into one bucket).

A candidate's displayed `bias` is whichever direction scored higher, and its
displayed `composite` is that direction's score — so "Top 10 Short" is
genuinely ranked by short-setup quality, not by "worst longs." Weights are
user-configurable (`Settings → Scoring Weights`, persisted via
`storage.js`) and don't need to sum to 100 — the engine normalizes by their
sum at score time.

**Market Context** reads a cached `bias` ("supportive"/"neutral"/
"unsupportive" for longs) computed once per session by
`data/marketDataService.js: refreshMarketBiasFromSnapshot()` from the index
snapshot and breadth reading, and stored via `Store` so every synchronous
`scoreCandidate()` call can read it without an async round-trip. This is
intentionally cached rather than freshly randomized per score — with the
current sample data generator, re-fetching on every score calculation would
make rankings flicker between renders for no real reason; replacing
`marketDataService.js` with a live feed later makes this reflect the
actual current tape once per session (or however often you choose to call
refresh).

**Fundamentals** (`epsGrowth`, `salesGrowth`, `roe`) are optional — Chartink
scanners that add these as custom output columns will populate them via the
header aliases in `utils.js`; if absent, that category returns a neutral 50
and the row is flagged "◐ limited data" if enough other fields are also
missing (`dataCompleteness()`).

This is intentionally transparent and inspectable — every sub-score is
computed from fields the user can see, not a black-box model, matching the
"objective decision support, not prediction" requirement of the brief.

## Source tracking & curated Top 10

`modules/candidates.js` records every import (a CSV file, a paste, or the
sample data) as an **import batch** with its own id. Each candidate
remembers which batch(es) contributed to it (`sourceBatches`). Removing one
batch (`removeImportBatch`) only deletes candidates that came *exclusively*
from it — a symbol two scanners both flagged keeps its other source's
contribution. This is different from `clearCandidates()`, which wipes
everything.

Candidates also carry a `rejected` flag, set by "Exclude" (Ranked
Candidates) or "Reject" (Trade Workspace) and cleared by "Restore."
`getRankedCandidates()` filters these out by default, and `getTopCandidates
(bias, count)` slices the top N of what's left — so excluding a candidate
that was in the Top 10 automatically promotes the next-ranked one on the
next render. `views/candidatesView.js` keeps a single `refreshAllPanels()`
callback that every mutating action (exclude/restore/remove) calls, so the
Top 10 Long, Top 10 Short, and Full List tabs all stay in sync regardless
of which tab the action happened in.

## State & persistence

`modules/storage.js` wraps `localStorage` behind `Store.get/set/remove` and
namespaces every key under `swingTerminal.v1.*`, plus `exportAll`/`importAll`
for backup and migration. This is the single seam to replace if/when the app
grows a real backend (see `FUTURE_ENHANCEMENTS.md`).

## Two ship targets from one source

`index.html` + `css/` + `js/` is the actual source of truth — this is what
you edit. `index.standalone.html` is a generated artifact: all CSS and JS
inlined into one file, produced by `tools/build_standalone.py`. It exists
because mobile browsers frequently open local HTML files through a
`content://` URI (via the file manager's Storage Access Framework hand-off)
rather than a real filesystem path, which silently breaks every relative
`<link>`/`<script src>` reference — the standalone file has none, so it's
immune to that failure mode. After editing anything under `css/` or `js/`,
regenerate it with:

```bash
python3 tools/build_standalone.py
```

## Why no framework?

The brief calls for an offline, dependency-light, fast, keyboard-friendly
tool. Vanilla ES modules with a small `el()` DOM-builder helper
(`utils.js`) keep the app inspectable end-to-end in a code review, with zero
`npm install` and zero build tooling — appropriate for a tool a trader will
run by double-clicking a file every morning.
