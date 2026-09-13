export type ReferenceKind = "ath" | "purchase";
export type OffsetDirection = "below" | "above";
export type AlertStatus =
  | "watching_buy"
  | "buy_alerted"
  | "holding"
  | "sell_alerted"
  | "paused";

export interface PriceRule {
  reference: ReferenceKind;
  offset: OffsetDirection;
  percent: number;
}

export interface Alert {
  id: string;
  coinId: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  currency: string;
  buyRule: PriceRule;
  sellRule: PriceRule;
  purchasePrice: number | null;
  purchaseQuantity: number | null;
  purchaseDate: string | null;
  status: AlertStatus;
  enabled: boolean;
  checkIntervalMinutes: number;
  lastPrice: number | null;
  allTimeHigh: number | null;
  athDate: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AlertEventType =
  | "buy_signal"
  | "purchase_recorded"
  | "sell_signal"
  | "sold"
  | "rearmed"
  | "test_notification";

export interface AlertEvent {
  id: string;
  alertId: string;
  coinName: string;
  coinSymbol: string;
  eventType: AlertEventType;
  price: number | null;
  referenceValue: number | null;
  targetPrice: number | null;
  note: string | null;
  createdAt: string;
}

export interface CoinSearchResult {
  id: string;
  name: string;
  symbol: string;
  thumb: string | null;
  marketCapRank: number | null;
}

export interface AnnualHigh {
  year: number;
  high: number;
  highDate: string;
}

export interface AnnualHighHistory {
  rows: AnnualHigh[];
  source: "Yahoo Finance";
  sourceSymbol: string;
  fetchedAt: string;
}

export interface BootstrapData {
  alerts: Alert[];
  events: AlertEvent[];
  lastSweep: string | null;
  vapidPublicKey: string | null;
  pushConfigured: boolean;
}
