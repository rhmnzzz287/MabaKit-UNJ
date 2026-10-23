-- Kunci idempotensi v2 harus per akun, bukan per sesi: login ulang membuat sesi baru
-- sehingga UNIQUE(session_id, checkout_key) tidak lagi mencegah pesanan ganda.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_user_checkout ON orders(user_id, checkout_key) WHERE user_id IS NOT NULL;
