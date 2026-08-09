
const WEIGHT_LABELS = {
  trend: "Trend (Stage Analysis)",
  relativeStrength: "Relative Strength",
  volume: "Volume (Accumulation/Distribution)",
  liquidity: "Liquidity",
  proximityToExtreme: "Proximity to High/Low",
  momentum: "Momentum (RSI)",
  baseQuality: "Base Quality (VCP)",
  breakoutQuality: "Breakout/Breakdown Quality",
  riskReward: "Risk/Reward",
  fundamentals: "Fundamentals (EPS/Sales/ROE)",
  marketContext: "Market Context",
};

function renderSettings(container) {
  container.innerHTML = "";
  container.appendChild(
    el("div", { class: "view-header" }, [
      el("div", {}, [el("h2", { class: "view-title" }, "Settings"), el("div", { class: "view-subtitle" }, "Live data sync, risk manager defaults, and scoring weights — tune these to match your own trading rules.")]),
    ])
  );

  /* ---- Live data sync ---- */
  const liveDataPanel = el("div", { class: "panel" });
  liveDataPanel.appendChild(el("div", { class: "panel-title" }, ["Live Market Data Sync", liveBadge(isLiveDataConfigured())]));
  liveDataPanel.appendChild(el("p", { class: "txt-muted" }, "Point this at your deployed GitHub Pages URL to replace demo data with real, daily-synced NSE data across the whole app — Market Breadth, Sector Analytics, Top Gainers, Past Winners, RRG, Bulk/Block Deals, Circuit List, Results Calendar, and the Universe Scanner. See docs/LIVE_DATA_SETUP.md for the one-time setup."));
  const urlInput = el("input", { type: "text", placeholder: "https://yourusername.github.io/your-repo-name", value: getLiveDataBaseUrl() });
  const statusLine = el("p", { class: "txt-muted mt-8", style: "font-size:12px;" }, "");
  liveDataPanel.append(
    el("div", { class: "field" }, [el("label", {}, "GitHub Pages URL"), urlInput]),
    el("div", { class: "flex gap-8" }, [
      el("button", { class: "btn btn-primary", onclick: () => { saveLiveDataBaseUrl(urlInput.value); toast("Live data URL saved.", "success"); renderSettings(container); } }, "Save"),
      el("button", { class: "btn", onclick: async () => {
        statusLine.textContent = "Testing…";
        const result = await testLiveDataConnection();
        statusLine.textContent = result.message;
        statusLine.className = `mt-8 ${result.ok ? "txt-teal" : "txt-red"}`;
        toast(result.message, result.ok ? "success" : "error");
      } }, "Test Connection"),
    ]),
    statusLine,
  );
  container.appendChild(liveDataPanel);

  /* ---- Risk manager ---- */
  const risk = getRiskSettings();
  const riskPanel = el("div", { class: "panel mt-16" });
  riskPanel.appendChild(el("div", { class: "panel-title" }, "Risk Manager Defaults"));
  const capitalInput = el("input", { type: "number", value: risk.capital });
  const maxRiskInput = el("input", { type: "number", step: "0.1", value: risk.maxRiskPerTradePct });
  const maxExposureInput = el("input", { type: "number", step: "1", value: risk.maxPortfolioExposurePct });
  riskPanel.append(
    el("div", { class: "grid grid-3" }, [
      el("div", { class: "field" }, [el("label", {}, "Total trading capital (₹)"), capitalInput]),
      el("div", { class: "field" }, [el("label", {}, "Max risk per trade (%)"), maxRiskInput]),
      el("div", { class: "field" }, [el("label", {}, "Max portfolio exposure (%)"), maxExposureInput]),
    ]),
    el("div", { class: "flex gap-8 mt-8" }, [
      el("button", { class: "btn btn-primary", onclick: () => {
        saveRiskSettings({ capital: parseFloat(capitalInput.value) || 0, maxRiskPerTradePct: parseFloat(maxRiskInput.value) || 0, maxPortfolioExposurePct: parseFloat(maxExposureInput.value) || 0 });
        toast("Risk settings saved.", "success");
      } }, "Save Risk Settings"),
      el("button", { class: "btn", onclick: () => {
        saveRiskSettings({ ...DEFAULT_RISK_SETTINGS });
        toast("Reset to defaults — reload Settings to see them.", "info");
        renderSettings(container);
      } }, "Reset to Defaults"),
    ])
  );
  container.appendChild(riskPanel);

  /* ---- Scoring weights ---- */
  const weights = getWeights();
  const weightPanel = el("div", { class: "panel mt-16" });
  weightPanel.appendChild(el("div", { class: "panel-title" }, ["Scoring Weights", el("span", { class: "txt-muted", style: "text-transform:none; letter-spacing:0;" }, `Sum: ${weightSum(weights)}`)]));
  const workingWeights = { ...weights };
  const sumLabel = el("span", {}, "");
  Object.keys(DEFAULT_WEIGHTS).forEach((key) => {
    const row = el("div", { class: "weight-row" });
    const valueLabel = el("span", { class: "mono" }, String(workingWeights[key] ?? 0));
    const slider = el("input", { type: "range", min: "0", max: "30", value: workingWeights[key] ?? 0 });
    slider.addEventListener("input", (e) => {
      workingWeights[key] = parseInt(e.target.value, 10);
      valueLabel.textContent = e.target.value;
      sumLabel.textContent = `Sum: ${weightSum(workingWeights)}`;
    });
    row.append(el("label", { style: "margin:0;" }, WEIGHT_LABELS[key]), slider, valueLabel);
    weightPanel.appendChild(row);
  });
  weightPanel.appendChild(el("p", { class: "txt-muted", style: "font-size:11px;" }, ["Weights are used proportionally — they don't need to sum to 100. ", sumLabel]));
  weightPanel.appendChild(
    el("div", { class: "flex gap-8 mt-8" }, [
      el("button", { class: "btn btn-primary", onclick: () => { saveWeights(workingWeights); toast("Scoring weights saved. Re-open Ranked Candidates to see updated scores.", "success"); } }, "Save Weights"),
      el("button", { class: "btn", onclick: () => { saveWeights({ ...DEFAULT_WEIGHTS }); renderSettings(container); } }, "Reset to Defaults"),
    ])
  );
  container.appendChild(weightPanel);

  /* ---- Data management ---- */
  const dataPanel = el("div", { class: "panel mt-16" }, [
    el("div", { class: "panel-title" }, "Data"),
    el("p", { class: "txt-muted" }, "All data (candidates, journal, settings) is stored locally in this browser. Export a backup before clearing browser storage."),
    el("div", { class: "flex gap-8" }, [
      el("button", { class: "btn", onclick: exportBackup }, "Export Backup (JSON)"),
      el("button", { class: "btn btn-danger", onclick: () => {
        if (confirm("This clears ALL app data (candidates, journal, settings) from this browser. This cannot be undone. Continue?")) {
          localStorage.clear();
          toast("All data cleared.", "success");
          location.reload();
        }
      } }, "Clear All App Data"),
    ]),
  ]);
  container.appendChild(dataPanel);
}

function exportBackup() {
  const data = Store.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `swing-terminal-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
