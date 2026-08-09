/**
 * utils.js
 * Framework-free helper functions shared across modules.
 * No external dependencies — keeps the app fully offline-capable.
 */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c === null || c === undefined) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

/* ---------------------------------------------------------------------- */
/* Number / currency formatting                                           */
/* ---------------------------------------------------------------------- */

function fmtINR(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCr(value) {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return (Number(value) / 10000000).toFixed(2) + " Cr";
}

function fmtPct(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return "—";
  const v = Number(value);
  return (v > 0 ? "+" : "") + v.toFixed(decimals) + "%";
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------------- */
/* CSV parsing — handles quoted fields, commas-in-quotes, CRLF/LF          */
/* ---------------------------------------------------------------------- */

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") pushField();
      else if (c === "\r") { /* skip */ }
      else if (c === "\n") { pushField(); pushRow(); }
      else field += c;
    }
  }
  if (field.length || row.length) { pushField(); pushRow(); }

  const filtered = rows.filter((r) => r.some((cell) => cell.trim() !== ""));
  if (!filtered.length) return { headers: [], records: [] };

  const headers = filtered[0].map((h) => h.trim());
  const records = filtered.slice(1).map((r) => {
    const rec = {};
    headers.forEach((h, idx) => { rec[h] = (r[idx] ?? "").trim(); });
    return rec;
  });
  return { headers, records };
}

/** Normalize a raw scanner header name to a canonical field key. */
const HEADER_ALIASES = {
  symbol: "symbol", ticker: "symbol", "stock name": "symbol", nsecode: "symbol", "stock code": "symbol",
  name: "companyName", "company name": "companyName",
  close: "ltp", ltp: "ltp", price: "ltp", "close price": "ltp",
  volume: "volume", vol: "volume",
  "% chg": "changePct", "1 day % change": "changePct", change: "changePct", chg: "changePct",
  sector: "sector", industry: "sector",
  "52whigh": "high52w", "52w high": "high52w",
  "52wlow": "low52w", "52w low": "low52w",
  "sma50": "sma50", "50 day sma": "sma50",
  "sma200": "sma200", "200 day sma": "sma200",
  rsi: "rsi", "rsi 14": "rsi",
  "eps growth": "epsGrowth", "eps qtr growth %": "epsGrowth", "eps growth %": "epsGrowth", "quarterly eps growth": "epsGrowth",
  "sales growth": "salesGrowth", "sales growth %": "salesGrowth", "quarterly sales growth": "salesGrowth",
  "roe": "roe", "return on equity": "roe",
  "rs rating": "rsRating", "relative strength rating": "rsRating", "ibd rs rating": "rsRating",
};

function normalizeHeader(h) {
  const key = h.trim().toLowerCase();
  return HEADER_ALIASES[key] || h.trim();
}

function normalizeRecord(rec) {
  const out = {};
  for (const [k, v] of Object.entries(rec)) {
    out[normalizeHeader(k)] = v;
  }
  return out;
}

function toNumber(v) {
  if (v === null || v === undefined) return NaN;
  const cleaned = String(v).replace(/,/g, "").replace(/%/g, "").trim();
  return cleaned === "" ? NaN : Number(cleaned);
}

/* ---------------------------------------------------------------------- */
/* Toast notifications                                                     */
/* ---------------------------------------------------------------------- */

function toast(message, type = "info", ms = 3200) {
  const root = $("#toast-root");
  if (!root) return;
  const node = el("div", { class: `toast ${type}` }, message);
  root.appendChild(node);
  setTimeout(() => node.remove(), ms);
}

/* ---------------------------------------------------------------------- */
/* Debounce                                                                */
/* ---------------------------------------------------------------------- */

function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
