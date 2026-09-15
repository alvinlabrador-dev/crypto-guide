import webpush from "web-push";
import { z } from "zod";
import { calculateTarget } from "../shared/rules";
import type {
  Alert,
  AlertEvent,
  AlertEventType,
  AlertStatus,
  AnnualHigh,
  AnnualHighHistory,
  BootstrapData,
  CoinSearchResult,
  OffsetDirection,
  ReferenceKind,
} from "../shared/types";

const SESSION_COOKIE = "driftline_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const COINLORE_BASE_URL = "https://api.coinlore.net/api";
const YAHOO_CHART_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const ANNUAL_HIGH_CACHE_MS = 6 * 60 * 60 * 1000;
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

const referenceSchema = z.enum(["ath", "purchase"]);
const offsetSchema = z.enum(["below", "above"]);
const priceRuleSchema = z.object({
  reference: referenceSchema,
  offset: offsetSchema,
  percent: z.number().finite().min(0).max(999),
});

const createAlertSchema = z.object({
  coinId: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/),
  symbol: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  imageUrl: z.string().url().max(600).nullable().optional(),
  buyRule: priceRuleSchema,
  sellRule: priceRuleSchema,
  purchasePrice: z.number().finite().positive().nullable().optional(),
  purchaseQuantity: z.number().finite().positive().nullable().optional(),
  purchaseDate: z.string().date().nullable().optional(),
  checkIntervalMinutes: z.number().int().min(5).max(1440),
  trackFrom: z.enum(["watching_buy", "holding"]),
}).superRefine((value, context) => {
  if (value.trackFrom === "holding" && !value.purchasePrice) {
    context.addIssue({ code: "custom", path: ["purchasePrice"], message: "Purchase price is required for an existing holding." });
  }
  if (value.buyRule.reference === "purchase" && !value.purchasePrice) {
    context.addIssue({ code: "custom", path: ["purchasePrice"], message: "Purchase price is required for this buy comparison." });
  }
});

const updateAlertSchema = z.object({
  buyRule: priceRuleSchema.optional(),
  sellRule: priceRuleSchema.optional(),
  checkIntervalMinutes: z.number().int().min(5).max(1440).optional(),
}).refine((value) => Object.keys(value).length > 0, "No changes supplied.");

const purchaseSchema = z.object({
  price: z.number().finite().positive(),
  quantity: z.number().finite().positive().nullable().optional(),
  date: z.string().date().nullable().optional(),
});

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

const coinAssetsResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    symbol: z.string(),
    name: z.string(),
    rank: z.coerce.number().nullable().optional(),
  })),
});

const tickerResponseSchema = z.array(z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  price_usd: z.string(),
}));

const coinInfoResponseSchema = z.array(z.object({
  id: z.string(),
  ath: z.coerce.number().nullable(),
  ath_date: z.string().nullable(),
}));

const annualHighRowsSchema = z.array(z.object({
  year: z.number().int(),
  high: z.number().finite().positive(),
  highDate: z.string().date(),
}));

const yahooChartResponseSchema = z.object({
  chart: z.object({
    result: z.array(z.object({
      meta: z.object({ symbol: z.string() }),
      timestamp: z.array(z.number()).optional(),
      indicators: z.object({
        quote: z.array(z.object({
          high: z.array(z.number().nullable()),
        })),
      }),
    })).nullable(),
    error: z.object({ description: z.string().optional() }).nullable(),
  }),
});

interface MarketData {
  id: string;
  current_price: number | null;
  ath: number | null;
  ath_date: string | null;
}

