-- Data demo SIMULASI. Harga dan stok fiktif, bukan penawaran resmi kampus.
-- Foto produk memakai turunan WebP dari docs/reference/updatekatalog.pdf (lihat manifest.json).
INSERT OR IGNORE INTO faculties (id, name) VALUES
  ('fac-fip', 'Fakultas Ilmu Pendidikan'),
  ('fac-fbs', 'Fakultas Bahasa dan Seni'),
  ('fac-fmipa', 'Fakultas Matematika dan Ilmu Pengetahuan Alam'),
  ('fac-fish', 'Fakultas Ilmu Sosial dan Hukum'),
  ('fac-ft', 'Fakultas Teknik'),
  ('fac-fik', 'Fakultas Ilmu Keolahragaan'),
  ('fac-feb', 'Fakultas Ekonomi dan Bisnis'),
  ('fac-fpsi', 'Fakultas Psikologi');

INSERT OR IGNORE INTO faculty_aliases (alias, faculty_id) VALUES
  ('FIP', 'fac-fip'), ('FBS', 'fac-fbs'), ('FMIPA', 'fac-fmipa'), ('FIS', 'fac-fish'),
  ('FISH', 'fac-fish'), ('FT', 'fac-ft'), ('FIK', 'fac-fik'), ('FIKK', 'fac-fik'),
  ('FEB', 'fac-feb'), ('FPSI', 'fac-fpsi'), ('FPPsi', 'fac-fpsi'), ('FPPSI', 'fac-fpsi');

INSERT OR IGNORE INTO departments (id, faculty_id, name) VALUES
  ('dept-informatika', 'fac-ft', 'Teknik Informatika'),
  ('dept-manajemen', 'fac-feb', 'Manajemen'),
  ('dept-psikologi', 'fac-fpsi', 'Psikologi');

-- Akun seed. Kata sandi demo: mabakit-demo-2026 (ganti sebelum produksi).
INSERT OR IGNORE INTO users (id, email, password_hash, role, name, whatsapp, faculty_id, created_at, updated_at) VALUES
  ('usr-admin', 'mabakita@admin', 'pbkdf2$100000$4ca1dcbc8e70a4c8b460eb1a42c6f9ee$2b29c13d5878281b79f270444c281ad3bcd2b77120417bbe6f5efd8892f4e274', 'admin', 'Admin MabaKit', '', NULL, 1760000000000, 1760000000000),
  ('usr-staff', 'tim@demo.mabakit', 'pbkdf2$100000$c1bc4b1f53db529f2f382d98578ae49d$ab74eec07b69a714be6ea4d2bd0c82505e139e72d45a974c3ea32dbaaacaee58', 'staff', 'Tim MabaKit', '', NULL, 1760000000000, 1760000000000),
  ('usr-buyer', 'pembeli@demo.mabakit', 'pbkdf2$100000$9a93fd26b379403af23ee8d39cdfea0d$9247db6014e90192b3f5e7fc7f6fbc6e3c2af67ca843227f71e6a0903d2ca936', 'buyer', 'Siti Rahma', '081234567890', 'fac-ft', 1760000000000, 1760000000000);

