
const VIEWS = {
  dashboard: { title: "Dashboard", icon: "◈", render: renderDashboard },
  import: { title: "Scanner Import", icon: "⇪", render: renderScannerImport },
  library: { title: "Scanner Library", icon: "☰", render: renderScannerLibrary },
  candidates: { title: "Ranked Candidates", icon: "▤", render: (c) => renderCandidates(c, openWorkspace) },
  intel: { title: "Market Intelligence", icon: "◒", render: renderMarketIntel },
  workspace: { title: "Trade Workspace", icon: "◎", render: (c) => renderTradeWorkspace(c, activeCandidateId, () => navigate("journal")) },
  journal: { title: "Journal", icon: "▥", render: renderJournal },
  analytics: { title: "Analytics", icon: "▦", render: renderAnalytics },
  settings: { title: "Settings", icon: "⚙", render: renderSettings },
};

let activeView = "dashboard";
let activeCandidateId = null;

function navigate(viewKey) {
  activeView = viewKey;
  $$(".nav-item").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.nav === viewKey));
  $$(".view").forEach((v) => v.classList.remove("is-active"));
  const container = $(`#view-${viewKey}`);
  container.classList.add("is-active");
  VIEWS[viewKey].render(container);
}

function openWorkspace(candidateId) {
  activeCandidateId = candidateId;
  navigate("workspace");
}

function buildSidebar() {
  const nav = $("#sidebar-nav");
  const groups = [
    { label: "Overview", items: ["dashboard"] },
    { label: "Research", items: ["import", "library", "candidates", "intel"] },
    { label: "Execute", items: ["workspace"] },
    { label: "Track", items: ["journal", "analytics"] },
    { label: "System", items: ["settings"] },
  ];
  groups.forEach((group) => {
    nav.appendChild(el("div", { class: "nav-group-label" }, group.label));
    group.items.forEach((key) => {
      const item = VIEWS[key];
      const btn = el("button", { class: "nav-item", "data-nav": key, onclick: () => navigate(key) }, [
        el("span", { class: "nav-icon" }, item.icon),
        el("span", {}, item.title),
      ]);
      nav.appendChild(btn);
    });
  });
}

function buildViewContainers() {
  const main = $("#main-content");
  Object.keys(VIEWS).forEach((key) => {
    main.appendChild(el("section", { class: "view", id: `view-${key}` }));
  });
}

async function buildRibbon() {
  const ribbon = $("#ribbon");
  // Genuinely live index prices — free TradingView widget, no API key needed.
  renderTickerTape(ribbon, DEFAULT_INDEX_TICKER_SYMBOLS);

  // Market-context bias for the scoring engine still uses the sample data
  // service (see docs/ARCHITECTURE.md) since a free live breadth/VIX feed
  // isn't available without a paid vendor — this is separate from the
  // ribbon above, which now shows real prices.
  const indices = await getIndexSnapshot();
  await refreshMarketBiasFromSnapshot(indices);
}

function updateCandidateBadge() {
  const badge = document.querySelector('.nav-item[data-nav="candidates"] .nav-badge') || (() => {
    const b = el("span", { class: "nav-badge" });
    document.querySelector('.nav-item[data-nav="candidates"]').appendChild(b);
    return b;
  })();
  badge.textContent = String(getCandidates().length);
}

function init() {
  buildSidebar();
  buildViewContainers();
  buildRibbon();
  updateCandidateBadge();
  navigate("dashboard");
  setInterval(updateCandidateBadge, 4000);
}

document.addEventListener("DOMContentLoaded", init);
