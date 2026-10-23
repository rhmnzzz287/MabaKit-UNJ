-- Seed berjalan sesudah migrasi, jadi baris tas putih perlu dinormalkan ulang di sini
-- dan setiap kali seed dijalankan ulang.
UPDATE variants SET sellable = 0 WHERE product_id = 'p-goodie' OR sku LIKE 'GOODIE%' OR sku LIKE 'TOTEBAG%';

DROP TRIGGER IF EXISTS trg_white_bag_sellable;
DROP TRIGGER IF EXISTS trg_white_bag_sellable_update;

-- Hanya tas (goodie bag dan totebag) yang dikunci. Kaus kaki putih tetap boleh dijual.
CREATE TRIGGER trg_white_bag_sellable
BEFORE INSERT ON variants
WHEN NEW.sellable = 1
  AND (NEW.product_id = 'p-goodie' OR NEW.sku LIKE 'GOODIE%' OR NEW.sku LIKE 'TOTEBAG%')
BEGIN
  SELECT RAISE(ABORT, 'white_bag_not_sellable');
END;

CREATE TRIGGER trg_white_bag_sellable_update
BEFORE UPDATE OF sellable ON variants
WHEN NEW.sellable = 1
  AND (NEW.product_id = 'p-goodie' OR NEW.sku LIKE 'GOODIE%' OR NEW.sku LIKE 'TOTEBAG%')
BEGIN
  SELECT RAISE(ABORT, 'white_bag_not_sellable');
END;
