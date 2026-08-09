/**
 * checklist.js
 * Objective go/no-go checklist applied to every candidate before it is
 * accepted into the journal. Critical items failing should make the
 * trader stop and reconsider — the app visually flags this but the
 * final accept/reject decision always remains with the trader.
 */

const DEFAULT_CHECKLIST = [
  { id: "trend-aligned", label: "Trend aligned (price > 50 & 200 SMA, or clean downtrend for a short)", critical: true },
  { id: "long-term-avg", label: "Above (or below, for shorts) the long-term average with conviction", critical: true },
  { id: "liquidity", label: "Healthy liquidity — average turnover supports my position size", critical: true },
  { id: "proximity-resistance", label: "Not running straight into major overhead resistance", critical: false },
  { id: "overextended", label: "Not overextended (RSI / distance from moving average is reasonable)", critical: true },
  { id: "volume-confirmation", label: "Volume confirms the move (breakout/pullback volume as expected)", critical: false },
  { id: "sector-strong", label: "Sector / industry group is showing relative strength", critical: false },
  { id: "market-supportive", label: "Broader market context (Nifty trend, breadth, VIX) is supportive", critical: true },
  { id: "acceptable-rr", label: "Reward-to-risk is at least 2:1 at the planned stop and target", critical: true },
  { id: "position-sized", label: "Position size respects my max-risk-per-trade rule", critical: true },
];

/**
 * Evaluate a set of checked item ids against the checklist definition.
 * Returns pass/fail state plus whether any CRITICAL item failed.
 */
function evaluateChecklist(checkedIds = [], definition = DEFAULT_CHECKLIST) {
  const checkedSet = new Set(checkedIds);
  const results = definition.map((item) => ({ ...item, passed: checkedSet.has(item.id) }));
  const failedCritical = results.filter((r) => r.critical && !r.passed);
  const totalPassed = results.filter((r) => r.passed).length;
  return {
    results,
    totalPassed,
    totalItems: definition.length,
    hasCriticalFailure: failedCritical.length > 0,
    failedCritical,
  };
}