interface AlertRow {
  id: string;
  coin_id: string;
  symbol: string;
  name: string;
  image_url: string | null;
  currency: string;
  buy_reference: ReferenceKind;
  buy_offset: OffsetDirection;
  buy_percent: number;
  sell_reference: ReferenceKind;
  sell_offset: OffsetDirection;
  sell_percent: number;
  purchase_price: number | null;
  purchase_quantity: number | null;
  purchase_date: string | null;
  status: AlertStatus;
  resume_status: Exclude<AlertStatus, "paused"> | null;
  enabled: number;
  check_interval_minutes: number;
  last_price: number | null;
  all_time_high: number | null;
  ath_date: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

interface EventRow {
  id: string;
  alert_id: string;
  coin_name: string;
  coin_symbol: string;
  event_type: AlertEventType;
  price: number | null;
  reference_value: number | null;
  target_price: number | null;
  note: string | null;
  created_at: string;
}

interface PushRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface AnnualHighCacheRow {
  symbol: string;
  rows_json: string;
  source_symbol: string;
  fetched_at: string;
}

interface SessionPayload {
  expiresAt: number;
}

interface SweepNotification {
  title: string;
  body: string;
  tag: string;
  alertId: string;
}

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...JSON_HEADERS, ...init.headers },
  });
}

function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

function base64UrlEncode(value: string | ArrayBuffer): string {
  const bytes = typeof value === "string"
    ? new TextEncoder().encode(value)
    : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  return atob(padded);
}

async function hmac(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64UrlEncode(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function secureEqual(first: string, second: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [firstHash, secondHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(first)),
    crypto.subtle.digest("SHA-256", encoder.encode(second)),
  ]);
  const firstBytes = new Uint8Array(firstHash);
  const secondBytes = new Uint8Array(secondHash);
  let difference = 0;
  for (let index = 0; index < firstBytes.length; index += 1) {
    difference |= (firstBytes[index] ?? 0) ^ (secondBytes[index] ?? 0);
  }
  return difference === 0;
}

async function createSession(secret: string): Promise<string> {
  const payload: SessionPayload = { expiresAt: Date.now() + SESSION_SECONDS * 1000 };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${await hmac(encoded, secret)}`;
}

async function verifySession(token: string | null, secret: string | undefined): Promise<boolean> {
  if (!token || !secret) return false;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return false;
  const expected = await hmac(encoded, secret);
  if (!(await secureEqual(signature, expected))) return false;
  try {
    const parsed = JSON.parse(base64UrlDecode(encoded)) as Partial<SessionPayload>;
    return typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now();
  } catch {
    return false;
  }
}

function isLocalHttpHost(host: string): boolean {
  const hostname = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isLocalHttpOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && isLocalHttpHost(url.host);
  } catch {
    return false;
  }
}

function localDevEnabled(env: Env): boolean {
  return String((env as Env & { LOCAL_DEV?: string }).LOCAL_DEV ?? "") === "1";
}

function assertSameOrigin(request: Request, env: Env): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("Origin");
  if (!origin) return;
  const requestOrigin = new URL(request.url).origin;
  if (origin === requestOrigin) return;
  if (localDevEnabled(env) && isLocalHttpOrigin(origin)) return;
  throw new HttpError(403, "Request origin is not allowed.");
}

function sessionCookie(value: string, request: Request, maxAge: number): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=${maxAge}`;
}

async function parseJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "Expected a JSON request body.");
  }
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > 32_768) throw new HttpError(413, "Request body is too large.");
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Request body is not valid JSON.");
  }
}