INSERT OR IGNORE INTO products (id, kind, title, description, image_path, bundle_price_rp, created_at, updated_at) VALUES
  ('p-topi', 'single', 'Topi Fakultas', 'Topi putih dengan bordir nama fakultas. Pilih fakultas saat memesan.', '/products/topi-feb-960.webp', NULL, 1760000000000, 1760000000000),
  ('p-kipas', 'single', 'Kipas Fakultas', 'Kipas lipat warna fakultas untuk kegiatan lapangan.', '/products/kipas-960.webp', NULL, 1760000000000, 1760000000000),
  ('p-goodie', 'single', 'Goodie Bag', 'Tidak dijual: tas putih/natural dikecualikan dari penawaran v2.', '/products/goodie-bag.jpg', NULL, 1760000000000, 1760000000000),
  ('p-kauskaki', 'single', 'Kaus Kaki Putih', 'Kaus kaki putih polos di atas mata kaki, satu pasang.', '/products/kaus-kaki.jpg', NULL, 1760000000000, 1760000000000),
  ('p-gesper', 'single', 'Gesper', 'Gesper hitam untuk celana atau rok. Tersedia model perempuan dan cowok.', '/products/gesper-perempuan.jpg', NULL, 1760000000000, 1760000000000),
  ('p-slayer', 'single', 'Slayer', 'Slayer kuning segitiga, bahan kain.', '/products/slayer.jpg', NULL, 1760000000000, 1760000000000),
  ('p-rok', 'single', 'Rok Span A Line', 'Rok span hitam potongan A line.', '/products/rok-span.jpg', NULL, 1760000000000, 1760000000000),
  ('p-paket', 'bundle', 'Paket Dasar (lama)', 'Tidak dijual: berisi goodie bag putih yang dikecualikan.', NULL, 59000, 1760000000000, 1760000000000),
  ('p-paket-hemat', 'bundle', 'Paket Hemat', 'Kipas fakultas dan kaus kaki putih. Pilih fakultas saat menyesuaikan paket.', NULL, 30000, 1760000000000, 1760000000000),
  ('p-paket-praktis', 'bundle', 'Paket Praktis', 'Topi fakultas, kipas fakultas, dan kaus kaki putih.', NULL, 65000, 1760000000000, 1760000000000),
  ('p-paket-starter', 'bundle', 'Starter Kit', 'Topi dan kipas fakultas, slayer, serta kaus kaki putih.', NULL, 95000, 1760000000000, 1760000000000);

UPDATE products SET active = 0 WHERE id IN ('p-goodie', 'p-paket');

