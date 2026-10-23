-- B03: batas dua pesanan gratis per akun per jam ditegakkan di dalam transaksi,
-- bukan hanya dari hasil read sebelum write. Replay idempotensi tetap ditangani lebih dulu di route.
CREATE TRIGGER trg_free_order_limit BEFORE INSERT ON orders
WHEN NEW.amount_due_rp = 0
  AND (
    SELECT COUNT(*) FROM orders
    WHERE user_id = NEW.user_id AND amount_due_rp = 0
      AND created_at > NEW.created_at - 3600000
  ) >= 2
BEGIN
  SELECT RAISE(ABORT, 'free_limit');
END;

-- B04: versi konfigurasi paket naik setiap kali admin menyimpan harga/komponen/published.
ALTER TABLE bundle_configs ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Versi konfigurasi yang diambil checkout, divalidasi ulang di batch bersama baris item.
ALTER TABLE order_items ADD COLUMN bundle_config_version INTEGER;

CREATE TRIGGER trg_item_bundle_config_guard AFTER INSERT ON order_items
WHEN NEW.bundle_config_version IS NOT NULL
  AND (
    SELECT COUNT(*) FROM bundle_configs c
    WHERE c.bundle_product_id = NEW.product_id
      AND c.faculty_id = (SELECT faculty_id FROM orders WHERE id = NEW.order_id)
      AND c.version = NEW.bundle_config_version
      AND c.published = 1
  ) = 0
BEGIN
  SELECT RAISE(ABORT, 'catalog_changed');
END;