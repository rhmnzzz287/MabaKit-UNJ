-- Penjualan ganda: `active` untuk tampil/operasional, `sellable` untuk boleh dijual.
-- Tas putih/natural (termasuk totebag FIKK putih) permanen tidak dijual.
ALTER TABLE variants ADD COLUMN sellable INTEGER NOT NULL DEFAULT 1 CHECK (sellable IN (0, 1));
UPDATE variants SET sellable = 0 WHERE sku = 'GOODIE-01';
CREATE TRIGGER trg_white_bag_sellable BEFORE UPDATE OF sellable ON variants
WHEN NEW.sku = 'GOODIE-01' AND NEW.sellable = 1
BEGIN
  SELECT RAISE(ABORT, 'white_bag_not_sellable');
END;
