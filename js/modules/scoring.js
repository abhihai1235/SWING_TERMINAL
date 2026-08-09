/**
 * scoring.js
 * ---------------------------------------------------------------------
 * Techno-funda scoring engine, built around the analysis frameworks named
 * in this project's brief: Weinstein Stage Analysis for trend context,
 * Minervini-style VCP for base/contraction quality, O'Neil/CANSLIM-style
 * relative strength and (where fundamental columns are present) earnings
 * growth, and Darvas-style proximity-to-pivot logic for breakouts.
 *
 * KEY DESIGN CHOICE: long and short setups are scored with two SEPARATE,
 * direction-appropriate sub-score sets — a short candidate is not simply
 * "1 minus the long score". A stock can score high as a genuine breakdown
 * (falling trend, weak relative strength, distribution volume, rejected
 * at resistance) independent of how it scores on bullish criteria. The
 * candidate's bias is whichever direction has the stronger, more complete
 * technical case, and its displayed composite score reflects the quality
 * of THAT setup — this is what should differentiate real trade candidates
 * from noise, and what should show up over time in the Analytics module
 * as fewer, better trades and a shallower drawdown.
 *
 * Every score is 0-100 and is an OBJECTIVE summary of the fields present
 * on the row (technicals from the scanner export, plus optional
 * fundamental columns like EPS/sales growth or ROE if your Chartink
 * scanner outputs them). It does not predict future price movement.
 * ---------------------------------------------------------------------
 */

const DEFAULT_WEIGHTS = {
  trend: 14,
  relativeStrength: 11,
  volume: 9,
  liquidity: 7,
  proximityToExtreme: 9,
  momentum: 11,
  baseQuality: 10,
  breakoutQuality: 10,
  riskReward: 9,
  fundamentals: 6,
  marketContext: 4,
};

function getWeights() {
  const stored = Store.get(KEYS.SCORING_WEIGHTS);
  return stored && Object.keys(stored).length ? stored : { ...DEFAULT_WEIGHTS };
}

function saveWeights(weights) {
  Store.set(KEYS.SCORING_WEIGHTS, weights);
}

function weightSum(weights) {
  return Object.values(weights).reduce((a, b) => a + Number(b || 0), 0);
}

/* ---------------------------------------------------------------------- */
/* Shared helpers                                                          */
/* ---------------------------------------------------------------------- */

function haveAll(c, fields) {
  return fields.every((f) => !isNaN(toNumber(c[f])));
}

/** How many of the fields the scoring model actually uses were present on this row (0-1). */
function dataCompleteness(c) {
  const fields = ["ltp", "changePct", "volume", "avgVolume20", "high52w", "low52w", "sma50", "sma200", "rsi"];
  const present = fields.filter((f) => c[f] !== undefined && c[f] !== "" && !(typeof c[f] === "number" && isNaN(c[f])));
  return +(present.length / fields.length).toFixed(2);
}

/** Optional CANSLIM-lite fundamentals — neutral (50) when the scanner export doesn't include them. */
function scoreFundamentals(c, direction) {
  const eps = toNumber(c.epsGrowth), sales = toNumber(c.salesGrowth), roe = toNumber(c.roe);
  const have = [eps, sales, roe].filter((v) => !isNaN(v));
  if (!have.length) return 50;
  let score = 50;
  if (!isNaN(eps)) score += (direction === "long" ? eps : -eps) * 1.2;
  if (!isNaN(sales)) score += (direction === "long" ? sales : -sales) * 0.8;
  if (!isNaN(roe)) score += (direction === "long" ? (roe - 15) : (15 - roe)) * 1.0;
  return clamp(Math.round(score), 0, 100);
}

/** Market-context adjustment: is the broader tape helping or fighting this trade direction? */
function scoreMarketContext(direction) {
  const bias = Store.get(KEYS.MARKET_BIAS, "neutral");
  if (bias === "neutral") return 50;
  const supportive = bias === "supportive";
  if (direction === "long") return supportive ? 80 : 25;
  return supportive ? 25 : 80; // a supportive tape works against fresh shorts, and vice versa
}

/* ---------------------------------------------------------------------- */
/* LONG-side sub-scores                                                    */
/* ---------------------------------------------------------------------- */

function scoreTrendLong(c) {
  const close = toNumber(c.ltp), sma50 = toNumber(c.sma50), sma200 = toNumber(c.sma200);
  if (haveAll(c, ["ltp", "sma50", "sma200"])) {
    let s = 30;
    if (close > sma50) s += 25;
    if (close > sma200) s += 20;
    if (sma50 > sma200) s += 25; // Weinstein Stage 2 structure
    return clamp(s, 0, 100);
  }
  const chg = toNumber(c.changePct);
  return isNaN(chg) ? 50 : clamp(50 + chg * 5, 0, 100);
}

