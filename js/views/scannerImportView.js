
function renderScannerImport(container) {
  container.innerHTML = "";

  const universeScanPanel = el("div", { class: "panel", id: "universe-scan-panel" }, [
    el("div", { class: "panel-title" }, ["Run Scanners Against Synced Data", liveBadge(isLiveDataConfigured())]),
    el("p", { class: "txt-muted" }, "Scans the entire synced NSE universe automatically — no manual Chartink export needed. Requires Live Data Sync to be configured (Settings)."),
    el("div", { id: "universe-scan-body" }),
  ]);

  const dropzone = el("div", { class: "dropzone", id: "dropzone", tabindex: "0", role: "button", "aria-label": "Upload scanner CSV" }, [
    el("div", { class: "dropzone-icon" }, "⇪"),
    el("p", {}, [el("strong", {}, "Drop a Chartink CSV here"), " or click to browse"]),
    el("p", { class: "txt-muted", style: "font-size:11px;" }, "Accepts one or more .csv exports. Each file is merged into your candidate pool and de-duplicated by symbol."),
    el("input", { type: "file", id: "file-input", accept: ".csv,text/csv", multiple: "true" }),
  ]);

  const pasteArea = el("div", { class: "panel paste-area" }, [
    el("div", { class: "panel-title" }, ["Or paste CSV text", el("span", { class: "txt-muted", style: "text-transform:none; letter-spacing:0;" }, "manual fallback")]),
    el("textarea", { id: "paste-textarea", placeholder: "symbol,close,volume,% chg,sector...\nTATAELXSI,7145,412000,2.1,IT" }),
    el("div", { class: "flex gap-8 mt-8" }, [
      el("button", { class: "btn btn-primary", id: "parse-paste-btn" }, "Merge Pasted Data"),
      el("button", { class: "btn", id: "load-sample-btn" }, "Load Sample Data"),
      el("button", { class: "btn btn-danger", id: "clear-candidates-btn" }, "Clear All Candidates"),
    ]),
  ]);

  const summaryPanel = el("div", { class: "panel", id: "import-summary-panel" }, [
    el("div", { class: "panel-title" }, "Current Candidate Pool"),
    el("div", { id: "import-summary-body" }),
  ]);

  const sourcesPanel = el("div", { class: "panel mt-16", id: "import-sources-panel" }, [
    el("div", { class: "panel-title" }, ["Imported Sources", el("span", { class: "txt-muted", style: "text-transform:none; letter-spacing:0;" }, "remove one scanner/CSV without clearing everything")]),
    el("div", { id: "import-sources-body" }),
  ]);

  container.append(
    el("div", { class: "view-header" }, [
      el("div", {}, [el("h2", { class: "view-title" }, "Scanner Import"), el("div", { class: "view-subtitle" }, "Scan the whole synced market automatically, or bring in Chartink scanner exports manually — both merge into the same candidate pool.")]),
    ]),
    universeScanPanel,
    dropzone,
    pasteArea,
    summaryPanel,
    sourcesPanel,
  );

  refreshUniverseScanPanel();
  refreshSummary();
  refreshSources();
  wireEvents();
}

function refreshUniverseScanPanel() {
  const body = $("#universe-scan-body");
  if (!body) return;
  body.innerHTML = "";

  if (!isLiveDataConfigured()) {
    body.appendChild(el("p", { class: "txt-muted" }, ["Not set up yet — see ", el("strong", {}, "Settings → Live Market Data Sync"), " (one-time GitHub setup, free)."]));
    return;
  }

  const scannerIds = getRunnableScannerIds();
  const checkboxes = {};
  const grid = el("div", { class: "grid grid-3", style: "margin-bottom:10px;" });
  scannerIds.forEach((id) => {
    const def = getScannerById(id);
    const cb = el("input", { type: "checkbox", checked: "true" });
    checkboxes[id] = cb;
    grid.appendChild(el("label", { class: "flex items-center gap-8", style: "margin:0; font-weight:normal;" }, [cb, def ? def.name : id]));
  });
  body.appendChild(grid);

  const resultBox = el("div", { class: "txt-muted", style: "font-size:12px;" });
  const runBtn = el("button", { class: "btn btn-primary" }, "Scan Entire Synced Universe");
  runBtn.addEventListener("click", async () => {
    runBtn.disabled = true;
    runBtn.textContent = "Scanning…";
    const selected = Object.entries(checkboxes).filter(([, cb]) => cb.checked).map(([id]) => id);
    const result = await runUniverseScanners(selected);
    runBtn.disabled = false;
    runBtn.textContent = "Scan Entire Synced Universe";

    if (!result.ok) {
      resultBox.textContent = result.message;
      toast(result.message, "error");
      return;
    }
    const breakdown = Object.entries(result.byScanner).map(([id, count]) => `${getScannerById(id)?.name || id}: ${count}`).join(" · ");
    resultBox.textContent = `Scanned ${result.universeSize.toLocaleString("en-IN")} stocks (as of ${result.asOf}). ${result.totalMatched} matched. ${breakdown}`;
    toast(`Universe scan complete — ${result.totalMatched} candidates added/updated.`, "success");
    refreshSummary();
    refreshSources();
  });
  body.append(runBtn, resultBox);
}


