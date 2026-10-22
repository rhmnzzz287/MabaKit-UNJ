-- Data demo SIMULASI. Harga dan stok fiktif, bukan penawaran resmi kampus.
-- Foto produk diambil dari docs/reference/Foto Produk-MabaKit Define.pdf.
INSERT OR IGNORE INTO faculties (id, name) VALUES
  ('fac-fip', 'Fakultas Ilmu Pendidikan'),
  ('fac-fbs', 'Fakultas Bahasa dan Seni'),
  ('fac-fmipa', 'Fakultas Matematika dan Ilmu Pengetahuan Alam'),
  ('fac-fish', 'Fakultas Ilmu Sosial dan Hukum'),
  ('fac-ft', 'Fakultas Teknik'),
  ('fac-fik', 'Fakultas Ilmu Keolahragaan'),
  ('fac-feb', 'Fakultas Ekonomi dan Bisnis'),
  ('fac-fpsi', 'Fakultas Psikologi');

INSERT OR IGNORE INTO departments (id, faculty_id, name) VALUES
  ('dept-informatika', 'fac-ft', 'Teknik Informatika'),
  ('dept-manajemen', 'fac-feb', 'Manajemen'),
  ('dept-psikologi', 'fac-fpsi', 'Psikologi');

INSERT OR IGNORE INTO products (id, kind, title, description, image_path, bundle_price_rp, created_at, updated_at) VALUES
  ('p-topi', 'single', 'Topi Fakultas', 'Topi putih dengan bordir nama fakultas. Pilih fakultas saat memesan.', '/products/topi-feb.jpg', NULL,
    CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('p-kipas', 'single', 'Kipas Fakultas', 'Kipas lipat warna fakultas untuk kegiatan lapangan.', '/products/kipas-fip.jpg', NULL,
    CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('p-goodie', 'single', 'Goodie Bag', 'Tas jinjing tanpa resleting untuk perlengkapan orientasi.', '/products/goodie-bag.jpg', NULL,
    CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('p-kauskaki', 'single', 'Kaus Kaki Putih', 'Kaus kaki putih polos, satu pasang.', '/products/kaus-kaki.jpg', NULL,
    CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('p-gesper', 'single', 'Gesper', 'Gesper hitam untuk celana atau rok. Tersedia model perempuan dan cowok.', '/products/gesper-perempuan.jpg', NULL,
    CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('p-slayer', 'single', 'Slayer', 'Slayer kuning segitiga, bahan kain.', '/products/slayer.jpg', NULL,
    CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('p-rok', 'single', 'Rok Span A Line', 'Rok span hitam potongan A line.', '/products/rok-span.jpg', NULL,
    CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('p-paket', 'bundle', 'Paket Dasar', 'Goodie bag, kaus kaki putih, dan slayer dalam satu paket.', NULL, 59000,
    CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT OR IGNORE INTO variants (id, product_id, sku, attributes, price_rp, stock_on_hand, created_at, updated_at) VALUES
  ('v-topi-feb', 'p-topi', 'TOPI-FEB', '{"fakultas":"FEB","foto":"/products/topi-feb.jpg"}', 35000, 10, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-topi-fip', 'p-topi', 'TOPI-FIP', '{"fakultas":"FIP","foto":"/products/topi-fip.jpg"}', 35000, 10, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-topi-fik', 'p-topi', 'TOPI-FIK', '{"fakultas":"FIK","foto":"/products/topi-fik.jpg"}', 35000, 10, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-topi-fpsi', 'p-topi', 'TOPI-FPSI', '{"fakultas":"FPsi","foto":"/products/topi-fppsi.jpg"}', 35000, 10, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-topi-ft', 'p-topi', 'TOPI-FT', '{"fakultas":"FT","foto":"/products/topi-ft.jpg"}', 35000, 10, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-topi-fis', 'p-topi', 'TOPI-FIS', '{"fakultas":"FIS","foto":"/products/topi-fis.jpg"}', 35000, 10, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-topi-fmipa', 'p-topi', 'TOPI-FMIPA', '{"fakultas":"FMIPA","foto":"/products/topi-fmipa.jpg"}', 35000, 10, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-topi-fbs', 'p-topi', 'TOPI-FBS', '{"fakultas":"FBS","foto":"/products/topi-fbs.jpg"}', 35000, 10, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-kipas-feb', 'p-kipas', 'KIPAS-FEB', '{"fakultas":"FEB","foto":"/products/kipas-feb.jpg"}', 15000, 20, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-kipas-fip', 'p-kipas', 'KIPAS-FIP', '{"fakultas":"FIP","foto":"/products/kipas-fip.jpg"}', 15000, 20, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-kipas-fik', 'p-kipas', 'KIPAS-FIK', '{"fakultas":"FIK","foto":"/products/kipas-fik.jpg"}', 15000, 20, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-kipas-fpsi', 'p-kipas', 'KIPAS-FPSI', '{"fakultas":"FPsi","foto":"/products/kipas-fpsi.jpg"}', 15000, 20, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-kipas-ft', 'p-kipas', 'KIPAS-FT', '{"fakultas":"FT","foto":"/products/kipas-ft.jpg"}', 15000, 20, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-kipas-fish', 'p-kipas', 'KIPAS-FISH', '{"fakultas":"FISH","foto":"/products/kipas-fish.jpg"}', 15000, 20, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-kipas-fmipa', 'p-kipas', 'KIPAS-FMIPA', '{"fakultas":"FMIPA","foto":"/products/kipas-fmipa.jpg"}', 15000, 20, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-kipas-fbs', 'p-kipas', 'KIPAS-FBS', '{"fakultas":"FBS","foto":"/products/kipas-fbs.jpg"}', 15000, 20, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-goodie', 'p-goodie', 'GOODIE-01', '{"warna":"natural","foto":"/products/goodie-bag.jpg"}', 25000, 30, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-kauskaki', 'p-kauskaki', 'KAUS-01', '{"warna":"putih","foto":"/products/kaus-kaki.jpg"}', 15000, 40, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-gesper-perempuan', 'p-gesper', 'GESPER-P', '{"model":"Perempuan","foto":"/products/gesper-perempuan.jpg"}', 20000, 15, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-gesper-cowok', 'p-gesper', 'GESPER-C', '{"model":"Cowok","foto":"/products/gesper-cowok.jpg"}', 20000, 15, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-slayer', 'p-slayer', 'SLAYER-01', '{"warna":"kuning","foto":"/products/slayer.jpg"}', 30000, 25, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('v-rok', 'p-rok', 'ROK-01', '{"ukuran":"M","warna":"hitam","foto":"/products/rok-span.jpg"}', 85000, 12, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT OR IGNORE INTO bundle_components (bundle_product_id, variant_id, quantity) VALUES
  ('p-paket', 'v-goodie', 1),
  ('p-paket', 'v-kauskaki', 1),
  ('p-paket', 'v-slayer', 1);

INSERT OR IGNORE INTO spec_checklists (id, product_id, label, sort_order) VALUES
  ('spec-topi-fakultas', 'p-topi', 'Pilih fakultas sesuai data peserta', 1),
  ('spec-gesper-model', 'p-gesper', 'Pilih model gesper saat memesan', 1),
  ('spec-paket-isi', 'p-paket', 'Periksa isi paket saat pengambilan', 1);

INSERT INTO store_settings (id, checkout_enabled, pickup_location_label, pickup_location_details, pickup_service_hours, pickup_version, updated_at)
VALUES (1, 1, 'Kampus A, Lobi Gedung B', 'Tunjukkan kode pickup dan nama penerima ke petugas di meja PKKMB.', 'Senin sampai Jumat, 09.00-15.00 WIB', 1,
        CAST(strftime('%s','now') AS INTEGER) * 1000)
ON CONFLICT (id) DO UPDATE SET
  pickup_location_label = excluded.pickup_location_label,
  pickup_location_details = excluded.pickup_location_details,
  pickup_service_hours = excluded.pickup_service_hours;