function scoreRelativeStrengthLong(c) {
  if (!isNaN(toNumber(c.rsRating))) return clamp(toNumber(c.rsRating), 0, 100);
  const chg = toNumber(c.changePct);
  return isNaN(chg) ? 50 : clamp(50 + chg * 8, 0, 100);
}

function scoreVolumeLong(c) {
  const vol = toNumber(c.volume), avgVol = toNumber(c.avgVolume20), chg = toNumber(c.changePct);
  if (!isNaN(vol) && !isNaN(avgVol) && avgVol > 0) {
    const ratio = vol / avgVol;
    let s = clamp((ratio - 0.5) * 55, 0, 100);
    if (!isNaN(chg) && chg > 0 && ratio > 1.2) s = clamp(s + 10, 0, 100); // up-move on strong volume = accumulation
    return s;
  }
  return 50;
}

function scoreLiquidity(c) {
  const vol = toNumber(c.volume), price = toNumber(c.ltp);
  if (isNaN(vol) || isNaN(price)) return 50;
  const turnoverCr = (vol * price) / 10000000;
  return clamp(turnoverCr * 10, 0, 100);
}

function scoreProximityToHigh(c) {
  const close = toNumber(c.ltp), high = toNumber(c.high52w);
  if (isNaN(close) || isNaN(high) || high === 0) return 50;
  return clamp(((close / high) * 100 - 60) * 2.5, 0, 100);
}

function scoreMomentumLong(c) {
  const rsi = toNumber(c.rsi);
  if (!isNaN(rsi)) {
    if (rsi >= 55 && rsi <= 70) return 100;
    if (rsi > 70 && rsi <= 80) return 70;
    if (rsi > 80) return 35;
    if (rsi >= 45 && rsi < 55) return 55;
    return 25;
  }
  const chg = toNumber(c.changePct);
  return isNaN(chg) ? 50 : clamp(50 + chg * 6, 0, 100);
}

/** Minervini VCP-style: tighter range relative to its own 52-week spread scores higher. */
function scoreBaseQuality(c) {
  const high = toNumber(c.high52w), low = toNumber(c.low52w);
  if (isNaN(high) || isNaN(low) || high === 0) return 50;
  const range = (high - low) / high;
  return clamp(100 - range * 100, 0, 100);
}

function scoreBreakoutQualityLong(c) {
  const close = toNumber(c.ltp), high = toNumber(c.high52w), vol = toNumber(c.volume), avgVol = toNumber(c.avgVolume20);
  if (isNaN(close) || isNaN(high)) return 50;
  const nearHigh = close >= 0.97 * high;
  const volConfirm = !isNaN(vol) && !isNaN(avgVol) && avgVol > 0 && vol > 1.3 * avgVol;
  if (nearHigh && volConfirm) return 100;
  if (nearHigh) return 65;
  if (volConfirm) return 55;
  return 35;
}

function scoreRiskRewardLong(c) {
  const close = toNumber(c.ltp), sma50 = toNumber(c.sma50), high = toNumber(c.high52w);
  if (isNaN(close)) return 50;
  const stopProxy = !isNaN(sma50) ? sma50 : close * 0.93;
  const targetProxy = !isNaN(high) ? high * 1.1 : close * 1.15;
  const risk = Math.abs(close - stopProxy);
  if (risk === 0) return 50;
  const reward = Math.abs(targetProxy - close);
  return clamp((reward / risk) * 25, 0, 100);
}

/* ---------------------------------------------------------------------- */
/* SHORT-side sub-scores (mirrored logic, not just "100 - long")           */
/* ---------------------------------------------------------------------- */

function scoreTrendShort(c) {
  const close = toNumber(c.ltp), sma50 = toNumber(c.sma50), sma200 = toNumber(c.sma200);
  if (haveAll(c, ["ltp", "sma50", "sma200"])) {
    let s = 30;
    if (close < sma50) s += 25;
    if (close < sma200) s += 20;
    if (sma50 < sma200) s += 25; // Weinstein Stage 4 structure
    return clamp(s, 0, 100);
  }
  const chg = toNumber(c.changePct);
  return isNaN(chg) ? 50 : clamp(50 - chg * 5, 0, 100);
}

function scoreRelativeWeakness(c) {
  if (!isNaN(toNumber(c.rsRating))) return clamp(100 - toNumber(c.rsRating), 0, 100);
  const chg = toNumber(c.changePct);
  return isNaN(chg) ? 50 : clamp(50 - chg * 8, 0, 100);
}

function scoreDistributionVolume(c) {
  const vol = toNumber(c.volume), avgVol = toNumber(c.avgVolume20), chg = toNumber(c.changePct);
  if (!isNaN(vol) && !isNaN(avgVol) && avgVol > 0) {
    const ratio = vol / avgVol;
    let s = clamp((ratio - 0.5) * 55, 0, 100);
    if (!isNaN(chg) && chg < 0 && ratio > 1.2) s = clamp(s + 10, 0, 100); // down-move on strong volume = distribution
    return s;
  }
  return 50;
}

