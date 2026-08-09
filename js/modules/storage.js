/**
 * storage.js
 * Thin abstraction over persistence. Everything in the app reads/writes
 * through this module — swap the internals later (IndexedDB, REST API,
 * broker backend, mobile SQLite bridge) without touching feature code.
 */

const NAMESPACE = "swingTerminal.v1";

function key(name) { return `${NAMESPACE}.${name}`; }

const Store = {
  get(name, fallback = null) {
    try {
      const raw = localStorage.getItem(key(name));
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.error(`Store.get failed for ${name}`, e);
      return fallback;
    }
  },
  set(name, value) {
    try {
      localStorage.setItem(key(name), JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`Store.set failed for ${name}`, e);
      return false;
    }
  },
  remove(name) {
    localStorage.removeItem(key(name));
  },
  /** Export the entire app state as a single JSON blob (for backup / migration). */
  exportAll() {
    const out = {};
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(NAMESPACE)) out[k.slice(NAMESPACE.length + 1)] = JSON.parse(localStorage.getItem(k));
    }
    return out;
  },
  importAll(obj) {
    for (const [k, v] of Object.entries(obj)) this.set(k, v);
  },
};

/* Keys used across the app, centralized to avoid typos / drift */
const KEYS = {
  CANDIDATES: "candidates",
  JOURNAL: "journal",
  SCORING_WEIGHTS: "scoringWeights",
  RISK_SETTINGS: "riskSettings",
  SCANNER_LIBRARY: "scannerLibraryCustom",
  UI_STATE: "uiState",
  IMPORT_BATCHES: "importBatches",
  MARKET_BIAS: "marketBias",
  LIVE_DATA_URL: "liveDataUrl",
};
