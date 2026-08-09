/**
 * analytics.js
 * Derives performance statistics purely from closed journal entries.
 * No predictions — strictly retrospective, objective arithmetic.
 */


function getClosedTrades() {
  return getJournalEntries()
    .filter((e) => e.status === "closed" && e.exitPrice !== null && e.exitPrice !== undefined)
    .map((e) => ({ ...e, pnl: computePnl(e), pnlPct: computePnlPct(e) }));
}

function getSummaryStats() {
  const closed = getClosedTrades();
  if (!closed.length) {
    return { totalTrades: 0, winRate: 0, avgWin: 0, avgLoss: 0, expectancy: 0, maxDrawdown: 0, totalPnl: 0 };
  }
  const wins = closed.filter((t) => t.pnl > 0);
  const losses = closed.filter((t) => t.pnl <= 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
  const winRate = (wins.length / closed.length) * 100;
  const expectancy = (winRate / 100) * avgWin + (1 - winRate / 100) * avgLoss;
  const totalPnl = closed.reduce((s, t) => s + t.pnl, 0);

  // Max drawdown on cumulative equity curve ordered by exit date.
  const ordered = [...closed].sort((a, b) => new Date(a.exitDate || a.dateAdded) - new Date(b.exitDate || b.dateAdded));
  let equity = 0, peak = 0, maxDD = 0;
  for (const t of ordered) {
    equity += t.pnl;
    peak = Math.max(peak, equity);
    maxDD = Math.min(maxDD, equity - peak);
  }

  return {
    totalTrades: closed.length,
    winRate: +winRate.toFixed(1),
    avgWin: +avgWin.toFixed(0),
    avgLoss: +avgLoss.toFixed(0),
    expectancy: +expectancy.toFixed(0),
    maxDrawdown: +maxDD.toFixed(0),
    totalPnl: +totalPnl.toFixed(0),
  };
}

function getMonthlyPerformance() {
  const closed = getClosedTrades();
  const byMonth = {};
  for (const t of closed) {
    const d = t.exitDate || t.dateAdded;
    if (!d) continue;
    const key = d.slice(0, 7); // YYYY-MM
    byMonth[key] = (byMonth[key] || 0) + t.pnl;
  }
  return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, pnl]) => ({ month, pnl: +pnl.toFixed(0) }));
}

function getSetupWiseStats() {
  const closed = getClosedTrades();
  const bySetup = {};
  for (const t of closed) {
    const key = t.setupType || "Unclassified";
    if (!bySetup[key]) bySetup[key] = { setupType: key, trades: 0, wins: 0, totalPnl: 0 };
    bySetup[key].trades += 1;
    if (t.pnl > 0) bySetup[key].wins += 1;
    bySetup[key].totalPnl += t.pnl;
  }
  return Object.values(bySetup)
    .map((s) => ({ ...s, winRate: +((s.wins / s.trades) * 100).toFixed(1), totalPnl: +s.totalPnl.toFixed(0) }))
    .sort((a, b) => b.totalPnl - a.totalPnl);
}
