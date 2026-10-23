# Audit end-to-end MabaKit, 23 Oktober 2026

Status: temuan untuk diperbaiki, bukan klaim seluruh acceptance criteria lulus. Kode aplikasi tidak diubah dalam audit ini.

## Metode dan hasil verifikasi

- `npm test`: 21 frontend dan 130 backend test lulus.
- `npm run typecheck`: lulus.
- `npm run build`: lulus; JS 374.42 kB, gzip 104.76 kB.
- Worker lokal `http://localhost:8787`: HTTP 200.
- Smoke HTTP dengan cookie terpisah: buyer, staff, admin berhasil login. Buyer dapat membaca pesanan sendiri; tanpa cookie operator, API team/admin/export menolak 401. Staff dapat membaca team orders, ditolak 403 pada admin catalog dan ekspor. Admin mendapat 200 pada team orders, admin catalog dan CSV.
- Pembentukan sesi operator memakai body `{"portal":"operator"}` pada `/api/demo/session`, bukan query portal saja. Percobaan awal memakai query saja ditolak login 401; ini kesalahan probe, bukan temuan aplikasi.
- Dua review read-only memeriksa backend dan frontend serta kesesuaian spesifikasi. Pemeriksaan SQLite menemukan kegagalan FK saat menyimpan konfigurasi paket seed.
- Test hijau tidak menutup temuan di bawah. Mayoritas reproduksi berasal dari penelusuran kode; langkah yang belum dijalankan disebutkan eksplisit.

## Prioritas

P1: kerusakan pembelian/data atau autentikasi yang perlu didahulukan. P2: fungsi tidak sesuai atau risiko transaksi yang perlu perbaikan sebelum rilis. P3: inkonsistensi terbatas.

## Temuan backend

### B01 / P1: Paket tidak lengkap masih dapat dibeli
- Lokasi: `backend/src/checkout.ts:128-137`; pembanding `backend/src/catalog.ts:254-255`.
- Query checkout membuang komponen inactive/unsellable sebelum memvalidasi paket. Selama masih ada komponen tersisa, pembelian berlanjut dengan harga paket penuh.
- Reproduksi: nonaktifkan satu komponen paket published yang memiliki beberapa komponen; POST checkout langsung. Komponen tersebut tidak masuk snapshot, tetapi paket tetap diterima.
- Bukti: jalur kode terkonfirmasi; reproduksi HTTP belum dijalankan.
- Perbaikan: muat seluruh komponen konfigurasi, tolak jika salah satu tidak layak, validasi konfigurasi saat commit.
- Regresi: menonaktifkan satu komponen harus menolak quote dan checkout tanpa perubahan stok/order.
- Status 2026-10-23 (sudah diperbaiki): `backend/src/checkout.ts` memuat seluruh komponen config (tanpa filter `active/sellable` di SQL) dan menolak bila salah satu tidak layak. Regresi: `checkout paket ditolak bila satu komponen tidak layak (B01)` di `backend/test/worker/api.test.ts`.

### B02 / P1: Konfigurasi paket seed tidak dapat disimpan
- Lokasi: `backend/src/admin-catalog.ts:315-336`, `backend/db/seed.sql:86`.
- ID baru `cfg-${packageId}-${facultyId}` berbeda dari ID seed seperti `cfg-hemat-fbs`. Upsert mempertahankan ID lama; insert komponen memakai ID baru yang tidak ada.
- Reproduksi: simpan konfigurasi `p-paket-hemat` / `fac-fbs` dengan komponen valid.
- Bukti: SQLite menghasilkan `FOREIGN KEY constraint failed`; transaksi rollback.
- Perbaikan: gunakan ID row existing atau ID dari `RETURNING id` untuk seluruh penggantian komponen.
- Regresi: edit harga, komponen dan published pada setiap konfigurasi seed harus berhasil atomik.
- Status 2026-10-23 (sudah diperbaiki): `backend/src/admin-catalog.ts` membaca ID config existing lalu memakainya untuk upsert dan penggantian komponen. Regresi: `konfigurasi paket seed dapat disimpan ulang dengan ID existing (B02)` di `backend/test/worker/api.test.ts`.

