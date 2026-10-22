-- MabaKit demo schema (D1 / SQLite). IDs TEXT UUID, waktu INTEGER unix ms UTC, uang INTEGER rupiah.
PRAGMA foreign_keys = ON;

CREATE TABLE faculties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  faculty_id TEXT NOT NULL REFERENCES faculties(id),
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  UNIQUE (id, faculty_id)
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('single', 'bundle')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_path TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  bundle_price_rp INTEGER CHECK (bundle_price_rp IS NULL OR bundle_price_rp > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK ((kind = 'single' AND bundle_price_rp IS NULL) OR (kind = 'bundle' AND bundle_price_rp IS NOT NULL))
);

CREATE TABLE variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  sku TEXT NOT NULL UNIQUE,
  attributes TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(attributes)),
  price_rp INTEGER NOT NULL CHECK (price_rp > 0),
  stock_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (stock_on_hand >= 0),
  stock_reserved INTEGER NOT NULL DEFAULT 0 CHECK (stock_reserved >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (stock_reserved <= stock_on_hand)
);

CREATE TABLE bundle_components (
  bundle_product_id TEXT NOT NULL REFERENCES products(id),
  variant_id TEXT NOT NULL REFERENCES variants(id),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  PRIMARY KEY (bundle_product_id, variant_id)
);

CREATE TABLE spec_checklists (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  label TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 1 CHECK (required IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE store_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  checkout_enabled INTEGER NOT NULL DEFAULT 0 CHECK (checkout_enabled IN (0, 1)),
  pickup_location_label TEXT NOT NULL DEFAULT '',
  pickup_location_details TEXT NOT NULL DEFAULT '',
  pickup_service_hours TEXT NOT NULL DEFAULT '',
  pickup_version INTEGER NOT NULL DEFAULT 1 CHECK (pickup_version > 0),
  updated_at INTEGER NOT NULL
);

CREATE TABLE demo_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_hash TEXT NOT NULL,
  client_key_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_client ON demo_sessions (client_key_hash, created_at);

CREATE TABLE demo_operators (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES demo_sessions(id),
  role TEXT NOT NULL CHECK (role IN ('staff', 'admin')),
  created_at INTEGER NOT NULL
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL REFERENCES demo_sessions(id),
  checkout_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  department_id TEXT,
  pickup_instructions_snapshot TEXT NOT NULL CHECK (json_valid(pickup_instructions_snapshot)),
  total_rp INTEGER NOT NULL CHECK (total_rp BETWEEN 1 AND 10000000),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('PENDING', 'PAID', 'EXPIRED')),
  fulfillment_status TEXT NOT NULL DEFAULT 'UNFULFILLED'
    CHECK (fulfillment_status IN ('UNFULFILLED', 'READY', 'PICKED_UP', 'CANCELLED')),
  stock_allocation_status TEXT NOT NULL CHECK (stock_allocation_status IN ('HELD', 'CONSUMED', 'RELEASED')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  paid_at INTEGER,
  ready_at INTEGER,
  picked_up_at INTEGER,
  picked_up_by TEXT REFERENCES demo_operators(id),
  UNIQUE (session_id, checkout_key)
);
CREATE INDEX idx_orders_session ON orders (session_id, created_at);
CREATE INDEX idx_orders_status ON orders (payment_status, expires_at);
CREATE INDEX idx_orders_fulfillment ON orders (fulfillment_status, created_at);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  variant_id TEXT REFERENCES variants(id),
  title_snapshot TEXT NOT NULL,
  attributes_snapshot TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(attributes_snapshot)),
  catalog_version INTEGER NOT NULL,
  variant_version INTEGER,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price_rp INTEGER NOT NULL CHECK (unit_price_rp > 0),
  line_total_rp INTEGER NOT NULL,
  CHECK (line_total_rp = quantity * unit_price_rp),
  CHECK ((variant_id IS NULL) = (variant_version IS NULL))
);
CREATE INDEX idx_items_order ON order_items (order_id);

CREATE TABLE order_components (
  order_item_id TEXT NOT NULL REFERENCES order_items(id),
  variant_id TEXT NOT NULL REFERENCES variants(id),
  sku_snapshot TEXT NOT NULL,
  title_snapshot TEXT NOT NULL,
  attributes_snapshot TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(attributes_snapshot)),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (order_item_id, variant_id)
);
CREATE INDEX idx_components_variant ON order_components (variant_id);

