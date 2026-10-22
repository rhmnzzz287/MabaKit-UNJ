# Rencana MabaKit: demo Cloudflare

Revisi: 22 Oktober 2026. Menggantikan rencana Supabase/gateway produksi. Kontrak aktif docs/PRD.md dan docs/SCHEMA.md. Scope: demo presentasi dosen, pembayaran simulasi dan invoice digital HTML, tanpa booking/reservasi. Rencana tingkat fase; sebelum implementasi tiap tugas perlu check/command/hasil expected yang spesifik.

## Bukti historis, bukan kelengkapan demo

Scaffold React/Vite/Tailwind sudah dibuat. Commit baseline 07bd3e1, scaffold 4f29705; hasil lokal sebelumnya typecheck exit 0, Vitest 1 passed, build exit 0. CI file ada, job remote belum diverifikasi. Belum ada Worker, migrasi D1, deploy Cloudflare atau gateway. Test scaffold bukan bukti checkout/invoice/akses selesai. Tidak ada ESLint/Prettier; jangan mengklaim terpasang.

## Tugas aktif

- [ ] T1. Detailkan rencana implementasi dari spesifikasi Cloudflare/demo; audit scaffold/config/test sebelum menambah kode. Hapus placeholder href # saat membangun UI.
- [ ] T2. Tambah Wrangler dan Workers types minimum, Static Assets dist/, API routing sebelum SPA fallback, binding DB lokal, typecheck Worker dan contoh non-secret config. Bukti dev lokal, API 404 JSON dan refresh route UI.
- [ ] T3. Migrasi D1 SQLite tabel/constraint/index/trigger sesuai SCHEMA; seed SIMULASI terpisah. Bukti migrasi lokal dan staging setelah izin resource diberikan; tidak perlu kredensial Supabase.
- [ ] T4. TDD checkout D1: total/snapshot server, batch guards rollback, idempotency, race SKU/paket, versi stale, expiry. Bukti RELEASE T03-T09/T11/T12/T15, termasuk D1 nyata.
- [ ] T5. Sesi tamu demo cookie/hash/CSRF/ownership/rate limit; operator demo diprovisioning terpercaya, tanpa self-assign role. Bukti forged actor, sesi lain, cookie/Origin invalid ditolak.
- [ ] T6. Endpoint simulasi check-payment hanya DEMO; PAID/CONSUMED dan invoice unik atomik, retry aman, expired ditolak. Bukti test duplikat, dua tab, expiry race dan endpoint tertutup non-demo.
- [ ] T7. UI katalog/detail/keranjang/checkout/metode simulasi/cek status/order/invoice dari snapshot. Bukti alur penuh, refresh, error/empty/loading, label SIMULASI dan tidak ada request gateway.
- [ ] T8. Staf/admin demo minimum, packing/READY/pickup sekali, katalog/stok/settings/audit. Bukti akses operator dan claim race.
- [ ] T9. Audit keyboard/mobile/kontras, semua kontrol, API routing, secret scan; build/typecheck/test; lengkapi bukti RELEASE demo tanpa centang produksi.
- [ ] T10. Deployment demo Cloudflare hanya setelah izin akun/binding/kuota/biaya; migrasi staging, smoke test publik dan backup/reset demo terisolasi.

## Ditunda, bukan bagian penyelesaian presentasi

Midtrans/Xendit, merchant key, webhook, cron rekonsiliasi, refund uang nyata, akun pelanggan permanen/email OTP/MFA produksi, PDF/email invoice otomatis. R2 baru saat upload diperlukan. Sesudah dosen/pemilik ingin lanjut, pilih satu gateway, lengkapi D01-D08 BRD dan kontrak produksi/sandbox.

## Keputusan dan batas

Cloudflare penuh dipilih pemilik. Dummy payment diminta untuk mengejar presentasi. Usulan teknis sesi tamu demo dan invoice HTML menghindari provider email/PDF yang belum perlu; tidak mengklaim akun produksi. Tidak ada cloud resource/deploy/uang nyata melalui revisi dokumentasi. Arsitektur/kuota D1 diperiksa ke dokumentasi resmi sebelum implementasi, khususnya batch limits dan SQL guard rollback. Jika invariant gagal, demo transaksi diblokir sampai benar; tidak mengendurkan keamanan demi jadwal.
