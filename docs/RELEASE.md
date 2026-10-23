# Gerbang demo dan produksi MabaKit

Revisi v2: 22 Oktober 2026. Semua checkbox BELUM DIVERIFIKASI. Dokumen bukan bukti aplikasi selesai. Bukti: ID | tanggal | environment/commit/migration | penanggung jawab | command/skenario | hasil | lokasi bukti. Jangan menyimpan secret/PII dalam evidence publik.

Booking/reservasi tidak diuji sebagai fitur karena di luar scope. Demo memakai Cloudflare Workers Static Assets, Workers API dan D1; pembayaran dummy, tanpa uang nyata.

## 1. Prasyarat demo

- [ ] Scope PRD/SCHEMA v2 disetujui; implementasi tugas kecil dan runnable checks disusun.
- [ ] Akun/binding staging Cloudflare disepakati sebelum resource dibuat; kuota/biaya diperiksa, database demo terpisah dari produksi.
- [ ] Demo lokal hanya fixture SIMULASI, tanpa secret merchant, email nyata atau data pelanggan.
- [ ] Seed akun presentasi (`mabakita@admin`, `tim@demo.mabakit`, `pembeli@demo.mabakit`) idempoten dan hanya untuk lingkungan presentasi terisolasi. Tidak ada reset password lewat email.

## 2. Database dan API