function alertFromRow(row: AlertRow): Alert {
  return {
    id: row.id,
    coinId: row.coin_id,
    symbol: row.symbol,
    name: row.name,
    imageUrl: row.image_url,
    currency: row.currency,
    buyRule: { reference: row.buy_reference, offset: row.buy_offset, percent: row.buy_percent },
    sellRule: { reference: row.sell_reference, offset: row.sell_offset, percent: row.sell_percent },
    purchasePrice: row.purchase_price,
    purchaseQuantity: row.purchase_quantity,
    purchaseDate: row.purchase_date,
    status: row.status,
    enabled: row.enabled === 1,
    checkIntervalMinutes: row.check_interval_minutes,
    lastPrice: row.last_price,
    allTimeHigh: row.all_time_high,
    athDate: row.ath_date,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function eventFromRow(row: EventRow): AlertEvent {
  return {
    id: row.id,
    alertId: row.alert_id,
    coinName: row.coin_name,
    coinSymbol: row.coin_symbol,
    eventType: row.event_type,
    price: row.price,
    referenceValue: row.reference_value,
    targetPrice: row.target_price,
    note: row.note,
    createdAt: row.created_at,
  };
}

function priceProviderHeaders(): HeadersInit {
  return {
    "Accept": "application/json",
    "User-Agent": "Driftline/0.1 (personal crypto alerts)",
  };
}

async function fetchCoinSearch(query: string): Promise<CoinSearchResult[]> {
  const response = await fetch(`${COINLORE_BASE_URL}/assets/`, { headers: priceProviderHeaders() });
  if (!response.ok) throw new HttpError(502, `Price provider returned ${response.status}.`);
  const parsed = coinAssetsResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new HttpError(502, "Price provider returned an unexpected response.");
  const normalizedQuery = query.trim().toLowerCase();
  return parsed.data.data
    .map((coin) => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      thumb: null,
      marketCapRank: coin.rank ?? null,
    } satisfies CoinSearchResult))
    .filter((coin) => coin.symbol.toLowerCase().includes(normalizedQuery) || coin.name.toLowerCase().includes(normalizedQuery))
    .sort((first, second) => (first.marketCapRank ?? 99999) - (second.marketCapRank ?? 99999))
    .slice(0, 12);
}

async function fetchMarkets(coinIds: string[]): Promise<Map<string, MarketData>> {
  const response = await fetch(`${COINLORE_BASE_URL}/ticker/?id=${encodeURIComponent(coinIds.join(","))}`, {
    headers: priceProviderHeaders(),
  });
  if (!response.ok) throw new HttpError(502, `Price provider returned ${response.status}.`);
  const parsed = tickerResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new HttpError(502, "Price provider returned an unexpected response.");
  return new Map(parsed.data.map((ticker) => {
    const price = Number(ticker.price_usd);
    return [ticker.id, {
      id: ticker.id,
      current_price: Number.isFinite(price) ? price : null,
      ath: null,
      ath_date: null,
    }];
  }));
}

async function fetchHistoricalAth(coinId: string): Promise<{ ath: number; athDate: string } | null> {
  const response = await fetch(`${COINLORE_BASE_URL}/coin/info/?id=${encodeURIComponent(coinId)}`, {
    headers: priceProviderHeaders(),
  });
  if (!response.ok) throw new HttpError(502, `Price provider returned ${response.status}.`);
  const parsed = coinInfoResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new HttpError(502, "Price provider returned an unexpected response.");
  const coin = parsed.data[0];
  return coin?.ath && coin.ath > 0 && coin.ath_date ? { ath: coin.ath, athDate: coin.ath_date } : null;
}