CREATE TABLE payments (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  mode TEXT NOT NULL CHECK (mode = 'DEMO'),
  method TEXT NOT NULL CHECK (method IN ('BANK_TRANSFER', 'EWALLET', 'QRIS')),
  confirmed_at INTEGER
);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  invoice_number TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL CHECK (mode = 'DEMO'),
  issued_at INTEGER NOT NULL
);

CREATE TABLE pickup_tickets (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  token_hash TEXT NOT NULL UNIQUE,
  issued_at INTEGER NOT NULL,
  claimed_at INTEGER,
  claimed_by TEXT REFERENCES demo_operators(id)
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  safe_metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(safe_metadata)),
  request_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_audit_entity ON audit_logs (entity_id, created_at);

CREATE TABLE rate_limits (
  scope TEXT NOT NULL,
  actor_key_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (scope, actor_key_hash, window_start)
);

-- ===================== guards =====================

-- Sesi demo: maksimum 10 per IP hash per menit.
CREATE TRIGGER trg_session_rate BEFORE INSERT ON demo_sessions
WHEN (
  SELECT COUNT(*) FROM demo_sessions
  WHERE client_key_hash = NEW.client_key_hash AND created_at > NEW.created_at - 60000
) >= 10
BEGIN
  SELECT RAISE(ABORT, 'rate_limited');
END;

-- Checkout: 5 per sesi per menit, maksimum 2 draft HELD per sesi, 10 per IP hash.
CREATE TRIGGER trg_order_limits BEFORE INSERT ON orders
WHEN (SELECT COUNT(*) FROM orders WHERE session_id = NEW.session_id AND created_at > NEW.created_at - 60000) >= 5
  OR (SELECT COUNT(*) FROM orders WHERE session_id = NEW.session_id AND stock_allocation_status = 'HELD') >= 2
  OR (
    SELECT COUNT(*) FROM orders o
    JOIN demo_sessions s ON s.id = o.session_id
    WHERE s.client_key_hash = (SELECT client_key_hash FROM demo_sessions WHERE id = NEW.session_id)
      AND o.stock_allocation_status = 'HELD'
  ) >= 10
BEGIN
  SELECT RAISE(ABORT, 'hold_limit');
END;

-- Harga/versi/aktif katalog divalidasi saat baris item ditulis, bukan dari read lama.
CREATE TRIGGER trg_item_catalog_guard AFTER INSERT ON order_items
WHEN (SELECT COUNT(*) FROM products p
      WHERE p.id = NEW.product_id AND p.active = 1 AND p.version = NEW.catalog_version) = 0
  OR (
    NEW.variant_id IS NOT NULL AND (
      SELECT COUNT(*) FROM variants v
      WHERE v.id = NEW.variant_id AND v.active = 1 AND v.version = NEW.variant_version
        AND v.price_rp = NEW.unit_price_rp AND v.product_id = NEW.product_id
    ) = 0
  )
BEGIN
  SELECT RAISE(ABORT, 'catalog_changed');
END;

-- Reservasi stok per komponen; gagal = seluruh batch rollback.
CREATE TRIGGER trg_component_reserve AFTER INSERT ON order_components
BEGIN
  UPDATE variants
     SET stock_reserved = stock_reserved + NEW.quantity,
         updated_at = MAX(updated_at, CAST(strftime('%s', 'now') AS INTEGER) * 1000)
   WHERE id = NEW.variant_id
     AND active = 1
     AND stock_reserved + NEW.quantity <= stock_on_hand;
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'stock_unavailable') ELSE 1 END;
END;

-- Expiry melepas reservasi sekali.
CREATE TRIGGER trg_order_release AFTER UPDATE OF stock_allocation_status ON orders
WHEN OLD.stock_allocation_status = 'HELD' AND NEW.stock_allocation_status = 'RELEASED'
BEGIN
  UPDATE variants
     SET stock_reserved = stock_reserved - (
       SELECT SUM(oc.quantity) FROM order_components oc
       JOIN order_items oi ON oi.id = oc.order_item_id
       WHERE oi.order_id = NEW.id AND oc.variant_id = variants.id
     )
   WHERE id IN (
     SELECT oc.variant_id FROM order_components oc
     JOIN order_items oi ON oi.id = oc.order_item_id
     WHERE oi.order_id = NEW.id
   );