INSERT OR IGNORE INTO variants (id, product_id, sku, attributes, price_rp, stock_on_hand, active, sellable, created_at, updated_at) VALUES
  ('v-topi-feb', 'p-topi', 'TOPI-FEB', '{"fakultas":"FEB","foto":"/products/topi-feb-960.webp","foto480":"/products/topi-feb-480.webp"}', 35000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-topi-fip', 'p-topi', 'TOPI-FIP', '{"fakultas":"FIP","foto":"/products/topi-fip-960.webp","foto480":"/products/topi-fip-480.webp"}', 35000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-topi-fik', 'p-topi', 'TOPI-FIK', '{"fakultas":"FIK","foto":"/products/topi-fik-960.webp","foto480":"/products/topi-fik-480.webp"}', 35000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-topi-fpsi', 'p-topi', 'TOPI-FPSI', '{"fakultas":"FPPsi","foto":"/products/topi-fppsi-960.webp","foto480":"/products/topi-fppsi-480.webp"}', 35000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-topi-ft', 'p-topi', 'TOPI-FT', '{"fakultas":"FT","foto":"/products/topi-ft-960.webp","foto480":"/products/topi-ft-480.webp"}', 35000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-topi-fis', 'p-topi', 'TOPI-FIS', '{"fakultas":"FIS","foto":"/products/topi-fis-960.webp","foto480":"/products/topi-fis-480.webp"}', 35000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-topi-fmipa', 'p-topi', 'TOPI-FMIPA', '{"fakultas":"FMIPA","foto":"/products/topi-fmipa-960.webp","foto480":"/products/topi-fmipa-480.webp"}', 35000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-topi-fbs', 'p-topi', 'TOPI-FBS', '{"fakultas":"FBS","foto":"/products/topi-fbs-960.webp","foto480":"/products/topi-fbs-480.webp"}', 35000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-kipas-feb', 'p-kipas', 'KIPAS-FEB', '{"fakultas":"FEB","foto":"/products/kipas-feb-960.webp","foto480":"/products/kipas-feb-480.webp"}', 15000, 20, 1, 1, 1760000000000, 1760000000000),
  ('v-kipas-fip', 'p-kipas', 'KIPAS-FIP', '{"fakultas":"FIP","foto":"/products/kipas-fip-960.webp","foto480":"/products/kipas-fip-480.webp"}', 15000, 20, 1, 1, 1760000000000, 1760000000000),
  ('v-kipas-fik', 'p-kipas', 'KIPAS-FIK', '{"fakultas":"FIK","foto":"/products/kipas-fik-960.webp","foto480":"/products/kipas-fik-480.webp"}', 15000, 20, 1, 1, 1760000000000, 1760000000000),
  ('v-kipas-fpsi', 'p-kipas', 'KIPAS-FPSI', '{"fakultas":"FPPsi","foto":"/products/kipas-fpsi-960.webp","foto480":"/products/kipas-fpsi-480.webp"}', 15000, 20, 1, 1, 1760000000000, 1760000000000),
  ('v-kipas-ft', 'p-kipas', 'KIPAS-FT', '{"fakultas":"FT","foto":"/products/kipas-ft-960.webp","foto480":"/products/kipas-ft-480.webp"}', 15000, 20, 1, 1, 1760000000000, 1760000000000),
  ('v-kipas-fish', 'p-kipas', 'KIPAS-FISH', '{"fakultas":"FISH","foto":"/products/kipas-fish-960.webp","foto480":"/products/kipas-fish-480.webp"}', 15000, 20, 1, 1, 1760000000000, 1760000000000),
  ('v-kipas-fmipa', 'p-kipas', 'KIPAS-FMIPA', '{"fakultas":"FMIPA","foto":"/products/kipas-fmipa-960.webp","foto480":"/products/kipas-fmipa-480.webp"}', 15000, 20, 1, 1, 1760000000000, 1760000000000),
  ('v-kipas-fbs', 'p-kipas', 'KIPAS-FBS', '{"fakultas":"FBS","foto":"/products/kipas-fbs-960.webp","foto480":"/products/kipas-fbs-480.webp"}', 15000, 20, 1, 1, 1760000000000, 1760000000000),
  ('v-goodie', 'p-goodie', 'GOODIE-01', '{"warna":"natural","foto":"/products/goodie-bag.jpg"}', 25000, 30, 0, 0, 1760000000000, 1760000000000),
  ('v-kauskaki', 'p-kauskaki', 'KAUS-01', '{"warna":"putih","foto":"/products/kaus-kaki.jpg","foto480":"/products/kaus-kaki-480.webp"}', 15000, 40, 1, 1, 1760000000000, 1760000000000),
  ('v-gesper-perempuan', 'p-gesper', 'GESPER-P', '{"model":"Perempuan","foto":"/products/gesper-perempuan.jpg","foto480":"/products/gesper-perempuan-480.webp"}', 20000, 15, 1, 1, 1760000000000, 1760000000000),
  ('v-gesper-cowok', 'p-gesper', 'GESPER-C', '{"model":"Cowok","foto":"/products/gesper-cowok.jpg","foto480":"/products/gesper-cowok-480.webp"}', 20000, 15, 1, 1, 1760000000000, 1760000000000),
  ('v-slayer', 'p-slayer', 'SLAYER-01', '{"model":"segitiga","warna":"kuning","foto":"/products/slayer.jpg","foto480":"/products/slayer-480.webp"}', 30000, 25, 1, 1, 1760000000000, 1760000000000),
  ('v-rok', 'p-rok', 'ROK-01', '{"ukuran":"M","warna":"hitam","foto":"/products/rok-span.jpg","foto480":"/products/rok-span-480.webp"}', 85000, 12, 1, 1, 1760000000000, 1760000000000);