async function getAnnualHighHistory(env: Env, alert: AlertRow): Promise<AnnualHighHistory> {
  const symbol = alert.symbol.toUpperCase();
  const cached = await env.DB.prepare(`
    SELECT symbol, rows_json, source_symbol, fetched_at
    FROM annual_high_cache
    WHERE coin_id = ?
  `).bind(alert.coin_id).first<AnnualHighCacheRow>();

  if (cached && cached.symbol === symbol && Date.parse(cached.fetched_at) > Date.now() - ANNUAL_HIGH_CACHE_MS) {
    const rows = annualHighRowsSchema.safeParse(JSON.parse(cached.rows_json));
    if (rows.success) {
      return {
        rows: rows.data,
        source: "Yahoo Finance",
        sourceSymbol: cached.source_symbol,
        fetchedAt: cached.fetched_at,
      };
    }
  }

  const currentYear = new Date().getUTCFullYear();
  const firstYear = currentYear - 4;
  const sourceSymbol = `${symbol}-USD`;
  const period1 = Math.floor(Date.UTC(firstYear, 0, 1) / 1000);
  const period2 = Math.floor(Date.now() / 1000) + 86_400;
  const response = await fetch(
    `${YAHOO_CHART_BASE_URL}/${encodeURIComponent(sourceSymbol)}?period1=${period1}&period2=${period2}&interval=1d&events=history`,
    { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; Driftline/0.1)" } },
  );
  if (response.status === 404) throw new HttpError(422, `Five-year history is unavailable for ${symbol}.`);
  if (!response.ok) throw new HttpError(502, `Historical data provider returned ${response.status}.`);

  const parsed = yahooChartResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new HttpError(502, "Historical data provider returned an unexpected response.");
  const result = parsed.data.chart.result?.[0];
  const timestamps = result?.timestamp;
  const highs = result?.indicators.quote[0]?.high;
  if (!result || !timestamps || !highs || parsed.data.chart.error) {
    throw new HttpError(422, `Five-year history is unavailable for ${symbol}.`);
  }

  const highsByYear = new Map<number, AnnualHigh>();
  for (let index = 0; index < timestamps.length; index += 1) {
    const timestamp = timestamps[index];
    const high = highs[index];
    if (timestamp === undefined || high === null || high === undefined || !Number.isFinite(high) || high <= 0) continue;
    const highDate = new Date(timestamp * 1000).toISOString().slice(0, 10);
    const year = Number(highDate.slice(0, 4));
    if (year < firstYear || year > currentYear) continue;
    const existing = highsByYear.get(year);
    if (!existing || high > existing.high) highsByYear.set(year, { year, high, highDate });
  }

  const rows = [...highsByYear.values()].sort((first, second) => second.year - first.year);
  if (rows.length === 0) throw new HttpError(422, `Five-year history is unavailable for ${symbol}.`);

  const fetchedAt = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO annual_high_cache (coin_id, symbol, rows_json, source_symbol, fetched_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(coin_id) DO UPDATE SET
      symbol = excluded.symbol,
      rows_json = excluded.rows_json,
      source_symbol = excluded.source_symbol,
      fetched_at = excluded.fetched_at
  `).bind(alert.coin_id, symbol, JSON.stringify(rows), result.meta.symbol, fetchedAt).run();

  return { rows, source: "Yahoo Finance", sourceSymbol: result.meta.symbol, fetchedAt };
}

async function getAlert(env: Env, id: string): Promise<AlertRow> {
  const row = await env.DB.prepare("SELECT * FROM alerts WHERE id = ?").bind(id).first<AlertRow>();
  if (!row) throw new HttpError(404, "Alert was not found.");
  return row;
}

async function getBootstrap(env: Env): Promise<BootstrapData> {
  const [alertsResult, eventsResult, lastSweep] = await Promise.all([
    env.DB.prepare("SELECT * FROM alerts ORDER BY created_at DESC").all<AlertRow>(),
    env.DB.prepare(`
      SELECT e.*, a.name AS coin_name, a.symbol AS coin_symbol
      FROM alert_events e
      JOIN alerts a ON a.id = e.alert_id
      ORDER BY e.created_at DESC
      LIMIT 50
    `).all<EventRow>(),
    env.DB.prepare("SELECT value FROM app_settings WHERE key = 'last_sweep'").first<{ value: string }>(),
  ]);
  return {
    alerts: alertsResult.results.map(alertFromRow),
    events: eventsResult.results.map(eventFromRow),
    lastSweep: lastSweep?.value || null,
    vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null,
    pushConfigured: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT),
  };
}

async function sendPush(env: Env, notification: SweepNotification): Promise<number> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return 0;
  const subscriptions = await env.DB.prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions").all<PushRow>();
  if (subscriptions.results.length === 0) return 0;

  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const deadEndpoints: string[] = [];
  let delivered = 0;
  await Promise.all(subscriptions.results.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify({ ...notification, url: `/?alert=${notification.alertId}` }),
        { TTL: 60 * 60, urgency: "high" },
      );
      delivered += 1;
    } catch (error: unknown) {
      const statusCode = error instanceof webpush.WebPushError ? error.statusCode : 0;
      if (statusCode === 404 || statusCode === 410) deadEndpoints.push(subscription.endpoint);
      console.error(JSON.stringify({ message: "push delivery failed", statusCode, endpointHost: new URL(subscription.endpoint).host }));
    }
  }));

  if (deadEndpoints.length > 0) {
    await env.DB.batch(deadEndpoints.map((endpoint) =>
      env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint)
    ));
  }
  return delivered;
}

async function runSweep(env: Env): Promise<{ checked: number; signaled: number; checkedAt: string }> {
  const now = new Date();
  const checkedAt = now.toISOString();
  const result = await env.DB.prepare(`
    SELECT * FROM alerts
    WHERE enabled = 1
      AND status IN ('watching_buy', 'holding')
      AND (last_checked_at IS NULL OR datetime(last_checked_at, '+' || check_interval_minutes || ' minutes') <= datetime(?))
    ORDER BY created_at ASC
    LIMIT 200
  `).bind(checkedAt).all<AlertRow>();

  const dueAlerts = result.results;
  if (dueAlerts.length === 0) {
    return { checked: 0, signaled: 0, checkedAt };
  }

  const markets = await fetchMarkets([...new Set(dueAlerts.map((alert) => alert.coin_id))]);
  const athByCoin = new Map<string, { ath: number; athDate: string }>();
  for (const alert of dueAlerts) {
    if (alert.all_time_high && alert.all_time_high > (athByCoin.get(alert.coin_id)?.ath ?? 0)) {
      athByCoin.set(alert.coin_id, {
        ath: alert.all_time_high,
        athDate: alert.ath_date ?? checkedAt,
      });
    }
  }
  const missingAthIds = [...new Set(dueAlerts.map((alert) => alert.coin_id))]
    .filter((coinId) => !athByCoin.has(coinId));
  const historicalAths = await Promise.all(missingAthIds.map(async (coinId) => ({
    coinId,
    result: await fetchHistoricalAth(coinId),
  })));
  for (const { coinId, result: historicalAth } of historicalAths) {
    if (historicalAth) athByCoin.set(coinId, historicalAth);
  }
  const statements: D1PreparedStatement[] = [];
  const notifications: SweepNotification[] = [];

  for (const alert of dueAlerts) {
    const market = markets.get(alert.coin_id);
    if (!market || market.current_price === null) continue;
    const price = market.current_price;
    const knownAth = athByCoin.get(alert.coin_id);
    const allTimeHigh = Math.max(knownAth?.ath ?? 0, price);
    const athDate = price > (knownAth?.ath ?? 0) ? checkedAt : knownAth?.athDate ?? checkedAt;
    const rule = alert.status === "holding"
      ? { reference: alert.sell_reference, offset: alert.sell_offset, percent: alert.sell_percent }
      : { reference: alert.buy_reference, offset: alert.buy_offset, percent: alert.buy_percent };
    const target = calculateTarget(rule, allTimeHigh, alert.purchase_price);
    const referenceValue = rule.reference === "ath" ? allTimeHigh : alert.purchase_price;
    const isTriggered = target !== null && (alert.status === "holding" ? price >= target : price <= target);
    const nextStatus: AlertStatus = isTriggered
      ? alert.status === "holding" ? "sell_alerted" : "buy_alerted"
      : alert.status;

    statements.push(env.DB.prepare(`
      UPDATE alerts
      SET last_price = ?, all_time_high = ?, ath_date = ?, last_checked_at = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).bind(price, allTimeHigh, athDate, checkedAt, nextStatus, checkedAt, alert.id));

    if (isTriggered) {
      const isSell = alert.status === "holding";
      const eventType: AlertEventType = isSell ? "sell_signal" : "buy_signal";
      const note = `${isSell ? "Sell" : "Buy"} target reached at ${formatUsd(price)}.`;
      statements.push(env.DB.prepare(`
        INSERT INTO alert_events (id, alert_id, event_type, price, reference_value, target_price, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), alert.id, eventType, price, referenceValue, target, note, checkedAt));
      notifications.push({
        title: `${isSell ? "Sell" : "Buy"} signal · ${alert.symbol.toUpperCase()}`,
        body: `${alert.name} is ${formatUsd(price)}. Target ${formatUsd(target)} has been reached.`,
        tag: `${eventType}-${alert.id}`,
        alertId: alert.id,
      });
    }
  }

  statements.push(env.DB.prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES ('last_sweep', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).bind(checkedAt, checkedAt));
  await env.DB.batch(statements);
  await Promise.all(notifications.map((notification) => sendPush(env, notification)));

  console.log(JSON.stringify({ message: "price sweep complete", checked: dueAlerts.length, signaled: notifications.length, checkedAt }));
  return { checked: dueAlerts.length, signaled: notifications.length, checkedAt };
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumSignificantDigits: 8 }).format(value);
}

async function checkLoginRateLimit(request: Request, env: Env): Promise<string> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  const ipHash = base64UrlEncode(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip)));
  const row = await env.DB.prepare("SELECT failures, blocked_until FROM login_attempts WHERE ip_hash = ?").bind(ipHash)
    .first<{ failures: number; blocked_until: string | null }>();
  if (row?.blocked_until && Date.parse(row.blocked_until) > Date.now()) {
    throw new HttpError(429, "Too many login attempts. Try again in 15 minutes.");
  }
  return ipHash;
}

async function recordLoginFailure(env: Env, ipHash: string): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO login_attempts (ip_hash, failures, blocked_until, updated_at)
    VALUES (?, 1, NULL, ?)
    ON CONFLICT(ip_hash) DO UPDATE SET
      failures = CASE WHEN login_attempts.updated_at < datetime('now', '-15 minutes') THEN 1 ELSE login_attempts.failures + 1 END,
      blocked_until = CASE WHEN login_attempts.failures + 1 >= 5 THEN datetime('now', '+15 minutes') ELSE NULL END,
      updated_at = excluded.updated_at
  `).bind(ipHash, now).run();
}

async function routeApi(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  assertSameOrigin(request, env);

  if (url.pathname === "/api/auth/session" && request.method === "GET") {
    const authenticated = await verifySession(getCookie(request, SESSION_COOKIE), env.SESSION_SECRET);
    return json({ authenticated, configured: Boolean(env.APP_PASSWORD && env.SESSION_SECRET) });
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    if (!env.APP_PASSWORD || !env.SESSION_SECRET) throw new HttpError(503, "App login is not configured yet.");
    const ipHash = await checkLoginRateLimit(request, env);
    const input = z.object({ password: z.string().min(1).max(256) }).safeParse(await parseJson(request));
    if (!input.success || !(await secureEqual(input.data.password, env.APP_PASSWORD))) {
      await recordLoginFailure(env, ipHash);
      throw new HttpError(401, "Password is incorrect.");
    }
    await env.DB.prepare("DELETE FROM login_attempts WHERE ip_hash = ?").bind(ipHash).run();
    const token = await createSession(env.SESSION_SECRET);
    return json({ authenticated: true }, {
      headers: {
        "Set-Cookie": sessionCookie(token, request, SESSION_SECONDS),
      },
    });
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    return json({ authenticated: false }, {
      headers: { "Set-Cookie": sessionCookie("", request, 0) },
    });
  }

  if (!(await verifySession(getCookie(request, SESSION_COOKIE), env.SESSION_SECRET))) {
    throw new HttpError(401, "Sign in to continue.");
  }

  if (url.pathname === "/api/bootstrap" && request.method === "GET") {
    return json(await getBootstrap(env));
  }

  if (url.pathname === "/api/coins/search" && request.method === "GET") {
    const query = z.string().trim().min(2).max(80).safeParse(url.searchParams.get("q"));
    if (!query.success) throw new HttpError(400, "Enter at least two characters.");
    return json({ coins: await fetchCoinSearch(query.data) });
  }

  if (url.pathname === "/api/alerts" && request.method === "POST") {
    const input = createAlertSchema.safeParse(await parseJson(request));
    if (!input.success) throw new HttpError(400, input.error.issues[0]?.message ?? "Alert details are invalid.");
    const value = input.data;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(`
      INSERT INTO alerts (
        id, coin_id, symbol, name, image_url, currency,
        buy_reference, buy_offset, buy_percent,
        sell_reference, sell_offset, sell_percent,
        purchase_price, purchase_quantity, purchase_date,
        status, enabled, check_interval_minutes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'usd', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).bind(
      id, value.coinId, value.symbol.toUpperCase(), value.name, value.imageUrl ?? null,
      value.buyRule.reference, value.buyRule.offset, value.buyRule.percent,
      value.sellRule.reference, value.sellRule.offset, value.sellRule.percent,
      value.purchasePrice ?? null, value.purchaseQuantity ?? null, value.purchaseDate ?? null,
      value.trackFrom, value.checkIntervalMinutes, now, now,
    ).run();
    ctx.waitUntil(runSweep(env).catch((error: unknown) => {
      console.error(JSON.stringify({ message: "post-create sweep failed", error: error instanceof Error ? error.message : String(error) }));
    }));
    return json({ alert: alertFromRow(await getAlert(env, id)) }, { status: 201 });
  }

  if (url.pathname === "/api/refresh" && request.method === "POST") {
    await env.DB.prepare("UPDATE alerts SET last_checked_at = NULL WHERE enabled = 1").run();
    return json(await runSweep(env));
  }

  if (url.pathname === "/api/push/subscribe" && request.method === "POST") {
    const input = pushSubscriptionSchema.safeParse(await parseJson(request));
    if (!input.success) throw new HttpError(400, "Push subscription is invalid.");
    const now = new Date().toISOString();
    await env.DB.prepare(`
      INSERT INTO push_subscriptions (endpoint, p256dh, auth, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, updated_at = excluded.updated_at
    `).bind(input.data.endpoint, input.data.keys.p256dh, input.data.keys.auth, now, now).run();
    return json({ subscribed: true });
  }

  if (url.pathname === "/api/push/subscribe" && request.method === "DELETE") {
    const input = z.object({ endpoint: z.string().url().max(2048) }).safeParse(await parseJson(request));
    if (!input.success) throw new HttpError(400, "Push subscription is invalid.");
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(input.data.endpoint).run();
    return json({ subscribed: false });
  }

  if (url.pathname === "/api/push/test" && request.method === "POST") {
    const delivered = await sendPush(env, {
      title: "Driftline is listening",
      body: "Push notifications are ready for buy and sell signals.",
      tag: "driftline-test",
      alertId: "",
    });
    return json({ delivered });
  }

  const alertMatch = url.pathname.match(/^\/api\/alerts\/([a-f0-9-]+)(?:\/(.+))?$/);
  if (alertMatch) {
    const id = alertMatch[1];
    const action = alertMatch[2] ?? null;
    if (!id) throw new HttpError(400, "Alert id is invalid.");

    if (!action && request.method === "PATCH") {
      const current = await getAlert(env, id);
      const input = updateAlertSchema.safeParse(await parseJson(request));
      if (!input.success) throw new HttpError(400, input.error.issues[0]?.message ?? "Alert details are invalid.");
      const buyRule = input.data.buyRule ?? { reference: current.buy_reference, offset: current.buy_offset, percent: current.buy_percent };
      const sellRule = input.data.sellRule ?? { reference: current.sell_reference, offset: current.sell_offset, percent: current.sell_percent };
      if (buyRule.reference === "purchase" && !current.purchase_price) {
        throw new HttpError(400, "Record a purchase price before using it as the buy reference.");
      }
      const now = new Date().toISOString();
      await env.DB.prepare(`
        UPDATE alerts SET
          buy_reference = ?, buy_offset = ?, buy_percent = ?,
          sell_reference = ?, sell_offset = ?, sell_percent = ?,
          check_interval_minutes = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        buyRule.reference, buyRule.offset, buyRule.percent,
        sellRule.reference, sellRule.offset, sellRule.percent,
        input.data.checkIntervalMinutes ?? current.check_interval_minutes, now, id,
      ).run();
      return json({ alert: alertFromRow(await getAlert(env, id)) });
    }

    if (!action && request.method === "DELETE") {
      await getAlert(env, id);
      await env.DB.prepare("DELETE FROM alerts WHERE id = ?").bind(id).run();
      return json({ deleted: true });
    }

    const alert = await getAlert(env, id);
    const now = new Date().toISOString();
    if (action === "annual-highs" && request.method === "GET") {
      return json(await getAnnualHighHistory(env, alert));
    }

    if (action === "mark-bought" && request.method === "POST") {
      const input = purchaseSchema.safeParse(await parseJson(request));
      if (!input.success) throw new HttpError(400, input.error.issues[0]?.message ?? "Purchase details are invalid.");
      await env.DB.batch([
        env.DB.prepare(`
          UPDATE alerts SET purchase_price = ?, purchase_quantity = ?, purchase_date = ?, status = 'holding', enabled = 1,
            resume_status = NULL, last_checked_at = NULL, updated_at = ? WHERE id = ?
        `).bind(input.data.price, input.data.quantity ?? null, input.data.date ?? null, now, id),
        env.DB.prepare(`
          INSERT INTO alert_events (id, alert_id, event_type, price, note, created_at)
          VALUES (?, ?, 'purchase_recorded', ?, ?, ?)
        `).bind(crypto.randomUUID(), id, input.data.price, `Purchase recorded at ${formatUsd(input.data.price)}.`, now),
      ]);
      return json({ alert: alertFromRow(await getAlert(env, id)) });
    }

    if (action === "mark-sold" && request.method === "POST") {
      const sale = z.object({ price: z.number().finite().positive().nullable().optional() }).safeParse(await parseJson(request));
      if (!sale.success) throw new HttpError(400, "Sale price is invalid.");
      await env.DB.batch([
        env.DB.prepare(`
          UPDATE alerts SET status = 'watching_buy', enabled = 1, resume_status = NULL,
            purchase_price = NULL, purchase_quantity = NULL, purchase_date = NULL,
            last_checked_at = NULL, updated_at = ? WHERE id = ?
        `).bind(now, id),
        env.DB.prepare(`
          INSERT INTO alert_events (id, alert_id, event_type, price, note, created_at)
          VALUES (?, ?, 'sold', ?, ?, ?)
        `).bind(crypto.randomUUID(), id, sale.data.price ?? alert.last_price, "Position marked sold; buy watch re-armed.", now),
      ]);
      return json({ alert: alertFromRow(await getAlert(env, id)) });
    }

    if (action === "rearm" && request.method === "POST") {
      await env.DB.batch([
        env.DB.prepare("UPDATE alerts SET status = 'watching_buy', enabled = 1, resume_status = NULL, last_checked_at = NULL, updated_at = ? WHERE id = ?").bind(now, id),
        env.DB.prepare("INSERT INTO alert_events (id, alert_id, event_type, note, created_at) VALUES (?, ?, 'rearmed', 'Buy watch re-armed.', ?)").bind(crypto.randomUUID(), id, now),
      ]);
      return json({ alert: alertFromRow(await getAlert(env, id)) });
    }

    if (action === "pause" && request.method === "POST") {
      if (alert.status !== "paused") {
        await env.DB.prepare("UPDATE alerts SET status = 'paused', resume_status = ?, enabled = 0, updated_at = ? WHERE id = ?")
          .bind(alert.status, now, id).run();
      }
      return json({ alert: alertFromRow(await getAlert(env, id)) });
    }

    if (action === "resume" && request.method === "POST") {
      const resumeStatus = alert.resume_status ?? "watching_buy";
      await env.DB.prepare("UPDATE alerts SET status = ?, resume_status = NULL, enabled = 1, last_checked_at = NULL, updated_at = ? WHERE id = ?")
        .bind(resumeStatus, now, id).run();
      return json({ alert: alertFromRow(await getAlert(env, id)) });
    }
  }

  throw new HttpError(404, "API route was not found.");
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await routeApi(request, env, ctx);
    } catch (error: unknown) {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof HttpError ? error.message : "Internal server error.";
      console.error(JSON.stringify({
        message: "request failed",
        error: error instanceof Error ? error.message : String(error),
        method: request.method,
        path: new URL(request.url).pathname,
        status,
      }));
      return json({ error: message }, { status });
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      await runSweep(env);
    } catch (error: unknown) {
      console.error(JSON.stringify({ message: "scheduled sweep failed", error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;
