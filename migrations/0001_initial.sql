CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  coin_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT,
  currency TEXT NOT NULL DEFAULT 'usd',
  buy_reference TEXT NOT NULL CHECK (buy_reference IN ('ath', 'purchase')),
  buy_offset TEXT NOT NULL CHECK (buy_offset IN ('below', 'above')),
  buy_percent REAL NOT NULL CHECK (buy_percent >= 0 AND buy_percent < 100),
  sell_reference TEXT NOT NULL CHECK (sell_reference IN ('ath', 'purchase')),
  sell_offset TEXT NOT NULL CHECK (sell_offset IN ('below', 'above')),
  sell_percent REAL NOT NULL CHECK (sell_percent >= 0 AND sell_percent < 1000),
  purchase_price REAL,
  purchase_quantity REAL,
  purchase_date TEXT,
  status TEXT NOT NULL DEFAULT 'watching_buy' CHECK (status IN ('watching_buy', 'buy_alerted', 'holding', 'sell_alerted', 'paused')),
  resume_status TEXT CHECK (resume_status IN ('watching_buy', 'buy_alerted', 'holding', 'sell_alerted')),
  enabled INTEGER NOT NULL DEFAULT 1,
  check_interval_minutes INTEGER NOT NULL DEFAULT 5 CHECK (check_interval_minutes >= 5),
  last_price REAL,
  all_time_high REAL,
  ath_date TEXT,
  last_checked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_due ON alerts (enabled, last_checked_at);
CREATE INDEX IF NOT EXISTS idx_alerts_coin ON alerts (coin_id);

CREATE TABLE IF NOT EXISTS alert_events (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('buy_signal', 'purchase_recorded', 'sell_signal', 'sold', 'rearmed', 'test_notification')),
  price REAL,
  reference_value REAL,
  target_price REAL,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alert_events_alert ON alert_events (alert_id, created_at DESC);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO app_settings (key, value, updated_at)
VALUES ('last_sweep', '', datetime('now'));

CREATE TABLE IF NOT EXISTS login_attempts (
  ip_hash TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  blocked_until TEXT,
  updated_at TEXT NOT NULL
);
