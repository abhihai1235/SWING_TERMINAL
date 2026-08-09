/**
 * candidates.js
 * Holds the merged, de-duplicated candidate list produced by Scanner
 * Import, and exposes it (scored + ranked) to the rest of the app.
 *
 * Each import (a CSV file, a pasted table, or the sample data) is recorded
 * as an "import batch" with its own id. Every candidate remembers which
 * batch(es) contributed to it, so a single scanner's results can be
 * removed later without wiping out symbols that other scanners also
 * flagged (see removeImportBatch).
 */

const REQUIRED_FIELDS = ["symbol", "ltp"];

function getCandidates() {
  return Store.get(KEYS.CANDIDATES, []);
}

function saveCandidates(list) {
  Store.set(KEYS.CANDIDATES, list);
}

function clearCandidates() {
  Store.set(KEYS.CANDIDATES, []);
  Store.set(KEYS.IMPORT_BATCHES, []);
}

function getImportBatches() {
  return Store.get(KEYS.IMPORT_BATCHES, []);
}

function saveImportBatches(batches) {
  Store.set(KEYS.IMPORT_BATCHES, batches);
}

/**
 * Merge new raw records (from one Chartink scanner CSV, pasted table, or
 * the sample data set) into the existing candidate pool, de-duplicating
 * by symbol. Records this import as a new "batch" so it can be removed
 * as a unit later via removeImportBatch().
 */
function mergeCandidates(rawRecords, sourceName = "Imported") {
  const existing = getCandidates();
  const bySymbol = new Map(existing.map((c) => [c.symbol, c]));
  const missingRows = [];

  const batchId = uid("batch");
  const touchedSymbols = [];

  for (const raw of rawRecords) {
    const rec = normalizeRecord(raw);
    if (!rec.symbol) { missingRows.push(raw); continue; }
    rec.symbol = rec.symbol.toUpperCase().trim();

    const numericFields = [
      "ltp", "changePct", "volume", "avgVolume20", "high52w", "low52w",
      "sma50", "sma200", "rsi", "epsGrowth", "salesGrowth", "roe",
    ];
    numericFields.forEach((f) => { if (rec[f] !== undefined) rec[f] = toNumber(rec[f]); });

    touchedSymbols.push(rec.symbol);

    if (bySymbol.has(rec.symbol)) {
      const prior = bySymbol.get(rec.symbol);
      const priorBatches = prior.sourceBatches || [];
      bySymbol.set(rec.symbol, {
        ...prior,
        ...rec,
        id: prior.id,
        sourceBatches: priorBatches.includes(batchId) ? priorBatches : [...priorBatches, batchId],
      });
    } else {
      bySymbol.set(rec.symbol, { ...rec, id: uid("cand"), sourceBatches: [batchId], rejected: false });
    }
  }

  if (touchedSymbols.length) {
    const batches = getImportBatches();
    batches.push({ id: batchId, label: sourceName, timestamp: new Date().toISOString(), symbolCount: touchedSymbols.length });
    saveImportBatches(batches);
  }

  const merged = Array.from(bySymbol.values()).map((c) => ({ ...c, scannerSource: describeSources(c.sourceBatches) }));
  saveCandidates(merged);

  const incomplete = merged.filter((c) => REQUIRED_FIELDS.some((f) => c[f] === undefined || c[f] === "" || (typeof c[f] === "number" && isNaN(c[f]))));

  return {
    total: merged.length,
    added: rawRecords.length - missingRows.length,
    skipped: missingRows.length,
    incompleteCount: incomplete.length,
    batchId,
  };
}

/** Human-readable "which scanners flagged this stock" string, from batch ids. */
function describeSources(batchIds = []) {
  const batches = getImportBatches();
  const labels = batchIds
    .map((id) => batches.find((b) => b.id === id)?.label)
    .filter(Boolean);
  return Array.from(new Set(labels)).join(", ") || "Imported";
}

/**
 * Remove one entire import batch (e.g. one scanner's CSV). Candidates
 * that only came from this batch are deleted outright; candidates that
 * were also flagged by other scanners are kept, with this batch's
 * contribution simply removed from their source list.
 */
function removeImportBatch(batchId) {
  const remaining = getCandidates()
    .map((c) => ({ ...c, sourceBatches: (c.sourceBatches || []).filter((b) => b !== batchId) }))
    .filter((c) => c.sourceBatches.length > 0)
    .map((c) => ({ ...c, scannerSource: describeSources(c.sourceBatches) }));
  saveCandidates(remaining);
  saveImportBatches(getImportBatches().filter((b) => b.id !== batchId));
  return { remainingTotal: remaining.length };
}

/** Returns candidates scored + sorted highest composite score first.
 *  By default this excludes candidates the trader has explicitly rejected —
 *  pass { includeRejected: true } to see the full pool (e.g. for audit/history).
 */
function getRankedCandidates(weights, { includeRejected = false } = {}) {
  let list = getCandidates();
  if (!includeRejected) list = list.filter((c) => !c.rejected);
  return list
    .map((c) => ({ ...c, ...scoreCandidate(c, weights) }))
    .sort((a, b) => b.composite - a.composite);
}

/** Top N candidates for a given bias ("long" or "short"), auto-backfilling
 *  from the rest of the pool as candidates are rejected/removed. */
function getTopCandidates(bias, count = 10, weights) {
  return getRankedCandidates(weights).filter((c) => c.bias === bias).slice(0, count);
}

function getCandidateById(id) {
  return getCandidates().find((c) => c.id === id) || null;
}

function updateCandidate(id, patch) {
  const list = getCandidates().map((c) => (c.id === id ? { ...c, ...patch } : c));
  saveCandidates(list);
}

function removeCandidate(id) {
  saveCandidates(getCandidates().filter((c) => c.id !== id));
}

function rejectCandidate(id) {
  updateCandidate(id, { rejected: true });
}

function restoreCandidate(id) {
  updateCandidate(id, { rejected: false });
}
