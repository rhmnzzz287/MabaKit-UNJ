# Rencana MabaKit: demo Cloudflare

Revisi: 22 Oktober 2026. Menggantikan rencana Supabase/gateway produksi. Kontrak aktif docs/PRD.md dan docs/SCHEMA.md. Scope: demo presentasi dosen, pembayaran simulasi dan invoice digital HTML, tanpa booking/reservasi. Rencana tingkat fase; sebelum implementasi tiap tugas perlu check/command/hasil expected yang spesifik.

## Bukti historis, bukan kelengkapan demo

Scaffold React/Vite/Tailwind sudah dibuat. Commit baseline 07bd3e1, scaffold 4f29705; hasil lokal sebelumnya typecheck exit 0, Vitest 1 passed, build exit 0. CI file ada, job remote belum diverifikasi. Belum ada Worker, migrasi D1, deploy Cloudflare atau gateway. Test scaffold bukan bukti checkout/invoice/akses selesai. Tidak ada ESLint/Prettier; jangan mengklaim terpasang.

## Tugas aktif

- [x] T1. Detailkan rencana implementasi dari spesifikasi Cloudflare/demo; audit scaffold/config/test sebelum menambah kode. Hapus placeholder href # saat membangun UI. Bukti: PLAN tingkat fase + AGENT.md; scaffold commit 4f29705.
- [x] T2. Tambah Wrangler dan Workers types minimum, Static Assets dist/, API routing sebelum SPA fallback, binding DB lokal, typecheck Worker dan contoh non-secret config. Bukti dev lokal, API 404 JSON dan refresh route UI. Bukti: wrangler.jsonc, worker/index.ts, tsconfig.worker.json; 10 route UI 200 dan /api/nope 404 JSON.
- [x] T3. Migrasi D1 SQLite tabel/constraint/index/trigger sesuai SCHEMA; seed SIMULASI terpisah. Bukti migrasi lokal dan staging setelah izin resource diberikan; tidak perlu kredensial Supabase. Bukti: db/migrations/0001_init.sql, db/seed.sql; products 5, variants 7.
- [x] T4. TDD checkout D1: total/snapshot server, batch guards rollback, idempotency, race SKU/paket, versi stale, expiry. Bukti RELEASE T03-T09/T11/T12/T15, termasuk D1 nyata. Bukti: test/worker/sql-guards.test.ts 9 lulus (oversell rollback, race SKU terakhir, hold limit, stok stale, konsumsi sekali, expiry, READY/claim, stok di bawah reserved).
- [x] T5. Sesi tamu demo cookie/hash/CSRF/ownership/rate limit; operator demo diprovisioning terpercaya, tanpa self-assign role. Bukti forged actor, sesi lain, cookie/Origin invalid ditolak. Bukti: worker/session.ts, requireMutation/requireSession, test/worker/api.test.ts; kode operator salah 403.
- [x] T6. Endpoint simulasi check-payment hanya DEMO; PAID/CONSUMED dan invoice unik atomik, retry aman, expired ditolak. Bukti test duplikat, dua tab, expiry race dan endpoint tertutup non-demo. Bukti: worker/orders.ts + trigger trg_payment_confirm; invoice kedua idempoten; expiry 409.
- [x] T7. UI katalog/detail/keranjang/checkout/metode simulasi/cek status/order/invoice dari snapshot. Bukti alur penuh, refresh, error/empty/loading, label SIMULASI dan tidak ada request gateway. Bukti: src/pages/*, 4 test UI; e2e curl order MBK-261022-C64GZM total 215000 -> PAID -> invoice berwatermark.
- [x] T8. Staf/admin demo minimum, packing/READY/pickup sekali, katalog/stok/settings/audit. Bukti akses operator dan claim race. Bukti: worker/staff.ts, worker/admin.ts; e2e READY -> token D3WBNDTQ -> lookup -> PICKED_UP; claim kedua ditolak.
- [x] T9. Audit keyboard/mobile/kontras, semua kontrol, API routing, secret scan; build/typecheck/test; lengkapi bukti RELEASE demo tanpa centang produksi. Bukti: 49 test lulus, typecheck UI/Worker bersih, build sukses, skip link + label + focus-visible ada, tidak ada teks kontras rendah di src, secret scan bersih, .dev.vars ignored.
- [ ] T10. Deployment demo Cloudflare hanya setelah izin akun/binding/kuota/biaya; migrasi staging, smoke test publik dan backup/reset demo terisolasi. Belum dijalankan: menunggu izin pemilik.

Catatan T9: audit keyboard/mobile dilakukan lewat inspeksi kode dan uji otomatis, belum uji perangkat fisik atau screen reader.

## Ditunda, bukan bagian penyelesaian presentasi

Midtrans/Xendit, merchant key, webhook, cron rekonsiliasi, refund uang nyata, akun pelanggan permanen/email OTP/MFA produksi, PDF/email invoice otomatis. R2 baru saat upload diperlukan. Sesudah dosen/pemilik ingin lanjut, pilih satu gateway, lengkapi D01-D08 BRD dan kontrak produksi/sandbox.

## Keputusan dan batas

Cloudflare penuh dipilih pemilik. Dummy payment diminta untuk mengejar presentasi. Usulan teknis sesi tamu demo dan invoice HTML menghindari provider email/PDF yang belum perlu; tidak mengklaim akun produksi. Tidak ada cloud resource/deploy/uang nyata melalui revisi dokumentasi. Arsitektur/kuota D1 diperiksa ke dokumentasi resmi sebelum implementasi, khususnya batch limits dan SQL guard rollback. Jika invariant gagal, demo transaksi diblokir sampai benar; tidak mengendurkan keamanan demi jadwal.
