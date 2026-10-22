# Gerbang demo dan produksi MabaKit

Revisi: 22 Oktober 2026. Semua checkbox BELUM DIVERIFIKASI. Dokumen bukan bukti aplikasi selesai. Bukti: ID | tanggal | environment/commit/migration | penanggung jawab | command/skenario | hasil | lokasi bukti. Jangan menyimpan secret/PII dalam evidence publik.

Booking/reservasi tidak diuji sebagai fitur karena di luar scope. Demo memakai Cloudflare Workers Static Assets, Workers API dan D1; pembayaran dummy, tanpa uang nyata.

## 1. Prasyarat demo

- [ ] Scope PRD/SCHEMA demo disetujui; implementasi tugas kecil dan runnable checks disusun.
- [ ] Akun/binding staging Cloudflare disepakati sebelum resource dibuat; kuota/biaya diperiksa, database demo terpisah dari produksi.
- [ ] Demo lokal hanya fixture SIMULASI, tanpa secret merchant, OTP/email nyata atau data pelanggan.

## 2. Database dan API

| ID | Kasus | Hasil wajib |
|---|---|---|
| T01 | Publik, sesi A/B, staf dan admin mengakses semua API | Default deny, B tidak melihat order/invoice A; hanya projection minimum; tidak ada DB browser |
| T02 | Forged actor/role/status/total, CSRF/Origin salah, cookie invalid/expired | Ditolak tanpa mutasi; role bukan dari browser |
| T03 | Qty 0/-1/1.5/100, ID asing/nonaktif, paket kosong, body >32 KB, field asing, total >10 juta | 422/409 sesuai kontrak, tidak ada alokasi parsial |
| T04 | Dua checkout SKU terakhir | Hanya satu berhasil; reserved <= on_hand, tanpa counter negatif |
| T05 | Satuan A×2 + paket A×1/B×2 | Total SIMULASI Rp60.000, A×3/B×2; B habis membatalkan seluruh batch, termasuk A/order/snapshot |
| T06 | Key sama/body sama paralel dan body berbeda | Satu draft/alokasi; hash beda 409; retry terminal mengembalikan status terkini |
| T07 | Harga/komposisi/instruksi berubah atau checkout ditutup saat submit | Snapshot konsisten atau 409; tidak mempercayai read lama di luar batch |
| T08 | Katalog/instruksi diubah setelah checkout | Snapshot/invoice order lama tidak berubah |
| T09 | Cek pembayaran dua tab/klik ulang vs expiry | Satu transisi, satu konsumsi stok/invoice; expired tidak menjadi PAID |
| T10 | Dua staf claim, token salah/rotasi, sesi bukan owner issue token | Satu penyerahan; token lama invalid, tidak ada pengurangan stok kedua |
| T11 | Guard gagal pada statement batch kedua/terakhir | Seluruh batch rollback; meta.changes=0 tidak dianggap rollback otomatis |
| T12 | Stock adjustment di bawah reserved, FK invalid, JSON invalid | Constraint/guard menolak; mutasi sah diaudit |
| T13 | Telepon/nama invalid, markup, wali tanpa NIM | Validasi PRD; markup teks, tanpa NIM wajib |
| T14 | Cart rusak, refresh, double click, DB offline | Recovery aman, tidak membuat invoice/sukses lokal palsu |
| T15 | Batas 20 baris × komponen maksimum, sesi/rate limit paralel | Tidak melewati batas D1/limit; jika tak muat, scope dikurangi eksplisit, tanpa commit stok parsial |

Uji SQLite/D1 lokal wajib dilanjutkan staging D1 nyata untuk atomic batch, constraint, contention dan idempotency. Hasil mock saja tidak membuktikan concurrency D1.

## 3. Alur presentasi

