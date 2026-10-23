-- Akun pembeli, sesi berakun, mapping fakultas, dan konfigurasi paket per fakultas.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'staff', 'admin')),
  name TEXT NOT NULL DEFAULT '' CHECK (length(name) <= 80),
  whatsapp TEXT NOT NULL DEFAULT '',
  faculty_id TEXT REFERENCES faculties(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (email = lower(email))
);

-- Sesi lama tetap ada untuk data legacy; sesi akun menambahkan user_id.
ALTER TABLE demo_sessions ADD COLUMN user_id TEXT REFERENCES users(id);
CREATE INDEX idx_sessions_user ON demo_sessions (user_id, created_at);

ALTER TABLE orders ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE orders ADD COLUMN faculty_id TEXT REFERENCES faculties(id);
CREATE INDEX idx_orders_user ON orders (user_id, created_at);

ALTER TABLE reviews ADD COLUMN user_id TEXT REFERENCES users(id);

-- Label fakultas pada sumber (FIS/FISH, FIK/FIKK, FPPsi/FPSI) menunjuk satu identitas internal.
CREATE TABLE faculty_aliases (
  alias TEXT PRIMARY KEY,
  faculty_id TEXT NOT NULL REFERENCES faculties(id)
);

-- Produk beridentitas fakultas: varian mana yang sah untuk fakultas mana.
CREATE TABLE variant_faculties (
  variant_id TEXT NOT NULL REFERENCES variants(id),
  faculty_id TEXT NOT NULL REFERENCES faculties(id),
  PRIMARY KEY (variant_id, faculty_id)
);
CREATE INDEX idx_variant_faculties_faculty ON variant_faculties (faculty_id, variant_id);

-- Konfigurasi paket per fakultas: harga dan status publish ditetapkan admin.
CREATE TABLE bundle_configs (
  id TEXT PRIMARY KEY,
  bundle_product_id TEXT NOT NULL REFERENCES products(id),
  faculty_id TEXT NOT NULL REFERENCES faculties(id),
  price_rp INTEGER NOT NULL CHECK (price_rp > 0),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (bundle_product_id, faculty_id)
);
CREATE INDEX idx_bundle_configs_published ON bundle_configs (bundle_product_id, published);

CREATE TABLE bundle_config_components (
  config_id TEXT NOT NULL REFERENCES bundle_configs(id),
  variant_id TEXT NOT NULL REFERENCES variants(id),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  PRIMARY KEY (config_id, variant_id)
);

-- Seed role tidak boleh menimpa akun dengan role berbeda.
CREATE TRIGGER trg_seed_role_guard BEFORE INSERT ON users
WHEN EXISTS (SELECT 1 FROM users u WHERE u.email = NEW.email AND u.role <> NEW.role)
BEGIN
  SELECT RAISE(ABORT, 'seed_role_conflict');
END;

-- Ulasan terikat akun pemilik order.
DROP TRIGGER trg_review_eligibility;
CREATE TRIGGER trg_review_eligibility BEFORE INSERT ON reviews
WHEN NEW.is_example = 0 AND (
  SELECT COUNT(*) FROM orders
  WHERE id = NEW.order_id AND user_id = NEW.user_id
    AND payment_status = 'PAID' AND fulfillment_status = 'PICKED_UP'
) = 0
BEGIN
  SELECT RAISE(ABORT, 'review_not_allowed');
END;
