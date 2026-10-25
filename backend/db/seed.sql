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

-- Akun seed. Kata sandi demo: admin123 / staffmabakit123 / buyermabakit123
-- (ganti sebelum produksi).
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
  -- Dasi dipisah dari slayer: katalog mencatatnya sebagai produk sendiri dengan 8 varian fakultas.
  ('p-dasi', 'single', 'Dasi Fakultas', 'Dasi custom warna fakultas. Pilih fakultas saat memesan.', '/products/dasi-feb-960.webp', NULL, 1760000000000, 1760000000000),
  ('p-rok', 'single', 'Rok Span A Line', 'Rok span hitam potongan A line.', '/products/rok-span.jpg', NULL, 1760000000000, 1760000000000),
  -- Produk inti versi MabaKit Define2: notebook, name tag, bendera, tali, bordir logo.
  ('p-notebook', 'single', 'Notebook Fakultas', 'Notebook custom sampul warna fakultas. Pilih fakultas saat memesan.', '/products/notebook-feb-960.webp', NULL, 1760000000000, 1760000000000),
  ('p-nametag', 'single', 'Name Tag', 'Name tag peserta dengan tali, dicetak sesuai nama dan fakultas.', NULL, NULL, 1760000000000, 1760000000000),
  ('p-bendera', 'single', 'Bendera Fakultas', 'Bendera kain warna fakultas untuk kegiatan lapangan.', NULL, NULL, 1760000000000, 1760000000000),
  ('p-lanyard', 'single', 'Tali Lanyard', 'Tali lanyard custom warna fakultas, tanpa kartu nama.', NULL, NULL, 1760000000000, 1760000000000),
  ('p-bordir', 'single', 'Bordir Logo', 'Jasa bordir logo di seragam atau totebag milik pembeli.', NULL, NULL, 1760000000000, 1760000000000),
  -- Produk terakhir dari katalog. Tanpa foto, jadi otomatis tampil paling bawah (lihat photosFirst di CatalogPage).
  -- Totebag tidak ditambahkan: PRD FR16 / RELEASE T21 melarang tas putih-natural dijual, dan trigger 0009 memblokirnya.
  ('p-kemeja', 'single', 'Kemeja Putih Custom', 'Kemeja putih dengan warna mengikuti fakultas. Pilih fakultas saat memesan.', NULL, NULL, 1760000000000, 1760000000000),
  -- Tiga tier paket dari MabaKit Define2, berlaku untuk semua fakultas (faculty_id tetap NULL).
  -- Sengaja tidak berawalan p-paket- supaya pola seed paket fakultas tidak ikut menyentuhnya.
  ('p-tier-hemat', 'bundle', 'Paket Hemat', 'Slayer dan name tag. Kombinasi paling ringkas untuk yang sudah punya perlengkapan lain.', NULL, 30000, 1760000000000, 1760000000000),
  ('p-tier-praktis', 'bundle', 'Paket Praktis', 'Slayer, name tag, dan notebook. Perlengkapan catatan dan identitas sekaligus.', NULL, 50000, 1760000000000, 1760000000000),
  ('p-tier-starter', 'bundle', 'Starter Kit', 'Paket Praktis ditambah topi fakultas dan bendera. Cakupan perlengkapan paling luas.', NULL, 85000, 1760000000000, 1760000000000),
  ('p-paket', 'bundle', 'Paket Dasar (lama)', 'Tidak dijual: berisi goodie bag putih yang dikecualikan.', NULL, 59000, 1760000000000, 1760000000000),
  ('p-paket-fip', 'bundle', 'Paket FIP', 'Topi, kipas, slayer, dan kaus kaki putih Fakultas Ilmu Pendidikan.', '/products/bundle-fip-960.webp', 95000, 1760000000000, 1760000000000),
  ('p-paket-fbs', 'bundle', 'Paket FBS', 'Topi, kipas, slayer, dan kaus kaki putih Fakultas Bahasa dan Seni.', '/products/bundle-fbs-960.webp', 95000, 1760000000000, 1760000000000),
  ('p-paket-fmipa', 'bundle', 'Paket FMIPA', 'Topi, kipas, slayer, dan kaus kaki putih Fakultas Matematika dan Ilmu Pengetahuan Alam.', '/products/bundle-fmipa-960.webp', 95000, 1760000000000, 1760000000000),
  ('p-paket-fish', 'bundle', 'Paket FISH', 'Topi, kipas, slayer, dan kaus kaki putih Fakultas Ilmu Sosial dan Hukum.', '/products/bundle-fish-960.webp', 95000, 1760000000000, 1760000000000),
  ('p-paket-ft', 'bundle', 'Paket FT', 'Topi, kipas, slayer, dan kaus kaki putih Fakultas Teknik.', '/products/bundle-ft-960.webp', 95000, 1760000000000, 1760000000000),
  ('p-paket-fik', 'bundle', 'Paket FIK', 'Topi, kipas, slayer, dan kaus kaki putih Fakultas Ilmu Keolahragaan.', '/products/bundle-fik-960.webp', 95000, 1760000000000, 1760000000000),
  ('p-paket-feb', 'bundle', 'Paket FEB', 'Topi, kipas, slayer, dan kaus kaki putih Fakultas Ekonomi dan Bisnis.', '/products/bundle-feb-960.webp', 95000, 1760000000000, 1760000000000),
  ('p-paket-fpsi', 'bundle', 'Paket FPSI', 'Topi, kipas, slayer, dan kaus kaki putih Fakultas Psikologi.', '/products/bundle-fpsi-960.webp', 95000, 1760000000000, 1760000000000);

