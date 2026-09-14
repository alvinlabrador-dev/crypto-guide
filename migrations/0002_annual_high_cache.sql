CREATE TABLE IF NOT EXISTS annual_high_cache (
  coin_id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  rows_json TEXT NOT NULL,
  source_symbol TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
