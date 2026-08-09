
let planState = {};
let checkedItems = new Set();

function renderTradeWorkspace(container, candidateId, onCandidateAccepted) {
  const candidate = getCandidateById(candidateId);
  container.innerHTML = "";

  if (!candidate) {
    container.appendChild(
      el("div", { class: "empty-state" }, [
        el("div", { class: "empty-state-icon" }, "◇"),
        el("p", {}, "Select a candidate from the Ranked Candidates list to open its workspace."),
      ])
    );
    return;
  }

  // Seed the plan with sensible defaults derived from the candidate's own data.
  planState = {
    entry: candidate.ltp || 0,
    stopLoss: candidate.sma50 ? +(candidate.sma50 * 0.99).toFixed(2) : +(candidate.ltp * 0.95).toFixed(2),
    target: candidate.high52w ? +(candidate.high52w * 1.08).toFixed(2) : +(candidate.ltp * 1.15).toFixed(2),
    thesis: candidate.notes || "",
    srNotes: candidate.srNotes || "",
    direction: candidate.bias || "long",
    setupType: (candidate.scannerSource || "").split(",")[0]?.trim() || "",
  };
  checkedItems = new Set(candidate.checklistChecked || []);

  const { label, cssVar } = scoreLabel(candidate.composite ?? 0);

  container.appendChild(
    el("div", { class: "view-header" }, [
      el("div", {}, [
        el("h2", { class: "view-title" }, `${candidate.symbol} — ${candidate.companyName || ""}`),
        el("div", { class: "view-subtitle" }, `${candidate.sector || "Unclassified sector"} · Composite score ${candidate.composite ?? "—"} (${label})`),
      ]),
      el("span", { class: `badge badge-${planState.direction === "long" ? "long" : "short"}` }, planState.direction === "long" ? "Long setup" : "Short setup"),
    ])
  );

  const layout = el("div", { class: "workspace-layout" });

  /* -------------------- Left column: chart + thesis -------------------- */
  const left = el("div", {});

  const tfRow = el("div", { class: "tv-timeframes" });
  TIMEFRAMES.forEach((tf, idx) => {
    const btn = el("button", { class: `btn btn-sm${idx === 2 ? " btn-primary" : ""}` }, tf.label);
    btn.addEventListener("click", () => {
      $$tf(tfRow).forEach((b) => b.classList.remove("btn-primary"));
      btn.classList.add("btn-primary");
      renderAdvancedChart(chartWrap, candidate.symbol, tf.interval);
    });
    tfRow.appendChild(btn);
  });
  const chartWrap = el("div", { class: "tv-chart-wrap" });
  left.append(tfRow, chartWrap);
  renderAdvancedChart(chartWrap, candidate.symbol, "D");

  const liveRatingPanel = el("div", { class: "panel mt-16" }, [
    el("div", { class: "panel-title" }, ["Live Technical Rating (TradingView)", el("span", { class: "txt-muted", style: "text-transform:none; letter-spacing:0;" }, "separate from our score above — live, third-party")]),
    el("div", { id: "tv-technical-gauge" }),
  ]);
  left.appendChild(liveRatingPanel);
  renderTechnicalAnalysisGauge($("#tv-technical-gauge", liveRatingPanel), candidate.symbol, "1D");

  const thesisPanel = el("div", { class: "panel mt-16" }, [
    el("div", { class: "panel-title" }, "Trade Thesis & Support/Resistance Notes"),
    el("div", { class: "field" }, [
      el("label", {}, "Setup type"),
      textInput(planState.setupType, (v) => (planState.setupType = v)),
    ]),
    el("div", { class: "field" }, [
      el("label", {}, "Why this trade? (thesis)"),
      textArea(planState.thesis, (v) => (planState.thesis = v)),
    ]),
    el("div", { class: "field" }, [
      el("label", {}, "Key support / resistance levels"),
      textArea(planState.srNotes, (v) => (planState.srNotes = v)),
    ]),
  ]);
  left.appendChild(thesisPanel);

  /* -------------------- Right column: plan, risk, checklist -------------------- */
  const right = el("div", {});

  const planPanel = el("div", { class: "panel" });
  planPanel.appendChild(el("div", { class: "panel-title" }, "Trade Plan"));
  const directionSelect = el("select", {}, [
    el("option", { value: "long", selected: planState.direction === "long" ? "true" : null }, "Long"),
    el("option", { value: "short", selected: planState.direction === "short" ? "true" : null }, "Short"),
  ]);
  directionSelect.addEventListener("change", (e) => { planState.direction = e.target.value; redrawPlan(); });
  planPanel.appendChild(el("div", { class: "field" }, [el("label", {}, "Direction"), directionSelect]));

  const entryInput = numberInput(planState.entry, (v) => { planState.entry = v; redrawPlan(); });
  const stopInput = numberInput(planState.stopLoss, (v) => { planState.stopLoss = v; redrawPlan(); });
  const targetInput = numberInput(planState.target, (v) => { planState.target = v; redrawPlan(); });
  planPanel.append(
    el("div", { class: "field" }, [el("label", {}, "Entry zone"), entryInput]),
    el("div", { class: "field" }, [el("label", {}, "Stop-loss"), stopInput]),
    el("div", { class: "field" }, [el("label", {}, "Target"), targetInput]),
  );
  const planStatsBox = el("div", {});
  planPanel.appendChild(planStatsBox);
  right.appendChild(planPanel);

  const checklistPanel = el("div", { class: "panel mt-16" });
  checklistPanel.appendChild(el("div", { class: "panel-title" }, "Trade Checklist"));
  const checklistBox = el("div", {});
  checklistPanel.appendChild(checklistBox);
  right.appendChild(checklistPanel);

  const notesPanel = el("div", { class: "panel mt-16" }, [
    el("div", { class: "panel-title" }, "Personal Notes"),
    textArea(candidate.personalNotes || "", (v) => updateCandidate(candidate.id, { personalNotes: v })),
  ]);
  right.appendChild(notesPanel);

  const actionsPanel = el("div", { class: "panel mt-16 flex gap-8" });
  const acceptBtn = el("button", { class: "btn btn-primary w-full" }, "Accept — Send to Journal");
  const rejectBtn = el("button", { class: "btn btn-danger" }, "Reject");
  actionsPanel.append(acceptBtn, rejectBtn);
  right.appendChild(actionsPanel);

  layout.append(left, right);
  container.appendChild(layout);

  function redrawPlan() {
    const risk = getRiskSettings();
    const sizing = computePositionSize(risk.capital, risk.maxRiskPerTradePct, planState.entry, planState.stopLoss);
    const rr = computeRewardRisk(planState.entry, planState.stopLoss, planState.target);
    planStatsBox.innerHTML = "";
    planStatsBox.append(
      planRow("Position size", `${sizing.quantity} shares`),
      planRow("Capital required", fmtINR(sizing.capitalRequired, 0)),
      planRow("Risk amount", fmtINR(sizing.riskAmount, 0)),
      planRow("% of capital deployed", sizing.portfolioPct.toFixed(1) + "%"),
      planRow("Reward : Risk", `${rr} : 1`, rr >= 2 ? "txt-teal" : "txt-red"),
    );
  }

  function redrawChecklist() {
    checklistBox.innerHTML = "";
    const evalResult = evaluateChecklist(Array.from(checkedItems));
    if (evalResult.hasCriticalFailure) {
      checklistBox.appendChild(el("div", { class: "badge badge-short mt-8" }, `${evalResult.failedCritical.length} critical item(s) unchecked`));
    }
    evalResult.results.forEach((item) => {
      const cb = el("input", { type: "checkbox" });
      cb.checked = item.passed;
      cb.addEventListener("change", () => {
        if (cb.checked) checkedItems.add(item.id); else checkedItems.delete(item.id);
        redrawChecklist();
      });
      const row = el("label", { class: `checklist-item${item.critical ? " critical" : ""}${item.critical && !item.passed ? " failed" : ""}` }, [
        cb,
        el("span", { class: "checklist-label" }, item.label),
      ]);
      checklistBox.appendChild(row);
    });
    checklistBox.appendChild(el("p", { class: "txt-muted mt-8" }, `${evalResult.totalPassed}/${evalResult.totalItems} confirmed.`));
  }

  redrawPlan();
  redrawChecklist();

  acceptBtn.addEventListener("click", () => {
    const evalResult = evaluateChecklist(Array.from(checkedItems));
    if (evalResult.hasCriticalFailure) {
      const proceed = confirm(`${evalResult.failedCritical.length} critical checklist item(s) are unchecked:\n\n${evalResult.failedCritical.map((f) => "• " + f.label).join("\n")}\n\nSend to journal anyway?`);
      if (!proceed) return;
    }
    const risk = getRiskSettings();
    const sizing = computePositionSize(risk.capital, risk.maxRiskPerTradePct, planState.entry, planState.stopLoss);
    addJournalEntry({
      symbol: candidate.symbol,
      direction: planState.direction,
      setupType: planState.setupType,
      entry: planState.entry,
      stopLoss: planState.stopLoss,
      target: planState.target,
      quantity: sizing.quantity,
      notes: planState.thesis,
      checklistSnapshot: evalResult.results,
      scoreSnapshot: candidate.composite,
      status: "planned",
    });
    updateCandidate(candidate.id, { checklistChecked: Array.from(checkedItems) });
    toast(`${candidate.symbol} sent to journal.`, "success");
    if (onCandidateAccepted) onCandidateAccepted(candidate.id);
  });

  rejectBtn.addEventListener("click", () => {
    rejectCandidate(candidate.id);
    toast(`${candidate.symbol} excluded from ranking — kept for reference, and the next-best candidate now fills its Top 10 slot.`, "info");
  });
}

function planRow(label, value, cls = "") {
  return el("div", { class: "plan-row" }, [el("span", { class: "label" }, label), el("span", { class: `value ${cls}` }, value)]);
}

function textInput(value, onChange) {
  const input = el("input", { type: "text", value });
  input.addEventListener("input", (e) => onChange(e.target.value));
  return input;
}
function numberInput(value, onChange) {
  const input = el("input", { type: "number", step: "0.05", value });
  input.addEventListener("input", (e) => onChange(parseFloat(e.target.value) || 0));
  return input;
}
function textArea(value, onChange) {
  const ta = el("textarea", {}, value);
  ta.value = value;
  ta.addEventListener("input", (e) => onChange(e.target.value));
  return ta;
}
function $$tf(root) { return Array.from(root.querySelectorAll("button")); }