| ID | Kasus | Hasil wajib |
|---|---|---|
| T01 | Publik, akun A/B, staf dan admin mengakses semua API | Default deny, B tidak melihat order/invoice A; hanya projection minimum; tidak ada DB browser |
| T02 | Forged actor/role/status/total, CSRF/Origin salah, cookie invalid/expired | Ditolak tanpa mutasi; role bukan dari browser |
| T03 | Qty 0/-1/1.5/100, ID asing/nonaktif, paket kosong, email invalid, body >32 KB, field asing, total >10 juta | 400/409 sesuai kontrak, tidak ada alokasi parsial |
| T04 | Dua checkout SKU terakhir | Hanya satu berhasil; reserved <= on_hand, tanpa counter negatif |
| T05 | Satuan A×2 + paket A×1/B×2 | Total SIMULASI Rp60.000, A×3/B×2; B habis membatalkan seluruh batch, termasuk A/order/snapshot |
| T06 | Key sama/body sama paralel dan body berbeda | Satu draft/alokasi; hash beda 409; retry terminal mengembalikan status terkini |
| T07 | Harga/komposisi/instruksi berubah atau checkout ditutup saat submit | Snapshot konsisten atau 409; tidak mempercayai read lama di luar batch |
| T08 | Katalog/instruksi diubah setelah checkout | Snapshot/invoice order lama tidak berubah |
| T09 | Cek pembayaran dua tab/klik ulang vs expiry | Satu transisi, satu konsumsi stok/invoice; expired tidak menjadi PAID |
| T10 | Dua staf menandai READY/complete, complete diulang, izin dicabut di tengah alur | Satu transisi per status, stok tidak berkurang lagi, request tanpa izin 403, replay idempotent, audit mencatat aktor |
| T11 | Guard gagal pada statement batch kedua/terakhir | Seluruh batch rollback; meta.changes=0 tidak dianggap rollback otomatis |
| T12 | Stock adjustment di bawah reserved, FK invalid, JSON invalid | Constraint/guard menolak; mutasi sah diaudit |
| T13 | Telepon/nama invalid, markup, wali tanpa NIM | Validasi PRD; markup teks, tanpa NIM wajib |
| T14 | Cart rusak, refresh, double click, DB offline | Recovery aman, tidak membuat invoice/sukses lokal palsu |
| T15 | Batas 20 baris × komponen maksimum, rate limit paralel | Tidak melewati batas D1/limit; jika tak muat, scope dikurangi eksplisit, tanpa commit stok parsial |
| T16 | Akses `/team`, `/staff`, `/admin` tanpa sesi/pembeli/staf/admin; operator memakai cookie pembeli | 302 ke login operator, 403 tanpa data, `/staff` dialihkan ke `/team/orders`; variasi slash/persen-encoding/kapital tetap dijaga; respons `no-store` |
| T17 | Profil lintas akun, ulasan sebelum pickup/ganda, invoice akun lain | Profil terisolasi; ulasan hanya PAID+PICKED_UP satu per order; invoice hanya pemilik order PAID; publik tanpa kontak |
| T18 | Register/login buyer, login operator, logout tiap portal, login ulang | Akun operator ditolak di `/login` dan akun buyer ditolak di `/operator/login` oleh server; cookie portal terpisah; password tidak plaintext/ tidak dikembalikan API; logout satu portal tidak memutus portal lain; redirect hanya path allowlisted |
| T20 | Admin membuat staf, mengubah izin, menonaktifkan staf, admin terakhir menonaktifkan diri | Password awal tidak pernah dikembalikan; izin berlaku pada request berikutnya; sesi staf nonaktif langsung ditolak; admin terakhir ditolak; KPI menghitung transisi per aktor dan melabeli data tanpa aktor |
| T19 | Kepemilikan pesanan lintas sesi dan lintas browser | Login ulang menemukan pesanan akun yang sama; akun lain 404 untuk order/payment/invoice; admin tidak melewati ownership endpoint buyer; order legacy tidak ter-attach lewat kecocokan email |
| T20 | Quote dan stok paket per fakultas | Fakultas tanpa mapping tidak dapat checkout; ganti fakultas memperbarui komponen/varian/harga/stok dan meminta konfirmasi; stok paket = minimum floor komponen; harga konfigurasi belum ditetapkan ditolak, bukan nol |
| T21 | Permintaan langsung SKU tas putih/natural, termasuk totebag FIKK putih | Ditolak server lewat katalog, URL lama maupun API; tidak masuk paket/rekomendasi baru; snapshot order lama tetap utuh |
| T22 | CRUD admin produk/varian dan draft/publish paket | Harga rupiah integer positif dan stok divalidasi; publish ditolak bila slot/mapping/harga belum lengkap atau stock_on_hand di bawah reserved; staf ditolak; hash/password tidak dikembalikan |
| T24 | Diskon dan gratis | Diskon 12,5% dibulatkan integer, harga dasar tetap tersimpan, pesanan 100% gratis langsung PAID dengan invoice Rp0, stok terpakai sekali, replay idempoten, dan total tidak negatif |
| T25 | Galeri unggahan | Maksimal lima foto per produk ditegakkan D1; unggahan >5 MiB, >20 MP, atau tipe salah ditolak; hapus/sampul mengubah urutan; `/media/*` hanya menyajikan objek produk |
| T26 | Ekspor penjualan | CSV admin hanya transaksi PAID, filter tanggal WIB, seluruh baris (bukan 50 pertama), tanpa PII, sel berbahaya dinetralkan |
| T23 | Manifest gambar katalog | Setiap SKU aktif terpetakan ke `updatekatalog.pdf` (fallback `katalog.pdf`); notebook tidak memakai foto totebag; label `FEG` tidak dipetakan ke FEB; turunan tidak melebihi ukuran sumber; tidak ada upscale |

Uji SQLite/D1 lokal wajib dilanjutkan staging D1 nyata untuk atomic batch, constraint, contention dan idempotency. Hasil mock saja tidak membuktikan concurrency D1.

## 3. Alur presentasi