function wireEvents() {
  const dropzone = $("#dropzone");
  const fileInput = $("#file-input");

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") fileInput.click(); });
  fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

  ["dragenter", "dragover"].forEach((evt) => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("is-dragover"); }));
  ["dragleave", "drop"].forEach((evt) => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("is-dragover"); }));
  dropzone.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));

  $("#parse-paste-btn").addEventListener("click", () => {
    const text = $("#paste-textarea").value.trim();
    if (!text) { toast("Paste some CSV text first.", "error"); return; }
    const { records } = parseCSV(text);
    if (!records.length) { toast("Couldn't find any rows in that text.", "error"); return; }
    const result = mergeCandidates(records, "Pasted CSV");
    reportMergeResult(result);
  });

  $("#load-sample-btn").addEventListener("click", async () => {
    const sample = await getSampleCandidates();
    const result = mergeCandidates(sample, "Sample Data");
    reportMergeResult(result);
  });

  $("#clear-candidates-btn").addEventListener("click", () => {
    if (confirm("Remove every candidate from the pool? This does not affect your journal.")) {
      clearCandidates();
      refreshSummary();
      refreshSources();
      toast("Candidate pool cleared.", "success");
    }
  });
}

function handleFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  let remaining = files.length;
  let lastResult = null;

  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const { records } = parseCSV(reader.result);
      if (records.length) lastResult = mergeCandidates(records, file.name.replace(/\.csv$/i, ""));
      remaining -= 1;
      if (remaining === 0 && lastResult) reportMergeResult(lastResult);
    };
    reader.onerror = () => {
      toast(`Couldn't read ${file.name}.`, "error");
      remaining -= 1;
    };
    reader.readAsText(file);
  });
}

function reportMergeResult(result) {
  toast(`Merged. Pool now has ${result.total} candidates${result.incompleteCount ? ` (${result.incompleteCount} missing fields)` : ""}.`, result.incompleteCount ? "error" : "success");
  refreshSummary();
  refreshSources();
}

function refreshSources() {
  const body = $("#import-sources-body");
  if (!body) return;
  const batches = getImportBatches();
  body.innerHTML = "";
  if (!batches.length) {
    body.appendChild(el("p", { class: "txt-muted" }, "No sources imported yet."));
    return;
  }
  batches
    .slice()
    .reverse()
    .forEach((batch) => {
      const row = el("div", { class: "plan-row" }, [
        el("span", { class: "label" }, [
          el("strong", { style: "color:var(--text-primary);" }, batch.label),
          el("span", { class: "txt-muted", style: "font-size:11px;" }, ` — ${batch.symbolCount} symbol(s) · ${new Date(batch.timestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`),
        ]),
        el("button", {
          class: "btn btn-sm btn-danger",
          onclick: () => {
            if (confirm(`Remove "${batch.label}" from the candidate pool? Stocks only flagged by this source will be removed; stocks other scanners also flagged will stay, minus this source's contribution.`)) {
              removeImportBatch(batch.id);
              refreshSummary();
              refreshSources();
              toast(`Removed source "${batch.label}".`, "success");
            }
          },
        }, "Remove source"),
      ]);
      body.appendChild(row);
    });
}

function refreshSummary() {
  const body = $("#import-summary-body");
  if (!body) return;
  const candidates = getCandidates();
  if (!candidates.length) {
    body.innerHTML = "";
    body.appendChild(el("div", { class: "empty-state" }, [
      el("div", { class: "empty-state-icon" }, "◇"),
      el("p", {}, "No candidates imported yet."),
      el("p", { class: "txt-muted" }, "Run a scanner from the Scanner Library, export the CSV, then drop it above."),
    ]));
    return;
  }
  const sources = new Set();
  candidates.forEach((c) => (c.scannerSource || "").split(",").forEach((s) => s.trim() && sources.add(s.trim())));
  body.innerHTML = "";
  body.appendChild(el("div", { class: "import-summary" }, [
    el("div", { class: "import-stat" }, [el("b", {}, String(candidates.length)), "Total candidates"]),
    el("div", { class: "import-stat" }, [el("b", {}, String(sources.size)), "Scanner sources merged"]),
    el("div", { class: "import-stat" }, [el("b", {}, new Set(candidates.map((c) => c.sector).filter(Boolean)).size.toString()), "Sectors represented"]),
  ]));
}
