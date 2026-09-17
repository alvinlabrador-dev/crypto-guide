import type { AlertStatus, PriceRule } from "../../shared/types";

export const statusLabels: Record<AlertStatus, string> = {
  watching_buy: "Watching buy",
  buy_alerted: "Buy signal",
  holding: "Holding",
  sell_alerted: "Sell signal",
  paused: "Paused",
};

export function money(value: number | null, currency = "USD"): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumSignificantDigits: value < 1 ? 6 : 8,
  }).format(value);
}

export function relativeTime(value: string | null): string {
  if (!value) return "Not checked yet";
  const diff = Date.now() - Date.parse(value);
  if (diff < 60_000) return "Just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ruleText(rule: PriceRule): string {
  return `${rule.percent}% ${rule.offset} ${rule.reference === "ath" ? "ATH" : "purchase"}`;
}

export function shortDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function signedPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) < 0.05) return "0.0%";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}
