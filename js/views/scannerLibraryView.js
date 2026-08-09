
function renderScannerLibrary(container) {
  container.innerHTML = "";
  container.appendChild(
    el("div", { class: "view-header" }, [
      el("div", {}, [
        el("h2", { class: "view-title" }, "Scanner Library"),
        el("div", { class: "view-subtitle" }, "Run these in Chartink, export the CSV, then bring the file into Scanner Import."),
      ]),
      el("a", { href: "https://chartink.com/screener/new", target: "_blank", rel: "noopener", class: "btn btn-sm" }, "Open Chartink ↗"),
    ])
  );

  const grid = el("div", { class: "grid grid-2" });
  SCANNER_LIBRARY.forEach((s) => {
    grid.appendChild(
      el("div", { class: "scanner-card" }, [
        el("div", { class: "scanner-card-title" }, [s.name, el("span", { class: "badge" }, s.category)]),
        el("p", { class: "scanner-card-desc" }, s.description),
        el("textarea", { readonly: "true", style: "min-height:96px; font-family:var(--font-mono); font-size:11px;" }, s.clause),
        el("div", { class: "flex gap-8" }, [
          el("button", { class: "btn btn-sm", onclick: () => copyClause(s.clause) }, "Copy Clause"),
        ]),
      ])
    );
  });
  container.appendChild(grid);

  container.appendChild(
    el("div", { class: "panel mt-16" }, [
      el("div", { class: "panel-title" }, "Workflow reminder"),
      el("p", { class: "txt-muted" }, "1) Copy a clause → 2) paste into chartink.com/screener/new and run it → 3) click the export/copy icon on the results table → 4) bring the CSV into the Scanner Import tab. Repeat for as many setups as you want, then let the app merge and rank everything for you."),
    ])
  );
}

function copyClause(text) {
  navigator.clipboard?.writeText(text).then(
    () => toast("Scanner clause copied.", "success"),
    () => toast("Couldn't copy — select and copy manually.", "error")
  );
}