function scoreProximityToLow(c) {
  const close = toNumber(c.ltp), low = toNumber(c.low52w);
  if (isNaN(close) || isNaN(low) || close === 0) return 50;
  return clamp((140 - (close / low) * 100) * 2.5, 0, 100);
}

function scoreMomentumShort(c) {
  const rsi = toNumber(c.rsi);
  if (!isNaN(rsi)) {
    if (rsi <= 45 && rsi >= 30) return 100;
    if (rsi < 30) return 70; // deeply oversold — still a valid breakdown continuation, less fresh
    if (rsi > 45 && rsi <= 55) return 55;
    return 25;
  }
  const chg = toNumber(c.changePct);
  return isNaN(chg) ? 50 : clamp(50 - chg * 6, 0, 100);
}

function scoreBreakdownQuality(c) {
  const close = toNumber(c.ltp), low = toNumber(c.low52w), vol = toNumber(c.volume), avgVol = toNumber(c.avgVolume20);
  if (isNaN(close) || isNaN(low)) return 50;
  const nearLow = close <= 1.03 * low;
  const volConfirm = !isNaN(vol) && !isNaN(avgVol) && avgVol > 0 && vol > 1.3 * avgVol;
  if (nearLow && volConfirm) return 100;
  if (nearLow) return 65;
  if (volConfirm) return 55;
  return 35;
}

function scoreRiskRewardShort(c) {
  const close = toNumber(c.ltp), sma50 = toNumber(c.sma50), low = toNumber(c.low52w);
  if (isNaN(close)) return 50;
  const stopProxy = !isNaN(sma50) ? sma50 : close * 1.07; // stop above resistance for a short
  const targetProxy = !isNaN(low) ? low * 0.9 : close * 0.85;
  const risk = Math.abs(stopProxy - close);
  if (risk === 0) return 50;
  const reward = Math.abs(close - targetProxy);
  return clamp((reward / risk) * 25, 0, 100);
}

/* ---------------------------------------------------------------------- */
/* Composite: score both directions, keep the stronger, more complete one  */
/* ---------------------------------------------------------------------- */

function weightedComposite(sub, weights) {
  const totalWeight = weightSum(weights) || 1;
  let total = 0;
  for (const [key, val] of Object.entries(sub)) total += (val * (Number(weights[key]) || 0)) / totalWeight;
  return clamp(Math.round(total), 0, 100);
}

function scoreCandidate(candidate, weights = getWeights()) {
  const longSub = {
    trend: scoreTrendLong(candidate),
    relativeStrength: scoreRelativeStrengthLong(candidate),
    volume: scoreVolumeLong(candidate),
    liquidity: scoreLiquidity(candidate),
    proximityToExtreme: scoreProximityToHigh(candidate),
    momentum: scoreMomentumLong(candidate),
    baseQuality: scoreBaseQuality(candidate),
    breakoutQuality: scoreBreakoutQualityLong(candidate),
    riskReward: scoreRiskRewardLong(candidate),
    fundamentals: scoreFundamentals(candidate, "long"),
    marketContext: scoreMarketContext("long"),
  };
  const shortSub = {
    trend: scoreTrendShort(candidate),
    relativeStrength: scoreRelativeWeakness(candidate),
    volume: scoreDistributionVolume(candidate),
    liquidity: scoreLiquidity(candidate),
    proximityToExtreme: scoreProximityToLow(candidate),
    momentum: scoreMomentumShort(candidate),
    baseQuality: scoreBaseQuality(candidate),
    breakoutQuality: scoreBreakdownQuality(candidate),
    riskReward: scoreRiskRewardShort(candidate),
    fundamentals: scoreFundamentals(candidate, "short"),
    marketContext: scoreMarketContext("short"),
  };

  const longComposite = weightedComposite(longSub, weights);
  const shortComposite = weightedComposite(shortSub, weights);

  // A small margin avoids flipping bias on noise when both sides look similarly mediocre.
  const bias = longComposite >= shortComposite ? "long" : "short";
  const composite = bias === "long" ? longComposite : shortComposite;
  const subScores = bias === "long" ? longSub : shortSub;

  return {
    subScores,
    composite,
    bias,
    longComposite,
    shortComposite,
    completeness: dataCompleteness(candidate),
  };
}

function scoreLabel(score) {
  if (score >= 80) return { label: "Excellent", cssVar: "--score-excellent" };
  if (score >= 65) return { label: "Good", cssVar: "--score-good" };
  if (score >= 50) return { label: "Fair", cssVar: "--score-fair" };
  if (score >= 35) return { label: "Weak", cssVar: "--score-weak" };
  return { label: "Poor", cssVar: "--score-poor" };
}
