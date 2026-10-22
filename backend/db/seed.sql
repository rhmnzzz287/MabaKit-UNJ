-- Data demo SIMULASI. Harga dan stok fiktif, bukan penawaran resmi kampus.
INSERT OR IGNORE INTO faculties (id, name) VALUES
  ('fac-teknik', 'Fakultas Teknik'),
  ('fac-ekonomi', 'Fakultas Ekonomi');

INSERT OR IGNORE INTO departments (id, faculty_id, name) VALUES
  ('dept-informatika', 'fac-teknik', 'Teknik Informatika'),
  ('dept-sipil', 'fac-teknik', 'Teknik Sipil'),
  ('dept-manajemen', 'fac-ekonomi', 'Manajemen');

INSERT OR IGNORE INTO products (id, kind, title, description, image_path, bundle_price_rp, created_at, updated_at) VALUES
  ('p-kaos', 'single', 'Kaos PKKMB', 'Kaos katun combed 30s, sablon satu sisi. Ukuran tersedia S sampai XL.', NULL, NULL,
    CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('p-tote', 'single', 'Tote Bag Kanvas', 'Tas kanvas tanpa resleting untuk buku dan perlengkapan orientasi.', NULL, NULL,
    CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('p-nametag', 'single', 'Name Tag Peserta', 'Name tag dengan tali, nama diisi saat pengambilan.', NULL, NULL,
    CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('p-buku', 'single', 'Buku Panduan PKKMB', 'Panduan kegiatan dan kontak panitia. Data uji.', NULL, NULL,
    CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('p-paket', 'bundle', 'Paket Lengkap', 'Satu kaos, satu tote bag, satu name tag, dan satu buku panduan.', NULL, 150000,
    CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT OR IGNORE INTO variants (id, product_id, sku, attributes, price_rp, stock_on_hand, created_at, updated_at) VALUES
  ('v-kaos-s', 'p-kaos', 'KAOS-S', '{"ukuran":"S"}', 65000, 12, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-kaos-m', 'p-kaos', 'KAOS-M', '{"ukuran":"M"}', 65000, 24, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-kaos-l', 'p-kaos', 'KAOS-L', '{"ukuran":"L"}', 65000, 18, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-kaos-xl', 'p-kaos', 'KAOS-XL', '{"ukuran":"XL"}', 68000, 8, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-tote', 'p-tote', 'TOTE-01', '{"warna":"natural"}', 45000, 30, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-nametag', 'p-nametag', 'TAG-01', '{"tali":"hitam"}', 20000, 40, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-buku', 'p-buku', 'BUKU-01', '{"edisi":"2026"}', 35000, 25, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT OR IGNORE INTO bundle_components (bundle_product_id, variant_id, quantity) VALUES
  ('p-paket', 'v-kaos-m', 1),
  ('p-paket', 'v-tote', 1),
  ('p-paket', 'v-nametag', 1),
  ('p-paket', 'v-buku', 1);

INSERT OR IGNORE INTO spec_checklists (id, product_id, label, sort_order) VALUES
  ('spec-kaos-ukuran', 'p-kaos', 'Pilih ukuran sesuai tabel panitia', 1),
  ('spec-paket-isi', 'p-paket', 'Periksa isi paket saat pengambilan', 1);

INSERT INTO store_settings (id, checkout_enabled, pickup_location_label, pickup_location_details, pickup_service_hours, pickup_version, updated_at)
VALUES (1, 1, 'Kampus A, Lobi Gedung B', 'Tunjukkan kode pickup dan nama penerima ke petugas di meja PKKMB.', 'Senin sampai Jumat, 09.00-15.00 WIB', 1,
        CAST(strftime('%s','now') AS INTEGER) * 1000)
ON CONFLICT (id) DO UPDATE SET
  pickup_location_label = excluded.pickup_location_label,
  pickup_location_details = excluded.pickup_location_details,
  pickup_service_hours = excluded.pickup_service_hours;