UPDATE products SET active = 0 WHERE id IN ('p-goodie', 'p-paket');

-- Foto kipas per fakultas di public/products ternyata berisi logo fakultas, bukan kipas.
-- Rujukannya dilepas supaya kartu memakai foto kipas asli dari PDF (kipas-960.webp).
-- UPDATE, bukan INSERT, karena seed idempoten: baris lama tidak ikut berubah.
UPDATE variants SET attributes = json_remove(attributes, '$.foto', '$.foto480') WHERE sku LIKE 'KIPAS-%';

INSERT OR IGNORE INTO variants (id, product_id, sku, attributes, price_rp, stock_on_hand, active, sellable, created_at, updated_at) VALUES
  ('v-topi-feb', 'p-topi', 'TOPI-FEB', '{"fakultas":"FEB","foto":"/products/topi-feb-960.webp","foto480":"/products/topi-feb-480.webp"}', 35000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-topi-fip', 'p-topi', 'TOPI-FIP', '{"fakultas":"FIP","foto":"/products/topi-fip-960.webp","foto480":"/products/topi-fip-480.webp"}', 35000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-topi-fik', 'p-topi', 'TOPI-FIK', '{"fakultas":"FIK","foto":"/products/topi-fik-960.webp","foto480":"/products/topi-fik-480.webp"}', 35000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-topi-fpsi', 'p-topi', 'TOPI-FPSI', '{"fakultas":"FPPsi","foto":"/products/topi-fppsi-960.webp","foto480":"/products/topi-fppsi-480.webp"}', 35000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-topi-ft', 'p-topi', 'TOPI-FT', '{"fakultas":"FT","foto":"/products/topi-ft-960.webp","foto480":"/products/topi-ft-480.webp"}', 35000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-topi-fis', 'p-topi', 'TOPI-FIS', '{"fakultas":"FIS","foto":"/products/topi-fis-960.webp","foto480":"/products/topi-fis-480.webp"}', 35000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-topi-fmipa', 'p-topi', 'TOPI-FMIPA', '{"fakultas":"FMIPA","foto":"/products/topi-fmipa-960.webp","foto480":"/products/topi-fmipa-480.webp"}', 35000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-topi-fbs', 'p-topi', 'TOPI-FBS', '{"fakultas":"FBS","foto":"/products/topi-fbs-960.webp","foto480":"/products/topi-fbs-480.webp"}', 35000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-kipas-feb', 'p-kipas', 'KIPAS-FEB', '{"fakultas":"FEB"}', 15000, 20, 1, 1, 1760000000000, 1760000000000),
  ('v-kipas-fip', 'p-kipas', 'KIPAS-FIP', '{"fakultas":"FIP"}', 15000, 20, 1, 1, 1760000000000, 1760000000000),
  ('v-kipas-fik', 'p-kipas', 'KIPAS-FIK', '{"fakultas":"FIK"}', 15000, 20, 1, 1, 1760000000000, 1760000000000),
  ('v-kipas-fpsi', 'p-kipas', 'KIPAS-FPSI', '{"fakultas":"FPPsi"}', 15000, 20, 1, 1, 1760000000000, 1760000000000),
  ('v-kipas-ft', 'p-kipas', 'KIPAS-FT', '{"fakultas":"FT"}', 15000, 20, 1, 1, 1760000000000, 1760000000000),
  ('v-kipas-fish', 'p-kipas', 'KIPAS-FISH', '{"fakultas":"FISH","foto":"/products/kipas-fish-960.webp","foto480":"/products/kipas-fish-480.webp"}', 15000, 20, 1, 1, 1760000000000, 1760000000000),
  ('v-kipas-fmipa', 'p-kipas', 'KIPAS-FMIPA', '{"fakultas":"FMIPA"}', 15000, 20, 1, 1, 1760000000000, 1760000000000),
  ('v-kipas-fbs', 'p-kipas', 'KIPAS-FBS', '{"fakultas":"FBS"}', 15000, 20, 1, 1, 1760000000000, 1760000000000),
  ('v-goodie', 'p-goodie', 'GOODIE-01', '{"warna":"natural","foto":"/products/goodie-bag.jpg"}', 25000, 30, 0, 0, 1760000000000, 1760000000000),
  ('v-kauskaki', 'p-kauskaki', 'KAUS-01', '{"warna":"putih","foto":"/products/kaus-kaki.jpg","foto480":"/products/kaus-kaki-480.webp"}', 15000, 40, 1, 1, 1760000000000, 1760000000000),
  ('v-gesper-perempuan', 'p-gesper', 'GESPER-P', '{"model":"Perempuan","foto":"/products/gesper-perempuan.jpg","foto480":"/products/gesper-perempuan-480.webp"}', 20000, 15, 1, 1, 1760000000000, 1760000000000),
  ('v-gesper-cowok', 'p-gesper', 'GESPER-C', '{"model":"Cowok","foto":"/products/gesper-cowok.jpg","foto480":"/products/gesper-cowok-480.webp"}', 20000, 15, 1, 1, 1760000000000, 1760000000000),
  ('v-slayer', 'p-slayer', 'SLAYER-01', '{"model":"segitiga","warna":"kuning","foto":"/products/slayer.jpg","foto480":"/products/slayer-480.webp"}', 30000, 25, 1, 1, 1760000000000, 1760000000000),
  ('v-slayer-feb', 'p-slayer', 'SLAYER-FEB', '{"fakultas":"FEB","foto":"/products/slayer-feb-960.webp","foto480":"/products/slayer-feb-480.webp"}', 30000, 8, 1, 1, 1760000000000, 1760000000000),
  ('v-slayer-fip', 'p-slayer', 'SLAYER-FIP', '{"fakultas":"FIP","foto":"/products/slayer-fip-960.webp","foto480":"/products/slayer-fip-480.webp"}', 30000, 8, 1, 1, 1760000000000, 1760000000000),
  ('v-slayer-fik', 'p-slayer', 'SLAYER-FIK', '{"fakultas":"FIK","foto":"/products/slayer-fik-960.webp","foto480":"/products/slayer-fik-480.webp"}', 30000, 8, 1, 1, 1760000000000, 1760000000000),
  ('v-slayer-fpsi', 'p-slayer', 'SLAYER-FPSI', '{"fakultas":"FPPsi","foto":"/products/slayer-fppsi-960.webp","foto480":"/products/slayer-fppsi-480.webp"}', 30000, 8, 1, 1, 1760000000000, 1760000000000),
  ('v-slayer-ft', 'p-slayer', 'SLAYER-FT', '{"fakultas":"FT","foto":"/products/slayer-ft-960.webp","foto480":"/products/slayer-ft-480.webp"}', 30000, 8, 1, 1, 1760000000000, 1760000000000),
  ('v-slayer-fis', 'p-slayer', 'SLAYER-FIS', '{"fakultas":"FIS","foto":"/products/slayer-fis-960.webp","foto480":"/products/slayer-fis-480.webp"}', 30000, 8, 1, 1, 1760000000000, 1760000000000),
  ('v-slayer-fmipa', 'p-slayer', 'SLAYER-FMIPA', '{"fakultas":"FMIPA","foto":"/products/slayer-fmipa-960.webp","foto480":"/products/slayer-fmipa-480.webp"}', 30000, 8, 1, 1, 1760000000000, 1760000000000),
  ('v-slayer-fbs', 'p-slayer', 'SLAYER-FBS', '{"fakultas":"FBS","foto":"/products/slayer-fbs-960.webp","foto480":"/products/slayer-fbs-480.webp"}', 30000, 8, 1, 1, 1760000000000, 1760000000000),
  ('v-rok', 'p-rok', 'ROK-01', '{"ukuran":"M","warna":"hitam","foto":"/products/rok-span.jpg","foto480":"/products/rok-span-480.webp"}', 85000, 12, 1, 1, 1760000000000, 1760000000000),
  ('v-dasi-feb', 'p-dasi', 'DASI-FEB', '{"fakultas":"FEB","foto":"/products/dasi-feb-960.webp","foto480":"/products/dasi-feb-480.webp"}', 25000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-dasi-fip', 'p-dasi', 'DASI-FIP', '{"fakultas":"FIP","foto":"/products/dasi-fip-960.webp","foto480":"/products/dasi-fip-480.webp"}', 25000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-dasi-fik', 'p-dasi', 'DASI-FIK', '{"fakultas":"FIK","foto":"/products/dasi-fik-960.webp","foto480":"/products/dasi-fik-480.webp"}', 25000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-dasi-fpsi', 'p-dasi', 'DASI-FPSI', '{"fakultas":"FPPsi","foto":"/products/dasi-fppsi-960.webp","foto480":"/products/dasi-fppsi-480.webp"}', 25000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-dasi-ft', 'p-dasi', 'DASI-FT', '{"fakultas":"FT","foto":"/products/dasi-ft-960.webp","foto480":"/products/dasi-ft-480.webp"}', 25000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-dasi-fis', 'p-dasi', 'DASI-FIS', '{"fakultas":"FIS","foto":"/products/dasi-fis-960.webp","foto480":"/products/dasi-fis-480.webp"}', 25000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-dasi-fmipa', 'p-dasi', 'DASI-FMIPA', '{"fakultas":"FMIPA","foto":"/products/dasi-fmipa-960.webp","foto480":"/products/dasi-fmipa-480.webp"}', 25000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-dasi-fbs', 'p-dasi', 'DASI-FBS', '{"fakultas":"FBS","foto":"/products/dasi-fbs-960.webp","foto480":"/products/dasi-fbs-480.webp"}', 25000, 10, 1, 1, 1760000000000, 1760000000000),
  ('v-kemeja', 'p-kemeja', 'KEMEJA-01', '{"ukuran":"M","warna":"putih"}', 95000, 10, 1, 1, 1760000000000, 1760000000000),
  -- Harga mengikuti tabel biaya custom MabaKit Define2 (harga dasar + biaya kustomisasi).
  ('v-notebook-feb', 'p-notebook', 'NOTEBOOK-FEB', '{"fakultas":"FEB","foto":"/products/notebook-feb-960.webp","foto480":"/products/notebook-feb-480.webp"}', 17000, 15, 1, 1, 1760000000000, 1760000000000),
  ('v-notebook-fip', 'p-notebook', 'NOTEBOOK-FIP', '{"fakultas":"FIP","foto":"/products/notebook-fip-960.webp","foto480":"/products/notebook-fip-480.webp"}', 17000, 15, 1, 1, 1760000000000, 1760000000000),
  ('v-notebook-fik', 'p-notebook', 'NOTEBOOK-FIK', '{"fakultas":"FIK","foto":"/products/notebook-fik-960.webp","foto480":"/products/notebook-fik-480.webp"}', 17000, 15, 1, 1, 1760000000000, 1760000000000),
  ('v-notebook-fpsi', 'p-notebook', 'NOTEBOOK-FPSI', '{"fakultas":"FPPsi","foto":"/products/notebook-fppsi-960.webp","foto480":"/products/notebook-fppsi-480.webp"}', 17000, 15, 1, 1, 1760000000000, 1760000000000),
  ('v-notebook-ft', 'p-notebook', 'NOTEBOOK-FT', '{"fakultas":"FT","foto":"/products/notebook-ft-960.webp","foto480":"/products/notebook-ft-480.webp"}', 17000, 15, 1, 1, 1760000000000, 1760000000000),
  ('v-notebook-fis', 'p-notebook', 'NOTEBOOK-FIS', '{"fakultas":"FIS","foto":"/products/notebook-fish-960.webp","foto480":"/products/notebook-fish-480.webp"}', 17000, 15, 1, 1, 1760000000000, 1760000000000),
  ('v-notebook-fmipa', 'p-notebook', 'NOTEBOOK-FMIPA', '{"fakultas":"FMIPA","foto":"/products/notebook-fmipa-960.webp","foto480":"/products/notebook-fmipa-480.webp"}', 17000, 15, 1, 1, 1760000000000, 1760000000000),
  ('v-notebook-fbs', 'p-notebook', 'NOTEBOOK-FBS', '{"fakultas":"FBS","foto":"/products/notebook-fbs-960.webp","foto480":"/products/notebook-fbs-480.webp"}', 17000, 15, 1, 1, 1760000000000, 1760000000000),
  ('v-nametag', 'p-nametag', 'NAMETAG-01', '{"warna":"putih"}', 7000, 50, 1, 1, 1760000000000, 1760000000000),
  ('v-bendera', 'p-bendera', 'BENDERA-01', '{"bahan":"kain"}', 15000, 25, 1, 1, 1760000000000, 1760000000000),
  ('v-lanyard', 'p-lanyard', 'LANYARD-01', '{"bahan":"tali"}', 12000, 40, 1, 1, 1760000000000, 1760000000000),
  ('v-bordir', 'p-bordir', 'BORDIR-01', '{"layanan":"bordir logo"}', 10000, 30, 1, 1, 1760000000000, 1760000000000);

INSERT OR IGNORE INTO variant_faculties (variant_id, faculty_id)
SELECT 'v-topi-' || lower(replace(replace(alias, 'FPPsi', 'fpsi'), 'FPPSI', 'fpsi')), faculty_id FROM faculty_aliases WHERE alias IN ('FEB','FIP','FIK','FPPsi','FT','FIS','FMIPA','FBS');
INSERT OR IGNORE INTO variant_faculties (variant_id, faculty_id) VALUES
  ('v-kipas-feb','fac-feb'), ('v-kipas-fip','fac-fip'), ('v-kipas-fik','fac-fik'), ('v-kipas-fpsi','fac-fpsi'),
  ('v-kipas-ft','fac-ft'), ('v-kipas-fish','fac-fish'), ('v-kipas-fmipa','fac-fmipa'), ('v-kipas-fbs','fac-fbs'),
  ('v-slayer-feb','fac-feb'), ('v-slayer-fip','fac-fip'), ('v-slayer-fik','fac-fik'), ('v-slayer-fpsi','fac-fpsi'),
  ('v-slayer-ft','fac-ft'), ('v-slayer-fis','fac-fish'), ('v-slayer-fmipa','fac-fmipa'), ('v-slayer-fbs','fac-fbs'),
  ('v-notebook-feb','fac-feb'), ('v-notebook-fip','fac-fip'), ('v-notebook-fik','fac-fik'), ('v-notebook-fpsi','fac-fpsi'),
  ('v-notebook-ft','fac-ft'), ('v-notebook-fis','fac-fish'), ('v-notebook-fmipa','fac-fmipa'), ('v-notebook-fbs','fac-fbs'),
  ('v-dasi-feb','fac-feb'), ('v-dasi-fip','fac-fip'), ('v-dasi-fik','fac-fik'), ('v-dasi-fpsi','fac-fpsi'),
  ('v-dasi-ft','fac-ft'), ('v-dasi-fis','fac-fish'), ('v-dasi-fmipa','fac-fmipa'), ('v-dasi-fbs','fac-fbs');

INSERT OR IGNORE INTO bundle_components (bundle_product_id, variant_id, quantity) VALUES
  ('p-paket', 'v-goodie', 1), ('p-paket', 'v-kauskaki', 1), ('p-paket', 'v-slayer', 1);

-- Setiap paket berlaku untuk semua fakultas. Isinya memakai varian fakultas yang dipilih,
-- jadi pembeli bisa ganti fakultas di halaman sesuaikan tanpa balik ke katalog.
DELETE FROM bundle_config_components WHERE config_id LIKE 'cfg-paket-%';
DELETE FROM bundle_configs WHERE id LIKE 'cfg-paket-%';

INSERT OR IGNORE INTO bundle_configs (id, bundle_product_id, faculty_id, price_rp, published, created_at, updated_at)
SELECT 'cfg-' || p.id || '-' || f.id, p.id, f.id, p.bundle_price_rp, 1, 1760000000000, 1760000000000
FROM products p JOIN faculties f ON 1 = 1
WHERE p.id LIKE 'p-paket-%';

INSERT OR IGNORE INTO bundle_config_components (config_id, variant_id, quantity)
SELECT c.id, vf.variant_id, 1
FROM bundle_configs c
JOIN variant_faculties vf ON vf.faculty_id = c.faculty_id
JOIN variants v ON v.id = vf.variant_id
WHERE c.bundle_product_id LIKE 'p-paket-%' AND v.product_id IN ('p-topi', 'p-kipas', 'p-slayer') AND v.active = 1;
INSERT OR IGNORE INTO bundle_config_components (config_id, variant_id, quantity)
SELECT c.id, 'v-kauskaki', 1 FROM bundle_configs c WHERE c.bundle_product_id LIKE 'p-paket-%';

-- Tier paket: satu config per fakultas supaya pembeli fakultas mana pun bisa langsung pesan,
-- tetapi produknya sendiri netral fakultas sehingga selalu tampil di katalog.
INSERT OR IGNORE INTO bundle_configs (id, bundle_product_id, faculty_id, price_rp, published, created_at, updated_at)
SELECT 'cfg-' || p.id || '-' || f.id, p.id, f.id, p.bundle_price_rp, 1, 1760000000000, 1760000000000
FROM products p JOIN faculties f ON 1 = 1
WHERE p.id IN ('p-tier-hemat', 'p-tier-praktis', 'p-tier-starter');

-- Isi tier: varian mengikuti fakultas pembeli bila ada, sisanya varian tunggal.
INSERT OR IGNORE INTO bundle_config_components (config_id, variant_id, quantity)
SELECT c.id, vf.variant_id, 1
FROM bundle_configs c
JOIN variant_faculties vf ON vf.faculty_id = c.faculty_id
JOIN variants v ON v.id = vf.variant_id
WHERE c.bundle_product_id IN ('p-tier-hemat', 'p-tier-praktis', 'p-tier-starter')
  AND v.active = 1
  AND (
    v.product_id = 'p-slayer'
    OR (v.product_id = 'p-notebook' AND c.bundle_product_id IN ('p-tier-praktis', 'p-tier-starter'))
    OR (v.product_id = 'p-topi' AND c.bundle_product_id = 'p-tier-starter')
  );
INSERT OR IGNORE INTO bundle_config_components (config_id, variant_id, quantity)
SELECT c.id, 'v-nametag', 1 FROM bundle_configs c
WHERE c.bundle_product_id IN ('p-tier-hemat', 'p-tier-praktis', 'p-tier-starter');
INSERT OR IGNORE INTO bundle_config_components (config_id, variant_id, quantity)
SELECT c.id, 'v-bendera', 1 FROM bundle_configs c WHERE c.bundle_product_id = 'p-tier-starter';

-- Fakultas asal paket, dipakai filter katalog. Migrasi 0014 menambah kolomnya;
-- baris seed baru butuh UPDATE ini karena migrasi berjalan sebelum seed.
UPDATE products SET faculty_id = 'fac-' || substr(id, 9) WHERE id LIKE 'p-paket-%' AND faculty_id IS NULL
  AND substr(id, 9) IN ('fip', 'fbs', 'fmipa', 'fish', 'ft', 'fik', 'feb', 'fpsi');

INSERT OR IGNORE INTO spec_checklists (id, product_id, label, sort_order) VALUES
  ('spec-topi-fakultas', 'p-topi', 'Pilih fakultas sesuai data peserta', 1),
  ('spec-notebook-fakultas', 'p-notebook', 'Pilih fakultas sesuai data peserta', 1),
  ('spec-nametag-nama', 'p-nametag', 'Kirim nama yang dicetak lewat WhatsApp setelah bayar', 1),
  ('spec-bordir-barang', 'p-bordir', 'Bordir dikerjakan di barang yang diserahkan ke panitia', 1),
  ('spec-gesper-model', 'p-gesper', 'Pilih model gesper saat memesan', 1),
  ('spec-dasi-fakultas', 'p-dasi', 'Pilih fakultas sesuai data peserta', 1),
  ('spec-paket-isi', 'p-paket-fip', 'Periksa isi paket saat pengambilan', 1),
  ('spec-paket-isi-fbs', 'p-paket-fbs', 'Periksa isi paket saat pengambilan', 1),
  ('spec-tier-hemat', 'p-tier-hemat', 'Periksa isi paket saat pengambilan', 1),
  ('spec-tier-praktis', 'p-tier-praktis', 'Periksa isi paket saat pengambilan', 1),
  ('spec-tier-starter', 'p-tier-starter', 'Periksa isi paket saat pengambilan', 1),
  ('spec-paket-isi-fmipa', 'p-paket-fmipa', 'Periksa isi paket saat pengambilan', 1),
  ('spec-paket-isi-fish', 'p-paket-fish', 'Periksa isi paket saat pengambilan', 1),
  ('spec-paket-isi-ft', 'p-paket-ft', 'Periksa isi paket saat pengambilan', 1),
  ('spec-paket-isi-fik', 'p-paket-fik', 'Periksa isi paket saat pengambilan', 1),
  ('spec-paket-isi-feb', 'p-paket-feb', 'Periksa isi paket saat pengambilan', 1),
  ('spec-paket-isi-fpsi', 'p-paket-fpsi', 'Periksa isi paket saat pengambilan', 1);

INSERT INTO store_settings (id, checkout_enabled, pickup_location_label, pickup_location_details, pickup_service_hours, pickup_version, updated_at)
VALUES (1, 1, 'Kampus A, Lobi Gedung B', 'Tunjukkan nomor pesanan dan nama penerima ke petugas di meja PKKMB.', 'Senin sampai Jumat, 09.00-15.00 WIB', 1, 1760000000000)
ON CONFLICT (id) DO UPDATE SET
  pickup_location_label = excluded.pickup_location_label,
  pickup_location_details = excluded.pickup_location_details,
  pickup_service_hours = excluded.pickup_service_hours;
