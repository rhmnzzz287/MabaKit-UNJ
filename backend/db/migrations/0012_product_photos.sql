CREATE TABLE product_photos (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes INTEGER NOT NULL CHECK (bytes > 0 AND bytes <= 5242880),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  position INTEGER NOT NULL CHECK (position >= 0 AND position < 5),
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_product_photos_product ON product_photos(product_id, position);

CREATE TRIGGER trg_photo_limit BEFORE INSERT ON product_photos
WHEN (SELECT COUNT(*) FROM product_photos WHERE product_id = NEW.product_id) >= 5
BEGIN
  SELECT RAISE(ABORT, 'photo_limit');
END;
