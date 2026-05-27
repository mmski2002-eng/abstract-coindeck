export type OracleScoreInput = {
  priceChg: number;
  vol24h: number;
  high24h: number;
  low24h: number;
  tempRatio: number;
  hype?: boolean;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calcVolPts(vol: number): number {
  if (vol >= 500e6) return 100;
  if (vol >= 200e6) return 80;
  if (vol >= 100e6) return 60;
  if (vol >= 50e6) return 40;
  if (vol >= 10e6) return 20;
  return 0;
}

export function calcVolatilityPts(spread: number): number {
  if (spread >= 20) return 100;
  if (spread >= 15) return 80;
  if (spread >= 10) return 60;
  if (spread >= 5) return 40;
  if (spread >= 2) return 20;
  return 0;
}

export function calcSpreadPct(low24h: number, high24h: number): number {
  return low24h > 0 ? ((high24h - low24h) / low24h) * 100 : 0;
}

export type OracleScoreBreakdown = {
  spread: number;
  pricePts: number;
  volPts: number;
  volatilityPts: number;
  tempPts: number;
  hypePts: number;
  total: number;
};

export function calcOracleBreakdown(score: OracleScoreInput): OracleScoreBreakdown {
  const spread = calcSpreadPct(score.low24h, score.high24h);
  const pricePts = clamp(Math.round(score.priceChg * 10), -300, 300);
  const volPts = calcVolPts(score.vol24h);
  const volatilityPts = calcVolatilityPts(spread);
  const tempPts = clamp(Math.round(score.tempRatio * 10), 0, 150);
  const hypePts = score.hype ? 100 : 0;
  const total = clamp(pricePts + volPts + volatilityPts + tempPts + hypePts, 0, 750);
  return { spread, pricePts, volPts, volatilityPts, tempPts, hypePts, total };
}

export function calcOraclePoints(score: OracleScoreInput): number {
  return calcOracleBreakdown(score).total;
}