### B03 / P2: Batas pesanan gratis tidak atomik
- Lokasi: `backend/src/checkout.ts:175-182`, `backend/src/checkout.ts:267`.
- Cek dua pesanan gratis per akun per jam dilakukan sebelum transaksi. Request paralel dengan key berbeda dapat melewati batas.
- Reproduksi yang perlu dijalankan: satu order gratis sudah ada; kirim dua checkout gratis paralel dari akun sama.
- Perbaikan: batas akun/jam ditegakkan dalam transaksi atau trigger; replay idempotensi tetap diproses lebih dulu.
- Regresi: hanya satu request tambahan berhasil; stok tidak berkurang untuk request tertolak.

### B04 / P2: Konfigurasi paket dapat berubah di antara pembacaan dan commit
- Lokasi: `backend/src/checkout.ts:128-145`, `backend/src/checkout.ts:267`, `backend/src/admin-catalog.ts:318-336`.
- Harga/komponen dibaca terpisah; perubahan konfigurasi tidak menaikkan versi produk yang diperiksa trigger item.
- Risiko: komponen lama dengan harga baru, atau checkout setelah unpublish.
- Bukti: guard transaksi tidak ada; interleaving belum dijalankan.
- Perbaikan: versi konfigurasi, naikkan pada setiap perubahan, periksa versi dan published dalam batch checkout.

### B05 / P2: Batas body diperiksa setelah buffering
- Lokasi: `backend/src/admin-media.ts:51-54`, `backend/src/http.ts:147-150`.
- Upload tanpa Content-Length dibaca seluruhnya sebelum batas 5 MiB diperiksa. JSON dibuffer sebelum batas 32 KB, dihitung sebagai panjang string bukan byte.
- Perbaikan: pembacaan stream dibatasi byte dan dibatalkan saat melewati limit.
- Bukti: buffering terkonfirmasi; kehabisan memori Worker belum dibuktikan. Upload memerlukan admin.

### B06 / P3: Foto baru selalu menjadi sampul
- Lokasi: `backend/src/admin-media.ts:64-86`, `backend/src/admin-media.ts:102-110`.
- Upload A lalu B membuat sampul B meskipun urutan galeri A/B. Delete/reorder mengikuti foto pertama.
- Perbaikan: setelah insert, pilih sampul melalui `ORDER BY position, id`.
- Regresi: upload kedua tidak mengubah sampul pertama; reorder eksplisit mengubahnya.

### B07 / P3: Filter CSV menerima tanggal mustahil
- Lokasi: `backend/src/admin-export.ts:27-30`.
- `2026-02-30` dapat dinormalisasi menjadi Maret oleh Date.parse.
- Perbaikan: round-trip tanggal WIB dan cocokkan persis input; tolak tanggal invalid.

## Temuan frontend

Semua langkah frontend berikut berasal dari penelusuran kode, belum click-through browser.

| ID | Prioritas | Lokasi | Masalah dan reproduksi | Arah perbaikan |
| --- | --- | --- | --- | --- |
| F01 | P1 | `frontend/src/pages/CartPage.tsx:56-59` | Ubah fakultas langsung menghapus line; Back/batal menghilangkan konfigurasi dan quantity | Simpan line sampai penggantian dikonfirmasi; pertahankan quantity/fakultas |
| F02 | P1 | `frontend/src/lib/auth-store.ts:43-50`, `frontend/src/pages/LoginPage.tsx:25-27`, `frontend/src/pages/OperatorLoginPage.tsx:26-30` | Refresh setelah login dapat memakai request guest yang masih berjalan; hasil terlambat memulihkan guest, bahkan memicu logout operator | Invalidasi/versioning request; wajib fetch baru setelah login; test respons terbalik |
| F03 | P2 | `frontend/src/lib/workspace.ts:32-34`, `frontend/src/pages/OperatorLoginPage.tsx:17-19` | Admin default ke /team; staff next=/admin diarahkan ke halaman ditolak | Tentukan next setelah role diketahui; default staff /team/orders, admin /admin |
| F04 | P2 | `frontend/src/pages/CustomizePage.tsx:59-66`, `frontend/src/pages/CustomizePage.tsx:254-269` | Ganti fakultas saat jaringan lambat masih dapat menambah quote fakultas lama | Disable add saat loading; quote faculty wajib sama dengan pilihan |
| F05 | P2 | `frontend/src/pages/CustomizePage.tsx:42-47` | Package ID invalid/tanpa opsi fakultas meninggalkan loading tanpa akhir | State not-found/unavailable dengan tautan katalog |
| F06 | P2 | `frontend/src/pages/TeamPage.tsx:437-451` | Aksi gagal hanya menampilkan error; order/izin tetap stale setelah transisi lain atau pencabutan izin | Refetch order pada conflict; refresh auth pada penolakan izin |
| F07 | P2 | `frontend/src/pages/AdminPage.tsx:1683-1745` | Staff disabled tidak memiliki kontrol aktifkan kembali | Tambah enable eksplisit, pisahkan dari revoke sesi |
| F08 | P2 | `frontend/src/pages/ProductPage.tsx:99-108`, `backend/src/catalog.ts:116-129` | Galeri upload admin tidak diekspos ke detail pembeli; hanya satu foto | Response galeri publik dan pemilih foto accessible |
| F09 | P2 | `frontend/src/pages/AdminPage.tsx:22-26` | Diskon 12.345 dibulatkan ke 12.35%; format 1e1 diterima | Validasi sintaks desimal maksimal dua angka sebelum konversi basis points |
| F10 | P2 | `frontend/src/pages/CheckoutPage.tsx:222-245` | Keranjang gratis tetap meminta metode pembayaran | Setelah total server diverifikasi nol, sembunyikan metode dan jelaskan tanpa pembayaran |
| F11 | P2 | `frontend/src/components/ui.tsx:106-153`, `frontend/src/pages/CheckoutPage.tsx:152-194` | Hint/error Field tidak otomatis terhubung ke kontrol; aria-describedby/aria-invalid tidak konsisten | Hubungkan ID error/hint dan invalid state pada kontrol; test accessibility properties |