- [ ] D01: Katalog, varian, paket, keranjang dan checkout berjalan dengan data SIMULASI.
- [ ] D02: Total dari server; metode transfer/e-wallet/QRIS berlabel simulasi, tanpa rekening/QR/tautan bayar nyata.
- [ ] D03: Tombol Cek status pembayaran jelas menyimulasikan sukses, bukan verifikasi bank; setelah klik tampil konfirmasi pesanan dan invoice.
- [ ] D04: Invoice digital responsif, nomor unik, rincian snapshot, metode, tanggal WIB, status PAID SIMULASI, watermark bukan bukti pembayaran nyata. Bukan faktur pajak.
- [ ] D05: Refresh/dua tab mengembalikan invoice sama; sesi B tidak mengakses invoice A. PAID tidak otomatis READY.
- [ ] D06: Endpoint demo tidak terdaftar pada environment non-demo; row mode harus DEMO; reset operator tidak bisa menyentuh produksi.
- [ ] D07: Tidak ada panggilan Midtrans/Xendit/email nyata, merchant secret atau klaim integrasi gateway.
- [ ] D08: Sesi tamu dan keterbatasan lintas perangkat dijelaskan; admin demo tidak tersedia melalui self-assign role.

ID D01-D08 di bagian ini adalah uji demo, bukan keputusan bisnis D01-D08 di BRD.

## 4. Frontend dan keamanan

- [ ] U01: Build/typecheck/tests lulus; semua kontrol dan route DESIGN benar-benar berfungsi, tanpa href # dummy. API 404 JSON tidak jatuh ke SPA fallback; refresh route UI berhasil.
- [ ] U02: Mobile 360/390/430, tablet 768, desktop 1280, zoom 200%, keyboard/pembaca layar; target 48px, fokus tidak tertutup.
- [ ] U03: Kontras terukur, status bukan warna saja, modal Escape/focus return, reduced motion, loading/empty/error/offline.
- [ ] U04: Foto berizin/placeholder berlabel, tanpa statistik/testimoni/afiliasi palsu; seluruh harga/lokasi/invoice demo SIMULASI.
- [ ] U05: Cookie HttpOnly/Secure/SameSite, token hash-only, Origin+CSRF, prepared SQL, projection/ownership dan redaksi log diuji.
- [ ] U06: Rate limit server bekerja pada request paralel/lintas instance, bukan hanya map memory; sesi baru tidak melewati batas 10 sesi/menit/IP hash dan hold aktif 2/sesi serta 10/IP hash. Metadata IP terpercaya, tanpa IP mentah di log/DB. Secret bukan VITE_* atau bundle.
- [ ] U07: Pilot 20 checkout paralel dengan invariant; ukur target PRD, jangan mengklaim hasil tanpa bukti.
- [ ] U08: Migrasi versioned local/staging, backup/restore demo terisolasi dan cara reset operator diuji; tidak menghapus data produksi.

## 5. Produksi, ditunda

Tidak ada go-live uang nyata melalui checklist demo. Sebelum produksi perlu gerbang terpisah:

- [ ] Keputusan bisnis D01-D08 BRD lengkap, legalitas/harga/stok/lokasi/kebijakan/retensi/anggaran disahkan.
- [ ] Autentikasi pelanggan produksi, provider email, MFA admin, recovery/revocation, audit dan akses minimum diuji.
- [ ] Pilih satu gateway, tulis kontrak status/signature/amount/expiry/idempotency/timeout/refund; uji sandbox, duplicate/out-of-order/late settlement, webhook dan rekonsiliasi.
- [ ] Endpoint demo dihapus/ditolak, database DEMO tidak dipromosikan menjadi transaksi nyata.
- [ ] Paket cloud/limit/biaya/backup, alarm/insiden, pemulihan snapshot serta register handover disetujui dan diuji. Budget alert bukan spending cap.
- [ ] Produksi/staging terpisah, deployment dan migrasi nondestruktif disetujui; smoke test uang nyata hanya dengan izin eksplisit pemilik.

Toko tidak siap produksi hanya karena invoice simulasi muncul.
