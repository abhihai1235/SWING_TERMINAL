/**
 * marketIntelView.js
 * Tabs mapped to the feature list you asked for: Sector Analytics, Top
 * Gainers, Past Winners, RRG, Bulk & Block Deals, Circuit Revision List,
 * Results Calendar — all driven by the synced full-NSE-universe data when
 * configured (Settings → Live Market Data Sync), with a clear empty state
 * when it isn't.
 */

let intelActiveTab = "movers";

async function renderMarketIntel(container) {
  container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading market intelligence…</p></div>`;

  const configured = isLiveDataConfigured();

  container.innerHTML = "";
  container.appendChild(
    el("div", { class: "view-header" }, [
      el("div", {}, [
        el("h2", { class: "view-title" }, "Market Intelligence"),
        el("div", { class: "view-subtitle" }, "Sector analytics, top movers, RRG, deals, circuit list, and the results calendar — from your synced NSE data."),
      ]),
      liveBadge(configured),
    ])
  );

  if (!configured) {
    container.appendChild(el("div", { class: "empty-state" }, [
      el("div", { class: "empty-state-icon" }, "◇"),
      el("p", {}, "Live data isn't configured yet."),
      el("p", { class: "txt-muted" }, "Set your GitHub Pages URL in Settings → Live Market Data Sync to populate this page — see docs/LIVE_DATA_SETUP.md for the one-time setup."),
    ]));
    return;
  }

  const tabs = el("div", { class: "tabs" }, [
    intelTabButton("movers", "Top Gainers/Losers"),
    intelTabButton("sectors", "Sector Analytics"),
    intelTabButton("winners", "Past Winners"),
    intelTabButton("rrg", "RRG"),
    intelTabButton("deals", "Bulk & Block Deals"),
    intelTabButton("circuit", "Circuit List"),
    intelTabButton("calendar", "Results Calendar"),
  ]);
  container.appendChild(tabs);

  const panels = {};
  ["movers", "sectors", "winners", "rrg", "deals", "circuit", "calendar"].forEach((key) => {
    panels[key] = el("div", { class: `tab-panel${intelActiveTab === key ? " is-active" : ""}`, id: `intel-panel-${key}` });
    container.appendChild(panels[key]);
  });

  $$(".tab-btn", tabs).forEach((btn) => btn.addEventListener("click", () => {
    intelActiveTab = btn.dataset.tab;
    $$(".tab-btn", tabs).forEach((b) => b.classList.toggle("is-active", b === btn));
    Object.entries(panels).forEach(([key, p]) => p.classList.toggle("is-active", key === intelActiveTab));
  }));

  drawMoversTab(panels.movers);
  drawSectorsTab(panels.sectors);
  drawWinnersTab(panels.winners);
  drawRrgTab(panels.rrg);
  drawDealsTab(panels.deals);
  drawCircuitTab(panels.circuit);
  drawCalendarTab(panels.calendar);
}

function intelTabButton(tab, label) {
  return el("button", { class: `tab-btn${intelActiveTab === tab ? " is-active" : ""}`, "data-tab": tab }, label);
}

function emptyPanelState(panel, message) {
  panel.innerHTML = "";
  panel.appendChild(el("div", { class: "empty-state" }, [el("div", { class: "empty-state-icon" }, "◇"), el("p", { class: "txt-muted" }, message)]));
}

/* ---------------------------------------------------------------------- */

async function drawMoversTab(panel) {
  panel.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  const data = await getLiveTopMovers();
  if (!data) return emptyPanelState(panel, "Not synced yet — the workflow needs to run at least once.");

  panel.innerHTML = "";
  panel.appendChild(el("p", { class: "txt-muted", style: "font-size:11px;" }, `As of ${data.asOf}`));
  const grid = el("div", { class: "grid grid-2" }, [
    el("div", { class: "panel" }, [el("div", { class: "panel-title" }, "Top Gainers"), moversTable(data.gainers, true)]),
    el("div", { class: "panel" }, [el("div", { class: "panel-title" }, "Top Losers"), moversTable(data.losers, false)]),
  ]);
  panel.appendChild(grid);
}

function moversTable(rows, isGain) {
  const table = el("table");
  table.appendChild(el("thead", {}, el("tr", {}, ["Symbol", "LTP", "Chg %"].map((h) => el("th", {}, h)))));
  const tbody = el("tbody");
  (rows || []).slice(0, 15).forEach((r) => {
    tbody.appendChild(el("tr", {}, [
      el("td", {}, el("strong", {}, r.symbol)),
      el("td", {}, fmtINR(r.close)),
      el("td", { class: isGain ? "txt-teal" : "txt-red" }, fmtPct(r.changePct)),
    ]));
  });
  table.appendChild(tbody);
  return el("div", { class: "table-wrap" }, [table]);
}

/* ---------------------------------------------------------------------- */

async function drawSectorsTab(panel) {
  panel.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  const sectors = await getLiveSectorPerformance();
  if (!sectors || !sectors.sectors || !sectors.sectors.length) return emptyPanelState(panel, "Not synced yet — the workflow needs to run at least once.");

  panel.innerHTML = "";
  panel.appendChild(el("p", { class: "txt-muted", style: "font-size:11px;" }, `As of ${sectors.asOf} · averaged from real constituent price moves`));
  const maxAbs = Math.max(...sectors.sectors.map((s) => Math.abs(s.relativeStrength)), 1);
  const panelBox = el("div", { class: "panel" }, [el("div", { class: "panel-title" }, "Sector Performance (Today)")]);
  sectors.sectors.forEach((s) => {
    const pct = Math.max(4, (s.relativeStrength / maxAbs) * 50 + 50);
    const color = s.relativeStrength >= 0 ? "var(--accent-teal)" : "var(--accent-red)";
    panelBox.appendChild(el("div", { class: "sector-bar-row" }, [
      el("span", {}, `${s.name} (${s.count})`),
      el("div", { class: "sector-bar-track" }, [el("div", { class: "sector-bar-fill", style: `width:${pct}%; background:${color};` })]),
      el("span", { class: "mono text-right" }, fmtPct(s.relativeStrength)),
    ]));
  });
  panel.appendChild(panelBox);
}

/* ---------------------------------------------------------------------- */

async function drawWinnersTab(panel) {
  panel.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  const data = await getLivePastWinners();
  if (!data || !data.winners || !data.winners.length) return emptyPanelState(panel, "Not synced yet — the workflow needs to run at least once. (Also needs a few months of accumulated history for a meaningful trailing return.)");

  panel.innerHTML = "";
  panel.appendChild(el("p", { class: "txt-muted", style: "font-size:11px;" }, `As of ${data.asOf} · trailing return across the synced history window`));
  const table = el("table");
  table.appendChild(el("thead", {}, el("tr", {}, ["#", "Symbol", "Return"].map((h) => el("th", {}, h)))));
  const tbody = el("tbody");
  data.winners.forEach((w, i) => {
    tbody.appendChild(el("tr", {}, [el("td", {}, String(i + 1)), el("td", {}, el("strong", {}, w.symbol)), el("td", { class: "txt-teal" }, fmtPct(w.returnPct))]));
  });
  table.appendChild(tbody);
  panel.appendChild(el("div", { class: "panel" }, [el("div", { class: "table-wrap" }, [table])]));
}

/* ---------------------------------------------------------------------- */

async function drawRrgTab(panel) {
  panel.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  const data = await fetchLiveJson("rrg.json");
  if (!data || !data.sectors || !Object.keys(data.sectors).length) return emptyPanelState(panel, "Not synced yet — the workflow needs to run at least once.");

  panel.innerHTML = "";
  panel.appendChild(el("p", { class: "txt-muted", style: "font-size:11px;" }, `As of ${data.asOf} · sector indices vs ${data.benchmark}. Our own relative-strength-ratio/momentum implementation — not a claim of parity with the trademarked "RRG®" product.`));

  const canvas = el("canvas", { width: "700", height: "560", style: "max-width:100%; background:var(--bg-void); border-radius:8px;" });
  const legend = el("div", { class: "flex gap-8", style: "flex-wrap:wrap; margin-top:10px;" });
  panel.append(el("div", { class: "panel" }, [canvas, legend]));

  drawRrgQuadrantChart(canvas, data.sectors);
  const colors = ["#2FBF9F", "#E5534B", "#C9A24B", "#4C8DFF", "#9B7EDE", "#7FBF4B", "#C97A3A", "#E5534B", "#4C8DFF", "#2FBF9F", "#C9A24B", "#9B7EDE"];
  Object.keys(data.sectors).forEach((name, i) => {
    legend.appendChild(el("span", { class: "badge", style: `border-color:${colors[i % colors.length]}; color:${colors[i % colors.length]};` }, name));
  });
}

function drawRrgQuadrantChart(canvas, sectorsData) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const allPoints = Object.values(sectorsData).flat();
  const ratios = allPoints.map((p) => p.rsRatio);
  const moms = allPoints.map((p) => p.rsMomentum);
  const pad = 2;
  const minR = Math.min(...ratios, 100) - pad, maxR = Math.max(...ratios, 100) + pad;
  const minM = Math.min(...moms, 100) - pad, maxM = Math.max(...moms, 100) + pad;

  const xOf = (r) => ((r - minR) / (maxR - minR)) * (W - 60) + 40;
  const yOf = (m) => H - (((m - minM) / (maxM - minM)) * (H - 60) + 30);

  // Quadrant backgrounds
  const midX = xOf(100), midY = yOf(100);
  ctx.fillStyle = "rgba(47,191,159,0.08)"; ctx.fillRect(midX, 30, W - 40 - midX, midY - 30);       // leading (top-right)
  ctx.fillStyle = "rgba(201,162,75,0.08)"; ctx.fillRect(midX, midY, W - 40 - midX, H - 30 - midY);  // weakening (bottom-right)
  ctx.fillStyle = "rgba(229,83,75,0.08)"; ctx.fillRect(40, midY, midX - 40, H - 30 - midY);          // lagging (bottom-left)
  ctx.fillStyle = "rgba(76,141,255,0.08)"; ctx.fillRect(40, 30, midX - 40, midY - 30);                // improving (top-left)

  ctx.strokeStyle = "#303A4D"; ctx.beginPath(); ctx.moveTo(40, midY); ctx.lineTo(W - 40, midY); ctx.moveTo(midX, 30); ctx.lineTo(midX, H - 30); ctx.stroke();

  ctx.fillStyle = "#6C7690"; ctx.font = "11px sans-serif";
  ctx.fillText("Improving", 46, 44); ctx.fillText("Leading", W - 100, 44);
  ctx.fillText("Lagging", 46, H - 38); ctx.fillText("Weakening", W - 110, H - 38);

  const colors = ["#2FBF9F", "#E5534B", "#C9A24B", "#4C8DFF", "#9B7EDE", "#7FBF4B", "#C97A3A", "#E5534B", "#4C8DFF", "#2FBF9F", "#C9A24B", "#9B7EDE"];
  Object.entries(sectorsData).forEach(([name, tail], i) => {
    const color = colors[i % colors.length];
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
    tail.forEach((p, idx) => { const x = xOf(p.rsRatio), y = yOf(p.rsMomentum); if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();
    const last = tail[tail.length - 1];
    const x = xOf(last.rsRatio), y = yOf(last.rsMomentum);
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#E7EBF3"; ctx.font = "10px sans-serif"; ctx.fillText(name, x + 7, y - 7);
  });
}

/* ---------------------------------------------------------------------- */

async function drawDealsTab(panel) {
  panel.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  const data = await getLiveBulkBlockDeals();
  if (!data) return emptyPanelState(panel, "Not synced yet — the workflow needs to run at least once.");

  panel.innerHTML = "";
  panel.appendChild(el("p", { class: "txt-muted", style: "font-size:11px;" }, `As of ${data.asOf}`));
  ["bulk_deals", "block_deals", "short_selling"].forEach((key) => {
    const rows = data[key] || [];
    const title = { bulk_deals: "Bulk Deals", block_deals: "Block Deals", short_selling: "Short Selling" }[key];
    const box = el("div", { class: "panel mt-16" }, [el("div", { class: "panel-title" }, [title, el("span", { class: "txt-muted", style: "text-transform:none; letter-spacing:0;" }, `${rows.length} record(s)`)])]);
    if (!rows.length) {
      box.appendChild(el("p", { class: "txt-muted" }, "None reported."));
    } else {
      const table = el("table");
      const cols = Object.keys(rows[0]).slice(0, 6);
      table.appendChild(el("thead", {}, el("tr", {}, cols.map((c) => el("th", {}, c)))));
      const tbody = el("tbody");
      rows.slice(0, 20).forEach((r) => tbody.appendChild(el("tr", {}, cols.map((c) => el("td", {}, String(r[c] ?? "—"))))));
      table.appendChild(tbody);
      box.appendChild(el("div", { class: "table-wrap" }, [table]));
    }
    panel.appendChild(box);
  });
}

/* ---------------------------------------------------------------------- */

async function drawCircuitTab(panel) {
  panel.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  const data = await getLiveCircuitList();
  if (!data || !data.stocks || !data.stocks.length) return emptyPanelState(panel, "Not synced yet, or no circuit-band revisions on the last synced day.");

  panel.innerHTML = "";
  panel.appendChild(el("p", { class: "txt-muted", style: "font-size:11px;" }, `As of ${data.asOf}`));
  const table = el("table");
  const cols = Object.keys(data.stocks[0]).slice(0, 7);
  table.appendChild(el("thead", {}, el("tr", {}, cols.map((c) => el("th", {}, c)))));
  const tbody = el("tbody");
  data.stocks.slice(0, 100).forEach((r) => tbody.appendChild(el("tr", {}, cols.map((c) => el("td", {}, String(r[c] ?? "—"))))));
  table.appendChild(tbody);
  panel.appendChild(el("div", { class: "panel" }, [el("div", { class: "table-wrap" }, [table])]));
}

/* ---------------------------------------------------------------------- */

async function drawCalendarTab(panel) {
  panel.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  const data = await getLiveResultsCalendar();
  if (!data || !data.meetings || !data.meetings.length) return emptyPanelState(panel, "Not synced yet, or no board meetings announced in the next 3 weeks.");

  panel.innerHTML = "";
  panel.appendChild(el("p", { class: "txt-muted", style: "font-size:11px;" }, `As of ${data.asOf} · next 3 weeks`));
  const table = el("table");
  const cols = Object.keys(data.meetings[0]).slice(0, 5);
  table.appendChild(el("thead", {}, el("tr", {}, cols.map((c) => el("th", {}, c)))));
  const tbody = el("tbody");
  data.meetings.slice(0, 100).forEach((r) => tbody.appendChild(el("tr", {}, cols.map((c) => el("td", {}, String(r[c] ?? "—"))))));
  table.appendChild(tbody);
  panel.appendChild(el("div", { class: "panel" }, [el("div", { class: "table-wrap" }, [table])]));
}
