-- Portal sesi terpisah, izin tim, dan status akun operator.

ALTER TABLE demo_sessions ADD COLUMN portal TEXT NOT NULL DEFAULT 'buyer' CHECK (portal IN ('buyer', 'operator'));
CREATE INDEX idx_sessions_portal ON demo_sessions (portal, expires_at);

ALTER TABLE users ADD COLUMN permissions TEXT NOT NULL DEFAULT '["orders.view","orders.ready","orders.complete"]'
  CHECK (json_valid(permissions));
ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1));

-- Sesi lama tetap buyer; operator lama tidak dapat dipakai tanpa cookie portal operator.
UPDATE demo_sessions SET portal = 'buyer' WHERE portal IS NULL;
