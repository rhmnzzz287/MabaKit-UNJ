-- Profil pembeli, snapshot email order, ulasan, dan pencabutan operator demo.
ALTER TABLE orders ADD COLUMN email TEXT;
ALTER TABLE demo_operators ADD COLUMN revoked_at INTEGER;

CREATE TABLE profiles (
  session_id TEXT PRIMARY KEY REFERENCES demo_sessions(id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  whatsapp TEXT NOT NULL CHECK (length(whatsapp) BETWEEN 8 AND 20),
  email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  updated_at INTEGER NOT NULL
);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  order_id TEXT UNIQUE REFERENCES orders(id),
  session_id TEXT REFERENCES demo_sessions(id),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL CHECK (length(comment) BETWEEN 10 AND 1000),
  is_example INTEGER NOT NULL DEFAULT 0 CHECK (is_example IN (0, 1)),
  created_at INTEGER NOT NULL,
  CHECK ((is_example = 1 AND order_id IS NULL) OR (is_example = 0 AND order_id IS NOT NULL))
);
CREATE INDEX idx_reviews_public ON reviews (is_example, created_at);

-- Ulasan hanya untuk order PAID + PICKED_UP milik sesi yang sama.
CREATE TRIGGER trg_review_eligibility BEFORE INSERT ON reviews
WHEN NEW.is_example = 0 AND (
  SELECT COUNT(*) FROM orders
  WHERE id = NEW.order_id AND session_id = NEW.session_id
    AND payment_status = 'PAID' AND fulfillment_status = 'PICKED_UP'
) = 0
BEGIN
  SELECT RAISE(ABORT, 'review_not_allowed');
END;

-- QR dibatalkan: serah terima dikonfirmasi operator, bukan tiket pickup.
DROP TRIGGER trg_picked_up_guard;
CREATE TRIGGER trg_picked_up_guard BEFORE UPDATE OF fulfillment_status ON orders
WHEN NEW.fulfillment_status = 'PICKED_UP' AND OLD.fulfillment_status <> 'READY'
BEGIN
  SELECT RAISE(ABORT, 'pickup_not_allowed');
END;

-- Ulasan contoh deterministik, bukan testimoni pelanggan nyata.
INSERT OR IGNORE INTO reviews (id, order_id, session_id, display_name, rating, comment, is_example, created_at) VALUES
  ('rev-contoh-1', NULL, NULL, 'Nadia', 5, 'Topinya rapi dan sesuai fakultas. Ambil di lobi juga cepat.', 1, 1760000000000),
  ('rev-contoh-2', NULL, NULL, 'Rizky', 4, 'Paket dasarnya lengkap. Antrean pickup agak ramai saat jam istirahat.', 1, 1760100000000),
  ('rev-contoh-3', NULL, NULL, 'Ayu', 5, 'Status pesanan jelas, jadi tahu kapan barang siap diambil.', 1, 1760200000000);
