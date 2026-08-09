# User Manual

## 1. Dashboard

Your morning snapshot. The **Live Market Technical Rating** panel is
genuinely live (a free TradingView widget, no signup) — everything below it
(index cards, market breadth, sector strength, heat map) is clearly labeled
"demo data": realistic sample values, not a live feed, since NSE/BSE don't
offer a free public API for breadth or cross-sectional relative strength.
The scrolling ticker at the very top of every screen is also genuinely live.

## 2. Scanner Library

Ready-to-use Chartink scanner clauses for both directions:

**Long setups:** Trend Continuation, Breakout, Pullback, Darvas-style Consolidation, Stage-2 Candidates, Momentum, High Relative Strength, Tight Consolidation (VCP), IPO Base.

**Short setups:** Breakdown, Distribution/Topping, Relative Weakness, Downtrend Continuation, Bearish Rally Failure — real short-side clauses, mirroring the long-side logic (falling moving averages, underperformance vs Nifty, distribution volume, rejection at declining resistance), not just "low-scoring longs."

**Watchlist only:** Failed Breakouts — kept for studying failure patterns, not for trading.

**To use one:** click **Copy Clause**, open
[chartink.com/screener/new](https://chartink.com/screener/new), paste it into
the query box, run the scan, then use Chartink's export/copy icon to get a
CSV of the results.

## 3. Scanner Import

**Run Scanners Against Synced Data** (top of the page) is the automatic
path — one click scans the entire synced NSE universe with our own
implementation of every long/short scanner and merges matches straight
into your candidate pool, exactly like a CSV import would, with no manual
Chartink export step. Requires live data to be configured (see Settings
and `docs/LIVE_DATA_SETUP.md`). Untick any scanners you don't want to run
that pass.

Below that, the manual path still works exactly as before — useful for
one-off Chartink clauses not in our library, or if you haven't set up live
sync yet:

- **Drag & drop** one or more `.csv` files onto the dropzone, or click it to browse.
- **Paste CSV text** directly if you copied a table instead of downloading a file.
- **Load Sample Data** populates the app with realistic example candidates (both long and short setups) so you can explore every module immediately.
- **Clear All Candidates** empties the entire pool and all import history (your journal is untouched).

Both paths merge and **de-duplicate by symbol** — if a stock is flagged by
multiple sources, its `scannerSource` field lists all of them.

**Imported Sources** panel — every scan/CSV/paste/sample-load you bring in
is tracked as its own source. If one turns out to be noisy, click **Remove
source** next to just that one: stocks *only* flagged by that source are
removed; stocks other scanners also flagged stay in the pool, just without
that source's contribution. This is different from **Clear All
Candidates**, which wipes everything.

## 4. Market Intelligence

Populated once live data is configured (Settings → Live Market Data Sync;
otherwise this page just tells you to set that up first). Seven tabs:

- **Top Gainers/Losers** — real movers across the whole synced market, today.
- **Sector Analytics** — real sector performance, averaged from actual constituent price moves (not a proxy).
- **Past Winners** — best trailing-return performers across the synced universe (needs a few months of accumulated history to be meaningful — starts sparse on day one and fills in).
- **RRG** — a relative-rotation quadrant chart (Leading / Weakening / Lagging / Improving) plotting each sector's relative-strength ratio and momentum against a NIFTY 500 benchmark, with a trailing tail. This is our own implementation of the well-known underlying concept — "RRG®" itself is a trademark of Julius de Kempenaer/RRG Research, and this isn't a claim of exact formula parity.
- **Bulk & Block Deals** — large trades reported to NSE, including short-selling data.
- **Circuit List** — daily price-band/circuit-limit revisions.
- **Results Calendar** — upcoming board meetings for the next three weeks.

## 5. Ranked Candidates

Three tabs:

- **Top 10 Long** and **Top 10 Short** — curated automatically from the
  composite techno-funda score, one tab per direction. Click **Exclude** on
  any row to drop it from consideration; the next-best candidate from the
  pool automatically fills the empty slot. Excluded candidates aren't
  deleted — they're kept, marked, and can be brought back.
- **Full List** — every non-excluded candidate, sortable by any column.
  Check **Show excluded candidates too** to see (and **Restore**) anything
  you excluded from either Top 10 tab or the Trade Workspace's Reject
  button. This tab also has a permanent **✕** to fully delete a candidate
  from the pool (not just exclude it from ranking).

A "◐ limited data" tag appears under a symbol when its scanner export was
missing technical fields (SMA/RSI/52-week high) — several of that
candidate's score categories fell back to a neutral estimate, so treat its
score with a bit more caution than a fully-populated row.

## 6. Trade Workspace

Opens when you click a candidate. Contains:

- **Chart** — an embedded TradingView chart with 1D/1H/D/W/M timeframe buttons (requires internet; shows a graceful message if offline).
- **Live Technical Rating** — a free, genuinely live TradingView gauge (Strong Buy → Strong Sell) for this exact symbol, shown separately from our own techno-funda composite score above it so the two are never confused.
- **Trade thesis & S/R notes** — free-text fields for why you're taking the trade and the levels you're watching.
- **Trade plan** — direction, entry zone, stop-loss, target. Position size,
  capital required, risk amount, % of capital deployed, and reward:risk are
  calculated live from your Risk Manager settings.
- **Trade checklist** — ten objective yes/no conditions; items marked
  *critical* are flagged in red if unchecked. You can still accept a setup
  with unchecked critical items, but you'll be asked to confirm first.
- **Personal notes** — persist on the candidate itself.
- **Accept — Send to Journal** creates a journal entry with a snapshot of the
  plan, checklist state, and score. **Reject** excludes the candidate from
  Top 10/ranking for your own reference without deleting it — same as
  clicking Exclude in Ranked Candidates, and just as restorable.

## 7. Journal

Every accepted setup, most recent first. For each entry you can:

- Change **status**: Planned → Open → Closed.
- Once **Open** or **Closed**, enter an **exit price** and **exit date** — realized P&L (₹ and %) is calculated automatically for closed trades.
- Record **notes**, **mistakes**, and **lessons learned**.
- **Delete** an entry if it was added by mistake.

## 8. Analytics

Computed strictly from **closed** journal entries: total trades, win rate,
average win/loss, expectancy per trade, maximum drawdown (on the cumulative
P&L curve), total P&L, a monthly performance breakdown, and setup-wise
statistics (which setup types are actually working for you). These are
retrospective statistics, not predictions.

## 9. Settings

- **Live Market Data Sync** — paste your GitHub Pages URL here once you've
  done the one-time setup in `docs/LIVE_DATA_SETUP.md`. **Test Connection**
  confirms the app can reach it. This single setting is what switches
  Dashboard, Market Intelligence, and the Universe Scanner from demo data
  to the real, daily-synced NSE market.
- **Risk Manager Defaults** — total trading capital, max risk per trade (%),
  max portfolio exposure (%). These drive every position-size calculation in
  the Trade Workspace.
- **Scoring Weights** — a slider per category: Trend (Stage Analysis),
  Relative Strength, Volume (Accumulation/Distribution), Liquidity,
  Proximity to High/Low, Momentum (RSI), Base Quality (VCP),
  Breakout/Breakdown Quality, Risk/Reward, Fundamentals (EPS/Sales/ROE — only
  active if your CSV includes those columns), and Market Context (whether
  the broader Nifty trend/breadth/VIX currently favors longs or shorts).
  Weights are used proportionally so they don't need to sum to 100. Reset to
  defaults anytime.
- **Data** — export a full JSON backup of candidates, journal, and settings,
  or clear all locally stored app data.

## Keyboard & accessibility notes

- The Scanner Import dropzone is focusable and can be activated with
  Enter/Space.
- All interactive controls show a visible focus ring.
- Motion is minimal and respects `prefers-reduced-motion`.
