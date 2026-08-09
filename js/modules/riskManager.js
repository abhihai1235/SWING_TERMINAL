/**
 * riskManager.js
 * Pure calculation functions for position sizing and portfolio risk.
 * No side effects — easy to unit test and safe to reuse in a future
 * mobile app or server-side pre-trade check.
 */


const DEFAULT_RISK_SETTINGS = {
  capital: 1000000,
  maxRiskPerTradePct: 1.0,
  maxPortfolioExposurePct: 25,
};

function getRiskSettings() {
  return Store.get(KEYS.RISK_SETTINGS) || { ...DEFAULT_RISK_SETTINGS };
}
function saveRiskSettings(settings) {
  Store.set(KEYS.RISK_SETTINGS, settings);
}

/**
 * Compute position sizing for a single trade.
 * @param {number} capital - total trading capital
 * @param {number} maxRiskPerTradePct - e.g. 1 = 1% of capital
 * @param {number} entry - planned entry price
 * @param {number} stopLoss - planned stop-loss price
 */
function computePositionSize(capital, maxRiskPerTradePct, entry, stopLoss) {
  const riskPerShare = Math.abs(entry - stopLoss);
  if (!capital || !entry || !stopLoss || riskPerShare === 0) {
    return { quantity: 0, capitalRequired: 0, riskAmount: 0, riskPerShare: 0, portfolioPct: 0 };
  }
  const riskAmount = capital * (maxRiskPerTradePct / 100);
  const quantity = Math.floor(riskAmount / riskPerShare);
  const capitalRequired = quantity * entry;
  const portfolioPct = capital ? (capitalRequired / capital) * 100 : 0;
  return { quantity, capitalRequired, riskAmount, riskPerShare, portfolioPct };
}

function computeRewardRisk(entry, stopLoss, target) {
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(target - entry);
  if (risk === 0) return 0;
  return +(reward / risk).toFixed(2);
}

/**
 * Check a proposed new position against total open exposure to flag
 * portfolio-level risk breaches before the trade is journaled.
 */
function checkPortfolioExposure(openPositionsCapital, newPositionCapital, capital, maxPortfolioExposurePct) {
  const totalExposure = openPositionsCapital + newPositionCapital;
  const exposurePct = capital ? (totalExposure / capital) * 100 : 0;
  return {
    exposurePct: +exposurePct.toFixed(1),
    exceedsLimit: exposurePct > maxPortfolioExposurePct,
  };
}
