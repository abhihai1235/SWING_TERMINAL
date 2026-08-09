
async function renderDashboard(container) {
  container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading market snapshot…</p></div>`;

  const [indices, breadth, sectors] = await Promise.all([
    getIndexSnapshot(), getMarketBreadth(), getSectorStrength(),
  ]);
  const candidates = getRankedCandidates().slice(0, 5);
  const stats = getSummaryStats();
  const recentClosed = getClosedTrades().slice(0, 3);

  container.innerHTML = "";
  container.appendChild(
    el("div", { class: "view-header" }, [
      el("div", {}, [
        el("h2", { class: "view-title" }, "Dashboard"),
        el("div", { class: "view-subtitle" }, "Morning market snapshot — indices, breadth, sector strength, and where you left off in the journal."),
      ]),
    ])
  );

  // ---- Live market technical rating (genuinely live, free TradingView widget) ----
  const liveRatingPanel = el("div", { class: "panel" }, [
    el("div", { class: "panel-title" }, ["Live Market Technical Rating — NIFTY 50", el("span", { class: "txt-muted", style: "text-transform:none; letter-spacing:0;" }, "TradingView, real-time")]),
    el("div", { id: "dash-tv-gauge" }),
  ]);

  // ---- Index cards (demo values) ----
  const indexGrid = el("div", { class: "grid grid-4" });
  const indexGridLabel = el("p", { class: "txt-muted", style: "font-size:11px; margin: -4px 0 8px;" }, "Demo values below — see the live ticker at the top of the screen for real prices.");
  indices.forEach((idx) => {
    const isUp = idx.changePct >= 0;
    indexGrid.appendChild(
      el("div", { class: "panel stat-card" }, [
        el("div", { class: "stat-label" }, idx.name),
        el("div", { class: `stat-value ${isUp ? "pos" : "neg"}` }, idx.isVix ? idx.value.toFixed(2) : idx.value.toLocaleString("en-IN", { maximumFractionDigits: 0 })),
        el("div", { class: `mono ${isUp ? "txt-teal" : "txt-red"}` }, fmtPct(idx.changePct)),
      ])
    );
  });

  // ---- Breadth panel ----
  const breadthPanel = el("div", { class: "panel" }, [
    el("div", { class: "panel-title" }, ["Market Breadth", liveBadge(breadth.isLive, breadth.asOf)]),
    el("div", { class: "grid grid-3" }, [
      el("div", { class: "stat-card" }, [el("div", { class: "stat-value pos" }, String(breadth.advances)), el("div", { class: "stat-label" }, "Advances")]),
      el("div", { class: "stat-card" }, [el("div", { class: "stat-value neg" }, String(breadth.declines)), el("div", { class: "stat-label" }, "Declines")]),
      el("div", { class: "stat-card" }, [el("div", { class: "stat-value" }, String(breadth.adRatio)), el("div", { class: "stat-label" }, "A/D Ratio")]),
    ]),
    breadth.isLive && breadth.newHighs !== undefined
      ? el("div", { class: "grid grid-2 mt-8" }, [
          el("div", { class: "stat-card" }, [el("div", { class: "stat-value pos" }, String(breadth.newHighs)), el("div", { class: "stat-label" }, "52W Highs")]),
          el("div", { class: "stat-card" }, [el("div", { class: "stat-value neg" }, String(breadth.newLows)), el("div", { class: "stat-label" }, "52W Lows")]),
        ])
      : null,
  ]);

  // ---- Sector strength ----
  const maxAbs = Math.max(...sectors.map((s) => Math.abs(s.relativeStrength)), 1);
  const sectorBars = (list) =>
    el("div", {}, list.map((s) => {
      const pct = clampPct((s.relativeStrength / maxAbs) * 50 + 50);
      const color = s.relativeStrength >= 0 ? "var(--accent-teal)" : "var(--accent-red)";
      return el("div", { class: "sector-bar-row" }, [
        el("span", {}, s.name),
        el("div", { class: "sector-bar-track" }, [el("div", { class: "sector-bar-fill", style: `width:${pct}%; background:${color};` })]),
        el("span", { class: "mono text-right" }, fmtPct(s.relativeStrength)),
      ]);
    }));

  const sectorPanel = el("div", { class: "grid grid-2" }, [
    el("div", { class: "panel" }, [el("div", { class: "panel-title" }, ["Strongest Sectors", liveBadge(sectors[0]?.isLive)]), sectorBars(sectors.slice(0, 6))]),
    el("div", { class: "panel" }, [el("div", { class: "panel-title" }, ["Weakest Sectors", liveBadge(sectors[0]?.isLive)]), sectorBars([...sectors].reverse().slice(0, 6))]),
  ]);

  // ---- Heatmap placeholder ----
  const heatmapPanel = el("div", { class: "panel" }, [
    el("div", { class: "panel-title" }, ["Sector Heat Map", liveBadge(sectors[0]?.isLive)]),
    el("div", { class: "heatmap-grid" }, sectors.map((s) => {
      const intensity = clampPct(50 + s.relativeStrength * 10);
      const bg = s.relativeStrength >= 0 ? `rgba(47,191,159,${0.25 + intensity / 200})` : `rgba(229,83,75,${0.25 + intensity / 200})`;
      return el("div", { class: "heatmap-cell", style: `background:${bg}; color:#0A0D12;` }, [s.name, el("br"), fmtPct(s.relativeStrength)]);
    })),
  ]);

  // ---- Top candidates preview ----
  const candidatesPanel = el("div", { class: "panel" }, [
    el("div", { class: "panel-title" }, ["Today's Top-Ranked Candidates", el("a", { href: "#", onclick: (e) => { e.preventDefault(); document.querySelector('[data-nav="candidates"]').click(); } }, "View all →")]),
    candidates.length
      ? el("div", { class: "table-wrap" }, [renderMiniCandidateTable(candidates)])
      : el("div", { class: "empty-state" }, [el("div", { class: "empty-state-icon" }, "◇"), el("p", {}, "No candidates yet."), el("p", { class: "txt-muted" }, "Import a Chartink scanner CSV to populate your ranked watchlist.")]),
  ]);

  // ---- Journal summary ----
  const journalPanel = el("div", { class: "panel" }, [
    el("div", { class: "panel-title" }, "Recent Journal Summary"),
    el("div", { class: "grid grid-4" }, [
      dashboardStatCard(String(stats.totalTrades), "Closed Trades"),
      dashboardStatCard(stats.winRate + "%", "Win Rate", stats.winRate >= 50 ? "pos" : "neg"),
      dashboardStatCard(fmtINR(stats.expectancy, 0), "Expectancy / Trade", stats.expectancy >= 0 ? "pos" : "neg"),
      dashboardStatCard(fmtINR(stats.totalPnl, 0), "Total P&L", stats.totalPnl >= 0 ? "pos" : "neg"),
    ]),
    recentClosed.length
      ? el("ul", { class: "mt-16" }, recentClosed.map((t) => el("li", { class: "plan-row" }, [
          el("span", { class: "label" }, `${t.symbol} — ${t.setupType || "Unclassified"}`),
          el("span", { class: `value ${t.pnl >= 0 ? "txt-teal" : "txt-red"}` }, fmtINR(t.pnl, 0)),
        ])))
      : el("p", { class: "txt-muted mt-8" }, "No closed trades yet — outcomes will appear here once you close a journaled position."),
  ]);

  container.append(liveRatingPanel, indexGridLabel, indexGrid, breadthPanel, sectorPanel, heatmapPanel, candidatesPanel, journalPanel);
  renderTechnicalAnalysisGauge($("#dash-tv-gauge", liveRatingPanel), "NIFTY", "1D");
}

function clampPct(v) { return Math.max(4, Math.min(100, v)); }

function dashboardStatCard(value, label, cls = "") {
  return el("div", { class: "stat-card" }, [el("div", { class: `stat-value ${cls}` }, value), el("div", { class: "stat-label" }, label)]);
}

function renderMiniCandidateTable(candidates) {
  const table = el("table");
  table.appendChild(el("thead", {}, el("tr", {}, ["Score", "Symbol", "Sector", "LTP", "Chg%", "Bias"].map((h) => el("th", {}, h)))));
  const tbody = el("tbody");
  candidates.forEach((c) => {
    tbody.appendChild(el("tr", {}, [
      el("td", {}, String(c.composite)),
      el("td", {}, c.symbol),
      el("td", {}, c.sector || "—"),
      el("td", {}, fmtINR(c.ltp)),
      el("td", { class: c.changePct >= 0 ? "txt-teal" : "txt-red" }, fmtPct(c.changePct)),
      el("td", {}, el("span", { class: `badge badge-${c.bias === "long" ? "long" : "short"}` }, c.bias)),
    ]));
  });
  table.appendChild(tbody);
  return table;
}