INSERT OR IGNORE INTO variant_faculties (variant_id, faculty_id)
SELECT 'v-topi-' || lower(replace(replace(alias, 'FPPsi', 'fpsi'), 'FPPSI', 'fpsi')), faculty_id FROM faculty_aliases WHERE alias IN ('FEB','FIP','FIK','FPPsi','FT','FIS','FMIPA','FBS');
INSERT OR IGNORE INTO variant_faculties (variant_id, faculty_id) VALUES
  ('v-kipas-feb','fac-feb'), ('v-kipas-fip','fac-fip'), ('v-kipas-fik','fac-fik'), ('v-kipas-fpsi','fac-fpsi'),
  ('v-kipas-ft','fac-ft'), ('v-kipas-fish','fac-fish'), ('v-kipas-fmipa','fac-fmipa'), ('v-kipas-fbs','fac-fbs');

INSERT OR IGNORE INTO bundle_components (bundle_product_id, variant_id, quantity) VALUES
  ('p-paket', 'v-goodie', 1), ('p-paket', 'v-kauskaki', 1), ('p-paket', 'v-slayer', 1);

-- Tiga tipe paket dipublikasikan per fakultas. Harga = jumlah harga satuan server, tanpa klaim diskon.
INSERT OR IGNORE INTO bundle_configs (id, bundle_product_id, faculty_id, price_rp, published, created_at, updated_at) VALUES
  ('cfg-hemat-feb','p-paket-hemat','fac-feb',30000,1,1760000000000,1760000000000),
  ('cfg-hemat-fip','p-paket-hemat','fac-fip',30000,1,1760000000000,1760000000000),
  ('cfg-hemat-fik','p-paket-hemat','fac-fik',30000,1,1760000000000,1760000000000),
  ('cfg-hemat-fpsi','p-paket-hemat','fac-fpsi',30000,1,1760000000000,1760000000000),
  ('cfg-hemat-ft','p-paket-hemat','fac-ft',30000,1,1760000000000,1760000000000),
  ('cfg-hemat-fish','p-paket-hemat','fac-fish',30000,1,1760000000000,1760000000000),
  ('cfg-hemat-fmipa','p-paket-hemat','fac-fmipa',30000,1,1760000000000,1760000000000),
  ('cfg-hemat-fbs','p-paket-hemat','fac-fbs',30000,1,1760000000000,1760000000000),
  ('cfg-praktis-feb','p-paket-praktis','fac-feb',65000,1,1760000000000,1760000000000),
  ('cfg-praktis-fip','p-paket-praktis','fac-fip',65000,1,1760000000000,1760000000000),
  ('cfg-praktis-fik','p-paket-praktis','fac-fik',65000,1,1760000000000,1760000000000),
  ('cfg-praktis-fpsi','p-paket-praktis','fac-fpsi',65000,1,1760000000000,1760000000000),
  ('cfg-praktis-ft','p-paket-praktis','fac-ft',65000,1,1760000000000,1760000000000),
  ('cfg-praktis-fish','p-paket-praktis','fac-fish',65000,1,1760000000000,1760000000000),
  ('cfg-praktis-fmipa','p-paket-praktis','fac-fmipa',65000,1,1760000000000,1760000000000),
  ('cfg-praktis-fbs','p-paket-praktis','fac-fbs',65000,1,1760000000000,1760000000000),
  ('cfg-starter-feb','p-paket-starter','fac-feb',95000,1,1760000000000,1760000000000),
  ('cfg-starter-fip','p-paket-starter','fac-fip',95000,1,1760000000000,1760000000000),
  ('cfg-starter-fik','p-paket-starter','fac-fik',95000,1,1760000000000,1760000000000),
  ('cfg-starter-fpsi','p-paket-starter','fac-fpsi',95000,1,1760000000000,1760000000000),
  ('cfg-starter-ft','p-paket-starter','fac-ft',95000,1,1760000000000,1760000000000),
  ('cfg-starter-fish','p-paket-starter','fac-fish',95000,1,1760000000000,1760000000000),
  ('cfg-starter-fmipa','p-paket-starter','fac-fmipa',95000,1,1760000000000,1760000000000),
  ('cfg-starter-fbs','p-paket-starter','fac-fbs',95000,1,1760000000000,1760000000000);

