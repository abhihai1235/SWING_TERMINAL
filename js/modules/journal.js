/**
 * journal.js
 * Trade journal persistence — every accepted setup, its plan, and its
 * eventual outcome lives here. This is the single source of truth for
 * the Analytics module.
 */


function getJournalEntries() {
  return Store.get(KEYS.JOURNAL, []);
}

function saveEntries(entries) {
  Store.set(KEYS.JOURNAL, entries);
}

/**
 * Add a new journal entry from an accepted trade plan.
 * status: "planned" | "open" | "closed"
 */
function addJournalEntry(entry) {
  const entries = getJournalEntries();
  const record = {
    id: uid("trade"),
    dateAdded: todayISO(),
    status: "planned",
    direction: "long",
    setupType: "",
    symbol: "",
    entry: null,
    stopLoss: null,
    target: null,
    quantity: null,
    exitPrice: null,
    exitDate: null,
    notes: "",
    mistakes: "",
    lessons: "",
    checklistSnapshot: [],
    scoreSnapshot: null,
    ...entry,
  };
  entries.unshift(record);
  saveEntries(entries);
  return record;
}

function updateJournalEntry(id, patch) {
  const entries = getJournalEntries().map((e) => (e.id === id ? { ...e, ...patch } : e));
  saveEntries(entries);
}

function deleteJournalEntry(id) {
  saveEntries(getJournalEntries().filter((e) => e.id !== id));
}

/** Compute realized P&L for a closed entry. Positive = profit. */
function computePnl(entry) {
  if (entry.exitPrice === null || entry.exitPrice === undefined || !entry.entry || !entry.quantity) return null;
  const direction = entry.direction === "short" ? -1 : 1;
  return +((entry.exitPrice - entry.entry) * entry.quantity * direction).toFixed(2);
}

function computePnlPct(entry) {
  if (entry.exitPrice === null || entry.exitPrice === undefined || !entry.entry) return null;
  const direction = entry.direction === "short" ? -1 : 1;
  return +(((entry.exitPrice - entry.entry) / entry.entry) * 100 * direction).toFixed(2);
}
