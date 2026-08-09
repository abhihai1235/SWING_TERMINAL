
function renderJournal(container) {
  container.innerHTML = "";
  container.appendChild(
    el("div", { class: "view-header" }, [
      el("div", {}, [
        el("h2", { class: "view-title" }, "Trading Journal"),
        el("div", { class: "view-subtitle" }, "Every accepted setup lands here. Update status as the trade progresses, and record what you learned."),
      ]),
    ])
  );

  const list = el("div", { id: "journal-list" });
  container.appendChild(list);
  drawJournalList(list);
}

function drawJournalList(list) {
  const entries = getJournalEntries();
  list.innerHTML = "";
  if (!entries.length) {
    list.appendChild(el("div", { class: "empty-state" }, [
      el("div", { class: "empty-state-icon" }, "◇"),
      el("p", {}, "Your journal is empty."),
      el("p", { class: "txt-muted" }, "Accept a setup from the Trade Workspace to start building your track record."),
    ]));
    return;
  }

  entries.forEach((entry) => {
    const pnl = computePnl(entry);
    const pnlPct = computePnlPct(entry);
    const card = el("div", { class: "journal-entry" });

    card.appendChild(el("div", { class: "journal-entry-header" }, [
      el("div", {}, [
        el("strong", {}, entry.symbol), " ",
        el("span", { class: `badge badge-${entry.direction === "long" ? "long" : "short"}` }, entry.direction),
        " ", el("span", { class: "txt-muted" }, entry.setupType || "Unclassified"),
      ]),
      el("div", { class: "flex gap-8 items-center" }, [
        pnl !== null ? el("span", { class: `journal-pnl ${pnl >= 0 ? "pos" : "neg"} mono` }, `${fmtINR(pnl, 0)} (${pnlPct}%)`) : null,
        statusSelect(entry, list),
        el("button", { class: "btn btn-sm btn-danger", onclick: () => { if (confirm("Delete this journal entry?")) { deleteJournalEntry(entry.id); drawJournalList(list); } } }, "Delete"),
      ]),
    ]));

    const grid = el("div", { class: "grid grid-4 mt-8" }, [
      readonlyField("Entry", fmtINR(entry.entry)),
      readonlyField("Stop-loss", fmtINR(entry.stopLoss)),
      readonlyField("Target", fmtINR(entry.target)),
      readonlyField("Quantity", entry.quantity ?? "—"),
    ]);
    card.appendChild(grid);

    if (entry.status !== "planned") {
      const exitGrid = el("div", { class: "grid grid-2 mt-8" }, [
        fieldEditor("Exit price", entry.exitPrice ?? "", "number", (v) => { updateJournalEntry(entry.id, { exitPrice: v === "" ? null : parseFloat(v) }); drawJournalList(list); }),
        fieldEditor("Exit date", entry.exitDate || todayISO(), "date", (v) => { updateJournalEntry(entry.id, { exitDate: v }); drawJournalList(list); }),
      ]);
      card.appendChild(exitGrid);
    }

    card.appendChild(fieldEditor("Notes", entry.notes || "", "textarea", (v) => updateJournalEntry(entry.id, { notes: v })));
    const mistakesLessons = el("div", { class: "grid grid-2" }, [
      fieldEditor("Mistakes", entry.mistakes || "", "textarea", (v) => updateJournalEntry(entry.id, { mistakes: v })),
      fieldEditor("Lessons", entry.lessons || "", "textarea", (v) => updateJournalEntry(entry.id, { lessons: v })),
    ]);
    card.appendChild(mistakesLessons);

    list.appendChild(card);
  });
}

function statusSelect(entry, list) {
  const select = el("select", { style: "width:auto;" }, [
    el("option", { value: "planned", selected: entry.status === "planned" ? "true" : null }, "Planned"),
    el("option", { value: "open", selected: entry.status === "open" ? "true" : null }, "Open"),
    el("option", { value: "closed", selected: entry.status === "closed" ? "true" : null }, "Closed"),
  ]);
  select.addEventListener("change", (e) => { updateJournalEntry(entry.id, { status: e.target.value }); drawJournalList(list); });
  return select;
}

function readonlyField(label, value) {
  return el("div", {}, [el("label", {}, label), el("div", { class: "mono" }, String(value))]);
}

function fieldEditor(label, value, type, onChange) {
  const wrap = el("div", { class: "field" }, [el("label", {}, label)]);
  const input = type === "textarea" ? el("textarea", {}, value) : el("input", { type, value });
  if (type === "textarea") input.value = value;
  input.addEventListener("change", (e) => onChange(e.target.value));
  wrap.appendChild(input);
  return wrap;
}
