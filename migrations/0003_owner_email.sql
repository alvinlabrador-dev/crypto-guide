ALTER TABLE alerts ADD COLUMN owner_email TEXT NOT NULL DEFAULT 'alvinlabrador.dev@gmail.com';
CREATE INDEX IF NOT EXISTS idx_alerts_owner ON alerts (owner_email);

ALTER TABLE push_subscriptions ADD COLUMN owner_email TEXT NOT NULL DEFAULT 'alvinlabrador.dev@gmail.com';

INSERT OR IGNORE INTO app_settings (key, value, updated_at)
SELECT 'last_sweep:alvinlabrador.dev@gmail.com', value, updated_at
FROM app_settings
WHERE key = 'last_sweep' AND value != '';