- [ ] D01: Katalog paket-first, produk satuan, penyesuaian fakultas, keranjang, register/login dan checkout berjalan dengan data SIMULASI.
- [ ] D02: Total dari server; metode transfer/e-wallet/QRIS tanpa rekening/QR/tautan bayar nyata.
- [ ] D03: Tombol `Cek status pembayaran` jelas memperagakan perpindahan ke pembayaran tercatat, bukan verifikasi bank; setelah klik tampil konfirmasi pesanan dan invoice.
- [ ] D04: Invoice digital responsif, nomor unik, rincian snapshot, metode, tanggal WIB, status PAID percobaan, keterangan `Dokumen percobaan, bukan bukti pembayaran sah.` termasuk pada cetak. Bukan faktur pajak.
- [ ] D05: Refresh/dua tab mengembalikan invoice sama; akun B tidak mengakses invoice A. PAID tidak otomatis READY.
- [ ] D06: Endpoint percobaan tidak terdaftar pada environment non-demo; row mode harus DEMO; reset operator tidak bisa menyentuh produksi.
- [ ] D07: Tidak ada panggilan Midtrans/Xendit/email nyata, merchant secret atau klaim integrasi gateway.
- [ ] D08: Akun pembeli persisten: register, login, logout, profil milik akun, riwayat pesanan lintas login, dan pesan berakhir terpisah untuk order expired. Sesi kedaluwarsa mengarah ke login, tidak melanjutkan transaksi sebagai tamu.
- [ ] D11: Rute admin terpisah per bagian dan refresh/deep-link mempertahankan bagian aktif; galeri unggahan tidak menerima path manual; CSV dan diskon hanya untuk admin.
- [ ] D09: Akun admin/staf masuk lewat `/operator/login` individual tanpa pemilih role atau kode bersama; pembeli masuk lewat `/login`; akun operator ditolak di portal pembeli dan sebaliknya; workspace `/team` hanya untuk staf/admin terverifikasi; kredensial operator tidak ada di bundle publik.
- [ ] D10: Dashboard admin mengelola akun tim dan izin; staf hanya menjalankan aksi yang diizinkan; admin tidak menjalankan fulfillment; KPI dan audit menampilkan aktor transisi.

ID D01-D09 di bagian ini adalah uji demo, bukan keputusan bisnis D01-D08 di BRD.

## 4. Frontend dan keamanan

- [ ] U01: Build/typecheck/tests lulus; semua kontrol dan route DESIGN benar-benar berfungsi, tanpa href # dummy. API 404 JSON tidak jatuh ke SPA fallback; refresh route UI berhasil.
- [ ] U02: Mobile 360/390/430, tablet 768, desktop 1280, zoom 200%, keyboard/pembaca layar; target 48px, fokus tidak tertutup.
- [ ] U03: Kontras terukur, status bukan warna saja, modal Escape/focus return, reduced motion, loading/empty/error/offline.
- [ ] U04: Gambar dari manifest, tanpa statistik/testimoni/afiliasi palsu; tanpa badge demo berulang di hero/katalog/nav/login/detail; keterangan percobaan hanya di pembayaran, invoice dan konteks dashboard.
- [ ] U05: Cookie HttpOnly/Secure/SameSite, hash token saja, PBKDF2-SHA256 bergaram untuk password, Origin+CSRF, prepared SQL, projection/ownership dan redaksi log diuji. Email/password tidak muncul di URL, localStorage, log atau bundle.
- [ ] U06: Rate limit server bekerja pada request paralel/lintas instance, bukan hanya map memory; sesi baru tidak melewati batas login dan hold aktif 2/akun serta 10/IP hash. Metadata IP terpercaya, tanpa IP mentah di log/DB. Secret bukan VITE_* atau bundle.
- [ ] U07: Pilot 20 checkout paralel dengan invariant; ukur target PRD, jangan mengklaim hasil tanpa bukti.
- [ ] U08: Migrasi versioned local/staging, backup/restore demo terisolasi, seed idempoten dan cara reset operator diuji; tidak menghapus data produksi dan tidak memasang order legacy ke akun.
- [ ] U09: Mobile dan desktop 2×: tulisan fakultas terbaca sesuai sumber, warna tidak berubah mencolok, tanpa crop barang, blur akibat upscale, rasio rusak atau gambar salah SKU.

