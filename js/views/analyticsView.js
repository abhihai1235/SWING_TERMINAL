
function renderAnalytics(container) {
  container.innerHTML = "";
  container.appendChild(
    el("div", { class: "view-header" }, [
      el("div", {}, [
        el("h2", { class: "view-title" }, "Analytics"),
        el("div", { class: "view-subtitle" }, "Objective, retrospective performance statistics computed from your closed journal entries."),
      ]),
    ])
  );

  const stats = getSummaryStats();
  if (!stats.totalTrades) {
    container.appendChild(el("div", { class: "empty-state" }, [
      el("div", { class: "empty-state-icon" }, "◇"),
      el("p", {}, "No closed trades yet."),
      el("p", { class: "txt-muted" }, "Analytics populate automatically once you mark journal entries as Closed with an exit price."),
    ]));
    return;
  }

  container.appendChild(
    el("div", { class: "grid grid-4" }, [
      analyticsStatCard(String(stats.totalTrades), "Total Trades"),
      analyticsStatCard(stats.winRate + "%", "Win Rate", stats.winRate >= 50 ? "pos" : "neg"),
      analyticsStatCard(fmtINR(stats.avgWin, 0), "Avg Win", "pos"),
      analyticsStatCard(fmtINR(stats.avgLoss, 0), "Avg Loss", "neg"),
    ])
  );
  container.appendChild(
    el("div", { class: "grid grid-3 mt-16" }, [
      analyticsStatCard(fmtINR(stats.expectancy, 0), "Expectancy / Trade", stats.expectancy >= 0 ? "pos" : "neg"),
      analyticsStatCard(fmtINR(stats.maxDrawdown, 0), "Max Drawdown", "neg"),
      analyticsStatCard(fmtINR(stats.totalPnl, 0), "Total P&L", stats.totalPnl >= 0 ? "pos" : "neg"),
    ])
  );

  const monthly = getMonthlyPerformance();
  const monthlyPanel = el("div", { class: "panel mt-16" }, [el("div", { class: "panel-title" }, "Monthly Performance")]);
  if (monthly.length) {
    const maxAbs = Math.max(...monthly.map((m) => Math.abs(m.pnl)), 1);
    monthly.forEach((m) => {
      const pct = Math.max(4, (Math.abs(m.pnl) / maxAbs) * 100);
      monthlyPanel.appendChild(
        el("div", { class: "sector-bar-row" }, [
          el("span", {}, m.month),
          el("div", { class: "sector-bar-track" }, [el("div", { class: "sector-bar-fill", style: `width:${pct}%; background:${m.pnl >= 0 ? "var(--accent-teal)" : "var(--accent-red)"};` })]),
          el("span", { class: `mono text-right ${m.pnl >= 0 ? "txt-teal" : "txt-red"}` }, fmtINR(m.pnl, 0)),
        ])
      );
    });
  } else {
    monthlyPanel.appendChild(el("p", { class: "txt-muted" }, "Not enough data yet."));
  }
  container.appendChild(monthlyPanel);

  const setupStats = getSetupWiseStats();
  const setupPanel = el("div", { class: "panel mt-16" }, [el("div", { class: "panel-title" }, "Setup-wise Statistics")]);
  const table = el("table");
  table.appendChild(el("thead", {}, el("tr", {}, ["Setup", "Trades", "Win Rate", "Total P&L"].map((h) => el("th", {}, h)))));
  const tbody = el("tbody");
  setupStats.forEach((s) => {
    tbody.appendChild(el("tr", {}, [
      el("td", {}, s.setupType),
      el("td", {}, String(s.trades)),
      el("td", {}, s.winRate + "%"),
      el("td", { class: s.totalPnl >= 0 ? "txt-teal" : "txt-red" }, fmtINR(s.totalPnl, 0)),
    ]));
  });
  table.appendChild(tbody);
  setupPanel.appendChild(el("div", { class: "table-wrap" }, [table]));
  container.appendChild(setupPanel);
}

function analyticsStatCard(value, label, cls = "") {
  return el("div", { class: "panel stat-card" }, [el("div", { class: `stat-value ${cls}` }, value), el("div", { class: "stat-label" }, label)]);
}
