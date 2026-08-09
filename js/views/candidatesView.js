/**
 * candidatesView.js
 * Curated Top 10 Long / Top 10 Short lists (auto-backfilling as candidates
 * are excluded or removed) plus a full sortable list for auditing,
 * restoring excluded candidates, or managing every import at once.
 */

let currentSort = { key: "composite", dir: "desc" };
let activeTab = "top-long";
let showRejectedInFullList = false;
let refreshAllPanels = () => {};

function renderCandidates(container, onOpenCandidate) {
  container.innerHTML = "";
  container.appendChild(
    el("div", { class: "view-header" }, [
      el("div", {}, [
        el("h2", { class: "view-title" }, "Ranked Candidates"),
        el("div", { class: "view-subtitle" }, "Top 10 Long and Top 10 Short are curated automatically from your techno-funda score — exclude one and the next-best candidate takes its place."),
      ]),
    ])
  );

  const tabs = el("div", { class: "tabs" }, [
    tabButton("top-long", "Top 10 Long"),
    tabButton("top-short", "Top 10 Short"),
    tabButton("full", "Full List"),
  ]);
  container.appendChild(tabs);

  const panelLong = el("div", { class: `tab-panel${activeTab === "top-long" ? " is-active" : ""}`, id: "panel-top-long" });
  const panelShort = el("div", { class: `tab-panel${activeTab === "top-short" ? " is-active" : ""}`, id: "panel-top-short" });
  const panelFull = el("div", { class: `tab-panel${activeTab === "full" ? " is-active" : ""}`, id: "panel-full" });
  container.append(panelLong, panelShort, panelFull);

  function switchTab(tab) {
    activeTab = tab;
    $$(".tab-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
    $$(".tab-panel").forEach((p) => p.classList.remove("is-active"));
    ({ "top-long": panelLong, "top-short": panelShort, full: panelFull })[tab].classList.add("is-active");
  }
  $$(".tab-btn", tabs).forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

  // Any mutation (exclude / restore / remove) should refresh ALL THREE panels —
  // not just the one the user clicked in — since excluding a stock in Full List
  // affects the Top 10 tabs and vice versa.
  refreshAllPanels = () => {
    drawTopTen(panelLong, "long", onOpenCandidate);
    drawTopTen(panelShort, "short", onOpenCandidate);
    drawFullList(panelFull, onOpenCandidate);
  };

  refreshAllPanels();
}

function tabButton(tab, label) {
  return el("button", { class: `tab-btn${activeTab === tab ? " is-active" : ""}`, "data-tab": tab }, label);
}

/* ---------------------------------------------------------------------- */
/* Top 10 (curated, auto-backfilling)                                      */
/* ---------------------------------------------------------------------- */

function drawTopTen(panel, bias, onOpenCandidate) {
  const top = getTopCandidates(bias, 10);
  panel.innerHTML = "";

  if (!top.length) {
    panel.appendChild(el("div", { class: "empty-state" }, [
      el("div", { class: "empty-state-icon" }, "◇"),
      el("p", {}, `No ${bias} candidates yet.`),
      el("p", { class: "txt-muted" }, "Import scanner results in Scanner Import, or load the sample data to try this out."),
    ]));
    return;
  }

  const table = el("table");
  table.appendChild(el("thead", {}, el("tr", {}, ["Rank", "Score", "Symbol", "Sector", "LTP", "Chg %", "Source", ""].map((h) => el("th", {}, h)))));
  const tbody = el("tbody");
  top.forEach((c, idx) => {
    const { label, cssVar } = scoreLabel(c.composite);
    const lowData = (c.completeness ?? 1) < 0.6;
    tbody.appendChild(
      el("tr", { class: "candidate-row", onclick: () => onOpenCandidate(c.id) }, [
        el("td", { class: "mono txt-muted" }, `#${idx + 1}`),
        el("td", {}, [
          el("div", { class: "score-dial", style: `--pct:${c.composite}; --dial-color:var(${cssVar});` }, [
            el("div", { class: "score-dial-inner" }, String(c.composite)),
          ]),
        ]),
        el("td", {}, [
          el("strong", {}, c.symbol),
          el("div", { class: "txt-muted", style: "font-size:10px;" }, label),
          lowData ? el("div", { class: "txt-muted", style: "font-size:9px;", "data-tip": "Scanner export was missing SMA/RSI/52-week fields — some categories used a neutral fallback." }, "◐ limited data") : null,
        ]),
        el("td", {}, c.sector || "—"),
        el("td", {}, fmtINR(c.ltp)),
        el("td", { class: c.changePct >= 0 ? "txt-teal" : "txt-red" }, fmtPct(c.changePct)),
        el("td", { class: "txt-muted", style: "font-family:var(--font-body); font-size:11px; white-space:normal;" }, c.scannerSource || "—"),
        el("td", {}, [
          el("button", {
            class: "btn btn-sm",
            "data-tip": "Exclude — drops out of ranking, next-best candidate takes this slot. Restore later from the Full List tab.",
            onclick: (e) => { e.stopPropagation(); rejectCandidate(c.id); refreshAllPanels(); toast(`${c.symbol} excluded — next-best candidate promoted.`, "info"); },
          }, "Exclude"),
        ]),
      ])
    );
  });
  table.appendChild(tbody);
  panel.appendChild(el("div", { class: "table-wrap" }, [table]));
}

/* ---------------------------------------------------------------------- */
/* Full list (sortable, can include excluded candidates for review/restore) */
/* ---------------------------------------------------------------------- */

function drawFullList(panel, onOpenCandidate) {
  panel.innerHTML = "";

  const toolbar = el("div", { class: "flex gap-8 items-center mt-8", style: "margin-bottom:12px;" }, [
    el("label", { class: "flex items-center gap-8", style: "margin:0;" }, [
      (() => {
        const cb = el("input", { type: "checkbox" });
        cb.checked = showRejectedInFullList;
        cb.addEventListener("change", (e) => { showRejectedInFullList = e.target.checked; drawFullList(panel, onOpenCandidate); });
        return cb;
      })(),
      "Show excluded candidates too",
    ]),
  ]);
  panel.appendChild(toolbar);

  const tableWrap = el("div", { class: "table-wrap" });
  panel.appendChild(tableWrap);
  drawFullTable(tableWrap, onOpenCandidate);
}

function drawFullTable(tableWrap, onOpenCandidate) {
  let ranked = getRankedCandidates(undefined, { includeRejected: showRejectedInFullList });
  if (!ranked.length) {
    tableWrap.innerHTML = "";
    tableWrap.appendChild(el("div", { class: "empty-state" }, [
      el("div", { class: "empty-state-icon" }, "◇"),
      el("p", {}, "No candidates to rank yet."),
      el("p", { class: "txt-muted" }, "Head to Scanner Import to load a CSV, or Load Sample Data to explore the app."),
    ]));
    return;
  }

  ranked.sort((a, b) => {
    const av = a[currentSort.key], bv = b[currentSort.key];
    const cmp = typeof av === "string" ? av.localeCompare(bv) : (av ?? 0) - (bv ?? 0);
    return currentSort.dir === "asc" ? cmp : -cmp;
  });

  const columns = [
    { key: "composite", label: "Score" },
    { key: "symbol", label: "Symbol" },
    { key: "sector", label: "Sector" },
    { key: "ltp", label: "LTP" },
    { key: "changePct", label: "Chg %" },
    { key: "bias", label: "Bias" },
    { key: "scannerSource", label: "Source" },
    { key: null, label: "" },
  ];

  const table = el("table");
  const thead = el("thead", {}, el("tr", {}, columns.map((c) =>
    c.key
      ? el("th", { onclick: () => { toggleSort(c.key); drawFullTable(tableWrap, onOpenCandidate); } },
          c.label + (currentSort.key === c.key ? (currentSort.dir === "asc" ? " ▲" : " ▼") : "")
        )
      : el("th", {}, "")
  )));
  table.appendChild(thead);

  const tbody = el("tbody");
  ranked.forEach((c) => {
    const { label, cssVar } = scoreLabel(c.composite);
    const lowData = (c.completeness ?? 1) < 0.6;
    const row = el("tr", { class: `candidate-row${c.rejected ? " txt-muted" : ""}`, style: c.rejected ? "opacity:0.55;" : "", onclick: () => onOpenCandidate(c.id) }, [
      el("td", {}, [
        el("div", { class: "score-dial", style: `--pct:${c.composite}; --dial-color:var(${cssVar});` }, [
          el("div", { class: "score-dial-inner" }, String(c.composite)),
        ]),
      ]),
      el("td", {}, [
        el("strong", {}, c.symbol),
        el("div", { class: "txt-muted", style: "font-size:10px;" }, c.rejected ? "Excluded" : label),
        lowData ? el("div", { class: "txt-muted", style: "font-size:9px;" }, "◐ limited data") : null,
      ]),
      el("td", {}, c.sector || "—"),
      el("td", {}, fmtINR(c.ltp)),
      el("td", { class: c.changePct >= 0 ? "txt-teal" : "txt-red" }, fmtPct(c.changePct)),
      el("td", {}, el("span", { class: `badge badge-${c.bias === "long" ? "long" : "short"}` }, c.bias === "long" ? "Long" : "Short")),
      el("td", { class: "txt-muted", style: "font-family:var(--font-body); font-size:11px; white-space:normal;" }, c.scannerSource || "—"),
      el("td", {}, [
        c.rejected
          ? el("button", {
              class: "btn btn-sm",
              onclick: (e) => { e.stopPropagation(); restoreCandidate(c.id); refreshAllPanels(); toast(`${c.symbol} restored to ranking.`, "success"); },
            }, "Restore")
          : el("button", {
              class: "btn btn-sm btn-danger",
              "data-tip": "Permanently remove just this candidate",
              onclick: (e) => {
                e.stopPropagation();
                if (confirm(`Remove ${c.symbol} from the candidate pool?`)) {
                  removeCandidate(c.id);
                  refreshAllPanels();
                }
              },
            }, "✕"),
      ]),
    ]);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  tableWrap.innerHTML = "";
  tableWrap.appendChild(table);
}

function toggleSort(key) {
  if (currentSort.key === key) currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
  else currentSort = { key, dir: "desc" };
}
