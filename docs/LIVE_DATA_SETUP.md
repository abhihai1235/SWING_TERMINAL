# Live Data Setup

This is the one-time setup that turns every "Demo data" label in the app
into real, daily-synced NSE data — Market Breadth, Sector Analytics, Top
Gainers, Past Winners, RRG, Bulk/Block Deals, Circuit List, Results
Calendar, and the Universe Scanner (which runs our scanners against the
*entire* synced market automatically, no manual Chartink export needed).

**Cost: ₹0.** This uses GitHub's free tier end to end — a scheduled GitHub
Actions job (2,000 free minutes/month; this job takes a few minutes and
runs once a day) and free GitHub Pages hosting for the output.

## What you're setting up, in one sentence

A script (`tools/sync_market_data.py`) downloads NSE's own free daily
Bhavcopy and a few other free NSE reports, computes the analytics, and
GitHub Actions runs it automatically every trading-day evening and
publishes the results — the app then just fetches that published data.

## Steps

### 1. Create a GitHub repository

1. Go to [github.com/new](https://github.com/new).
2. Name it anything (e.g. `swing-terminal`). **Public** repository (GitHub
   Pages' free tier requires this — nothing sensitive is published here,
   just market data everyone can already see on NSE's own website).
3. Click **Create repository**.

### 2. Upload this project into it

Easiest way if you're not familiar with git command line:

1. On your new repo's page, click **uploading an existing file**.
2. Drag in every file/folder from this project (`index.html`, `css/`,
   `js/`, `data/`, `docs/`, `tools/`, and importantly the hidden
   **`.github/`** folder — make sure your file browser is showing hidden
   files, since that's where the automation lives).
3. Commit the upload.

(If you're comfortable with git: `git init`, `git remote add origin
<your-repo-url>`, `git add .`, `git commit -m "initial"`, `git push -u
origin main` works too.)

### 3. Turn on GitHub Pages

1. In your repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. That's it — no further config here; our workflow file handles the
   actual publishing step.

### 4. Let the workflow run once

1. Go to the **Actions** tab in your repo.
2. You should see a workflow called **Sync NSE market data**. If GitHub
   asks you to confirm you want to enable Actions, click to enable them.
3. Click into it, then click **Run workflow** (this is the manual trigger —
   normally it just runs on the schedule automatically, but let's not wait
   until this evening to see if it works).
4. Wait a few minutes, then refresh — it should show a green checkmark.
   If it's red, click in to see the log; the most common cause is NSE
   having changed something (see Troubleshooting below).

### 5. Find your Pages URL and paste it into the app

1. Back in **Settings → Pages**, GitHub shows your live URL — something
   like `https://yourusername.github.io/swing-terminal`.
2. Open the app, go to **Settings → Live Market Data Sync**, paste that URL
   in, click **Save**, then **Test Connection**.
3. If it says "Connected," you're done — Dashboard, Market Intelligence,
   and the Universe Scanner in Scanner Import will now show real data.

## What runs when

The workflow is scheduled for **16:00 UTC (9:30 PM IST), Monday–Friday** —
after NSE typically publishes the day's Bhavcopy (~8 PM IST). You can
change the schedule in `.github/workflows/sync-market-data.yml` (it's a
standard cron expression) or just trigger it manually from the Actions tab
any time.

## Troubleshooting

- **Workflow fails on the "Run sync" step:** open the log. NSE
  occasionally restructures its site or report format — check the `nse`
  Python package's GitHub issues (it's actively maintained and usually
  gets patched quickly): `pip install --upgrade nse` in
  `tools/requirements.txt` often fixes it.
- **"Test Connection" fails in the app but the workflow succeeded:**
  double check the URL — it should be exactly what GitHub Pages shows you
  in Settings → Pages, with no trailing slash needed (the app strips one if
  present).
- **Sector Analytics / RRG look empty even though breadth works:** these
  need the sector-index constituent lists and historical index data, which
  are separate NSE calls from the plain Bhavcopy — check the workflow log
  for warnings from `refresh_sector_map` or `sync_rrg_data` specifically.
- **Past Winners looks empty on day one:** it needs the rolling price
  history to build up over time — this fills in automatically over the
  following days/weeks as the sync accumulates history in
  `data/live/price_history.json` (up to ~300 trading days retained).

## Data freshness expectations

Everything here refreshes once per trading day, matching how swing trading
actually operates (decisions made on daily bars) — and for what it's
worth, this is also how ChartsMaze itself operates, so this isn't a
compromise against what you were benchmarking against. If you later want
true intraday ticks, that's a materially different, paid-data-vendor
project — see `docs/FUTURE_ENHANCEMENTS.md`.
