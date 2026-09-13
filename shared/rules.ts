import type { AlertStatus, PriceRule } from "./types";

export function calculateTarget(
  rule: PriceRule,
  allTimeHigh: number | null,
  purchasePrice: number | null,
): number | null {
  const reference = rule.reference === "ath" ? allTimeHigh : purchasePrice;
  if (reference === null || !Number.isFinite(reference) || reference <= 0) return null;
  const multiplier = rule.offset === "above"
    ? 1 + rule.percent / 100
    : 1 - rule.percent / 100;
  return Math.max(0, reference * multiplier);
}

export function shouldTrigger(
  phase: "buy" | "sell",
  currentPrice: number,
  targetPrice: number | null,
): boolean {
  if (targetPrice === null || !Number.isFinite(currentPrice)) return false;
  return phase === "buy" ? currentPrice <= targetPrice : currentPrice >= targetPrice;
}

export function activePhase(status: AlertStatus): "buy" | "sell" | null {
  if (status === "watching_buy") return "buy";
  if (status === "holding") return "sell";
  return null;
}

export function percentFromAth(price: number | null, allTimeHigh: number | null): number | null {
  if (price === null || allTimeHigh === null || allTimeHigh <= 0) return null;
  return ((price - allTimeHigh) / allTimeHigh) * 100;
}