## 5. Produksi, ditunda

Tidak ada go-live uang nyata melalui checklist demo. Sebelum produksi perlu gerbang terpisah:

- [ ] Keputusan bisnis D01-D08 BRD lengkap, legalitas/harga/stok/lokasi/kebijakan/retensi/anggaran disahkan.
- [ ] Hardening autentikasi produksi: verifikasi email, recovery password, MFA admin, kebijakan sesi dan rotasi kunci, audit dan akses minimum diuji.
- [ ] Pilih satu gateway, tulis kontrak status/signature/amount/expiry/idempotency/timeout/refund; uji sandbox, duplicate/out-of-order/late settlement, webhook dan rekonsiliasi.
- [ ] Endpoint demo dihapus/ditolak, database DEMO tidak dipromosikan menjadi transaksi nyata, kredensial seed diganti atau dinonaktifkan.
- [ ] Paket cloud/limit/biaya/backup, alarm/insiden, pemulihan snapshot serta register handover disetujui dan diuji. Budget alert bukan spending cap.
- [ ] Produksi/staging terpisah, deployment dan migrasi nondestruktif disetujui; smoke test uang nyata hanya dengan izin eksplisit pemilik.

Toko tidak siap produksi hanya karena invoice percobaan muncul.

## 6. Bukti lokal v1, 22 Oktober 2026

Bagian ini merekam bukti v1 apa adanya dan tidak mencakup kontrak v2. Angka dipertahankan sebagai riwayat; jangan dipakai sebagai klaim bahwa akun persisten, paket per fakultas, admin CRUD atau manifest gambar sudah teruji.

Lingkungan: branch feat/cloudflare-demo, Node 22, wrangler local, D1 lokal. Bukan staging D1, bukan perangkat fisik, bukan deployment publik. Checkbox di atas tetap belum dicentang karena bukti staging/izin belum ada.

| Bukti | Command/skenario | Hasil |
|---|---|---|
| Unit/API | `npm test` | frontend 10 + backend 77 = 87 lulus |
| Tipe | `npm run typecheck` | exit 0 |
| Build | `npm run build` | exit 0, dist dihasilkan |
| Migrasi/seed | `npm run db:migrate:local`, `npm run db:seed:local` | sukses, produk 5, varian 7 |
| E2E lokal | sesi, katalog, checkout 2 item Rp215.000, Cek status pembayaran, invoice | order MBK-261022-QTX9QW, PAID, invoice INV-MBK-261022-QTX9QW berwatermark SIMULASI |
| Serah terima | staf READY lalu complete manual, replay complete | status PICKED_UP, replay 200 tanpa efek stok kedua; tiket QR tidak dipakai |
| Routing | 10 route UI, `/api/nope` | UI 200, API 404 JSON |
| Guard | backend/test/worker/sql-guards.test.ts | rollback batch, race SKU terakhir, hold limit, stale price, konsumsi sekali, expiry, READY/PICKED_UP, stok di bawah reserved |
| Workspace privat | backend/test/worker/customer-team.test.ts | guard halaman/API tim, 401/403, redirect `/staff`, rate limit sumber, ringkasan >50 order, batas WIB, cursor, logout/revoke, profil, ulasan |
| Keamanan | backend/test/worker/api.test.ts | CSRF/Origin salah, sesi lain, kode operator salah berulang, replay key sama, key sama payload beda |
| Secret | `rg` pola key + `git check-ignore .dev.vars` | tidak ada secret; .dev.vars diabaikan |

Catatan: concurrency diuji pada emulasi `node:sqlite`, belum pada D1 nyata. Audit keyboard/mobile/kontras berbasis inspeksi kode dan test, belum uji perangkat atau screen reader. Uji manual dua workspace, 360px, 200% zoom dan deployment belum dijalankan pada revisi ini. T18-T23 dan U09 belum memiliki bukti.