## Kesenjangan dokumen dan implementasi

1. Status spesifikasi portal dan refresh masih menyatakan dokumentasi/proposal meskipun implementasi sudah ada. Tambahkan status implementasi dan tautan bukti; jangan menghapus sejarah proposal.
2. `frontend/src/pages/AdminPage.tsx:29-38` memakai segmen Indonesia seperti `/admin/ringkasan`, `/admin/pesanan`, `/admin/katalog`, `/admin/akses`, sedangkan spec refresh menyebut overview/orders/catalog/team. Unknown section diperlakukan sebagai ringkasan pada `frontend/src/pages/AdminPage.tsx:167`. Putuskan kontrak URL, dokumentasikan alias atau berikan 404 eksplisit.
3. `frontend/src/pages/AdminPage.tsx:175-183` tetap memuat summary dan seluruh catalog untuk setiap section, bukan hanya data halaman aktif.
4. `frontend/src/pages/AdminPage.tsx:761-823` belum menyediakan edit alt text, pengurutan arbitrer, preview lokal dan progress upload sesuai rancangan galeri. Pilih implementasi atau revisi scope secara eksplisit.
5. Rancangan refresh masih berstatus proposal. Kesenjangan terhadap proposal harus dikonfirmasi scope-nya; bukan otomatis bukti pelanggaran kontrak produksi.

## Urutan perbaikan dan acceptance

1. B01, B02: keutuhan paket dan pengeditan konfigurasi seed; tambah regresi SQLite/API.
2. F01, F02, F04: lindungi cart dan auth dari kehilangan data/respons stale; test jaringan lambat dan respons terbalik.
3. B03, B04: race checkout; test paralel di D1 staging, bukan hanya node:sqlite.
4. F03, F05, F06, F07: navigasi per-role, state terminal dan pemulihan izin/order.
5. F08, F09, F10, F11, B05, B06, B07: galeri, validasi, aksesibilitas dan batas input.
6. Sinkronkan PRD/SCHEMA/DESIGN/RELEASE serta status spesifikasi dengan keputusan final.
7. Jalankan ulang test/typecheck/build, lalu browser E2E buyer checkout berbayar/gratis, invoice, review, fulfillment staff, admin katalog/paket/team/export.

## Belum diverifikasi; jangan dinyatakan lulus

- Browser nyata: desktop/mobile 360/768/1280px, zoom 200%, keyboard-only, screen reader, pengukuran kontras, reduced-motion dan print.
- Tidak ada Chromium/Playwright terpasang yang ditemukan pada pemeriksaan lingkungan; tidak memasang dependency baru dalam audit.
- D1 staging concurrency, race free-order/config, R2 failure injection dan upload paralel.
- Spreadsheet nyata untuk CSV, metadata/file gambar rusak dan beban body besar.
- Audit bukan pemeriksaan setiap baris seluruh form admin; tidak mengklaim bebas bug atau siap produksi.
- Tidak ada deploy, push, perubahan kode aplikasi, reset DB, atau pengujian destruktif dilakukan oleh audit ini.
