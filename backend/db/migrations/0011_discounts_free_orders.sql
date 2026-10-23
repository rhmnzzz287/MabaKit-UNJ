-- Diskon persen per produk dan pesanan gratis 100 persen.
-- unit_price_rp/line_total_rp tetap > 0 karena constraint lama; nilai charged_* adalah angka sebenarnya.
ALTER TABLE products ADD COLUMN discount_basis_points INTEGER NOT NULL DEFAULT 0
  CHECK (discount_basis_points BETWEEN 0 AND 10000);

ALTER TABLE orders ADD COLUMN amount_due_rp INTEGER;
UPDATE orders SET amount_due_rp = total_rp WHERE amount_due_rp IS NULL;

ALTER TABLE order_items ADD COLUMN base_unit_price_rp INTEGER;
ALTER TABLE order_items ADD COLUMN discount_basis_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN charged_unit_price_rp INTEGER;
ALTER TABLE order_items ADD COLUMN charged_line_total_rp INTEGER;
UPDATE order_items SET base_unit_price_rp = unit_price_rp,
  charged_unit_price_rp = unit_price_rp,
  charged_line_total_rp = line_total_rp
WHERE base_unit_price_rp IS NULL;

-- payments: metode FREE untuk pesanan tanpa tagihan. Tabel tidak punya child.
CREATE TABLE payments_new (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  mode TEXT NOT NULL CHECK (mode = 'DEMO'),
  method TEXT NOT NULL CHECK (method IN ('BANK_TRANSFER', 'EWALLET', 'QRIS', 'FREE')),
  confirmed_at INTEGER
);
INSERT INTO payments_new (order_id, mode, method, confirmed_at)
  SELECT order_id, mode, method, confirmed_at FROM payments;
DROP TABLE payments;
ALTER TABLE payments_new RENAME TO payments;

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