END;

-- Konfirmasi pembayaran demo: konsumsi stok sekali + invoice + audit, hanya mode DEMO.
CREATE TRIGGER trg_payment_confirm AFTER UPDATE OF confirmed_at ON payments
WHEN OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL AND NEW.mode = 'DEMO'
BEGIN
  UPDATE variants
     SET stock_reserved = stock_reserved - (
           SELECT SUM(oc.quantity) FROM order_components oc
           JOIN order_items oi ON oi.id = oc.order_item_id
           WHERE oi.order_id = NEW.order_id AND oc.variant_id = variants.id),
         stock_on_hand = stock_on_hand - (
           SELECT SUM(oc.quantity) FROM order_components oc
           JOIN order_items oi ON oi.id = oc.order_item_id
           WHERE oi.order_id = NEW.order_id AND oc.variant_id = variants.id)
   WHERE id IN (
     SELECT oc.variant_id FROM order_components oc
     JOIN order_items oi ON oi.id = oc.order_item_id
     WHERE oi.order_id = NEW.order_id
   );

  UPDATE orders
     SET payment_status = 'PAID',
         stock_allocation_status = 'CONSUMED',
         paid_at = NEW.confirmed_at
   WHERE id = NEW.order_id AND payment_status = 'PENDING' AND stock_allocation_status = 'HELD';

  INSERT INTO invoices (id, order_id, invoice_number, mode, issued_at)
  SELECT lower(hex(randomblob(16))), NEW.order_id,
         'INV-' || (SELECT order_number FROM orders WHERE id = NEW.order_id),
         'DEMO', NEW.confirmed_at
  WHERE (SELECT payment_status FROM orders WHERE id = NEW.order_id) = 'PAID'
    AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = NEW.order_id);

  INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, safe_metadata, request_id, created_at)
  SELECT lower(hex(randomblob(16))), (SELECT session_id FROM orders WHERE id = NEW.order_id),
         'demo_payment_confirmed', 'order', NEW.order_id, '{}', 'demo', NEW.confirmed_at
  WHERE (SELECT payment_status FROM orders WHERE id = NEW.order_id) = 'PAID';
END;

-- READY hanya dari PAID/CONSUMED.
CREATE TRIGGER trg_ready_guard BEFORE UPDATE OF fulfillment_status ON orders
WHEN NEW.fulfillment_status = 'READY'
  AND (OLD.payment_status <> 'PAID' OR OLD.stock_allocation_status <> 'CONSUMED' OR OLD.fulfillment_status <> 'UNFULFILLED')
BEGIN
  SELECT RAISE(ABORT, 'not_ready_transition');
END;

-- Klaim pickup sekali, hanya READY.
CREATE TRIGGER trg_claim_guard BEFORE UPDATE OF claimed_at ON pickup_tickets
WHEN NEW.claimed_at IS NOT NULL AND (OLD.claimed_at IS NOT NULL
  OR (SELECT fulfillment_status FROM orders WHERE id = NEW.order_id) <> 'READY')
BEGIN
  SELECT RAISE(ABORT, 'pickup_not_allowed');
END;

-- Pesanan hanya bisa PICKED_UP setelah tiket pickup diklaim.
CREATE TRIGGER trg_picked_up_guard BEFORE UPDATE OF fulfillment_status ON orders
WHEN NEW.fulfillment_status = 'PICKED_UP'
  AND (OLD.fulfillment_status <> 'READY'
       OR (SELECT claimed_at FROM pickup_tickets WHERE order_id = NEW.id) IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'pickup_not_allowed');
END;

-- Stok tidak boleh turun di bawah reservasi.
CREATE TRIGGER trg_stock_adjust_guard BEFORE UPDATE OF stock_on_hand ON variants
WHEN NEW.stock_on_hand < NEW.stock_reserved
BEGIN
  SELECT RAISE(ABORT, 'stock_below_reserved');
END;