INSERT OR IGNORE INTO bundle_config_components (config_id, variant_id, quantity)
SELECT 'cfg-hemat-' || substr(faculty_id, 5), 'v-kipas-' || replace(replace(substr(faculty_id, 5), 'fish', 'fish'), 'fpsi', 'fpsi'), 1 FROM bundle_configs WHERE bundle_product_id = 'p-paket-hemat';
INSERT OR IGNORE INTO bundle_config_components (config_id, variant_id, quantity)
SELECT 'cfg-hemat-' || substr(faculty_id, 5), 'v-kauskaki', 1 FROM bundle_configs WHERE bundle_product_id = 'p-paket-hemat';
INSERT OR IGNORE INTO bundle_config_components (config_id, variant_id, quantity)
SELECT 'cfg-praktis-' || substr(faculty_id, 5), 'v-topi-' || replace(substr(faculty_id, 5), 'fish', 'fis'), 1 FROM bundle_configs WHERE bundle_product_id = 'p-paket-praktis';
INSERT OR IGNORE INTO bundle_config_components (config_id, variant_id, quantity)
SELECT 'cfg-praktis-' || substr(faculty_id, 5), 'v-kipas-' || substr(faculty_id, 5), 1 FROM bundle_configs WHERE bundle_product_id = 'p-paket-praktis';
INSERT OR IGNORE INTO bundle_config_components (config_id, variant_id, quantity)
SELECT 'cfg-praktis-' || substr(faculty_id, 5), 'v-kauskaki', 1 FROM bundle_configs WHERE bundle_product_id = 'p-paket-praktis';
INSERT OR IGNORE INTO bundle_config_components (config_id, variant_id, quantity)
SELECT 'cfg-starter-' || substr(faculty_id, 5), 'v-topi-' || replace(substr(faculty_id, 5), 'fish', 'fis'), 1 FROM bundle_configs WHERE bundle_product_id = 'p-paket-starter';
INSERT OR IGNORE INTO bundle_config_components (config_id, variant_id, quantity)
SELECT 'cfg-starter-' || substr(faculty_id, 5), 'v-kipas-' || substr(faculty_id, 5), 1 FROM bundle_configs WHERE bundle_product_id = 'p-paket-starter';
INSERT OR IGNORE INTO bundle_config_components (config_id, variant_id, quantity)
SELECT 'cfg-starter-' || substr(faculty_id, 5), 'v-slayer', 1 FROM bundle_configs WHERE bundle_product_id = 'p-paket-starter';
INSERT OR IGNORE INTO bundle_config_components (config_id, variant_id, quantity)
SELECT 'cfg-starter-' || substr(faculty_id, 5), 'v-kauskaki', 1 FROM bundle_configs WHERE bundle_product_id = 'p-paket-starter';

INSERT OR IGNORE INTO spec_checklists (id, product_id, label, sort_order) VALUES
  ('spec-topi-fakultas', 'p-topi', 'Pilih fakultas sesuai data peserta', 1),
  ('spec-gesper-model', 'p-gesper', 'Pilih model gesper saat memesan', 1),
  ('spec-paket-isi', 'p-paket-hemat', 'Periksa isi paket saat pengambilan', 1);

INSERT INTO store_settings (id, checkout_enabled, pickup_location_label, pickup_location_details, pickup_service_hours, pickup_version, updated_at)
VALUES (1, 1, 'Kampus A, Lobi Gedung B', 'Tunjukkan nomor pesanan dan nama penerima ke petugas di meja PKKMB.', 'Senin sampai Jumat, 09.00-15.00 WIB', 1, 1760000000000)
ON CONFLICT (id) DO UPDATE SET
  pickup_location_label = excluded.pickup_location_label,
  pickup_location_details = excluded.pickup_location_details,
  pickup_service_hours = excluded.pickup_service_hours;
