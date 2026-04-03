export type FraudFeatures = {
  paymentMethod: string;
  promoUsed: number;
  orderTotal: number;
  ipCountry: string;
};

/** Mirrors `FraudScoringService.HeuristicProbability` in ShopWeb (used when ML.NET is unavailable). */
export function heuristicProbability(x: FraudFeatures): number {
  let score = 0.1;
  if (x.promoUsed > 0) score += 0.15;
  if (x.orderTotal > 800) score += 0.2;
  if (x.ipCountry !== "US" && x.ipCountry !== "CA") score += 0.25;
  if (x.paymentMethod === "crypto") score += 0.15;
  return Math.min(1, Math.max(0, score));
}
