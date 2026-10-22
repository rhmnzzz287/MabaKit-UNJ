# AGENT.md: panduan agen MabaKit

Revisi: 22 Oktober 2026. Target aktif demo presentasi dosen di Cloudflare, pembayaran dummy tanpa uang nyata. Panduan ini tidak menggantikan kontrak docs.

## Baca sebelum bekerja

1. docs/README.md: tujuan dan scope.
2. docs/BRD.md: fase demo vs keputusan bisnis produksi.
3. docs/PRD.md: perilaku/acceptance criteria.
4. docs/SCHEMA.md: D1, API, transaksi, akses.
5. docs/DESIGN.md: arsitektur, layar, aksesibilitas.
6. docs/KISS.md: batas kompleksitas.
7. docs/RELEASE.md: bukti demo vs gerbang produksi.
8. PLAN.md: status dan urutan kerja; jangan percaya checkbox tanpa bukti.

Konflik status/uang/akses diselesaikan di PRD/SCHEMA sebelum kode. Desain keputusan di docs/superpowers/specs/2026-10-22-cloudflare-full-design.md bersifat catatan arsitektur; PRD/SCHEMA adalah kontrak aktif.

## Scope tetap

- Toko perlengkapan PKKMB mahasiswa baru UNJ, satuan/paket; bukan marketplace atau kanal resmi kampus.
- Tanpa booking/reservasi, kalender, slot, kuota kunjungan, booking fee atau reschedule.
- Target presentasi: total server, pilih metode simulasi, Cek status pembayaran, konfirmasi pesanan dan invoice digital HTML berlabel SIMULASI, bukan bukti pembayaran nyata.
- Jangan memasang Midtrans/Xendit, webhook, cron rekonsiliasi atau merchant secret sekarang. Tidak ada QR/rekening bayar nyata. Produksi memerlukan keputusan baru setelah presentasi.
- Tidak membuat data/angka/izin/testimoni palsu. Fixture diberi label SIMULASI, gunakan data fiktif saat demo.

## Stack

React + TypeScript + Vite + Tailwind CSS, Cloudflare Workers Static Assets untuk frontend; Workers API same-origin untuk backend; D1 binding DB untuk database. src/ UI, worker/ server, db/migrations/ SQL. Foto awal Static Assets; R2 ditunda sampai upload perlu. Tidak menambah vendor/database/ORM/KV/Queues/Durable Objects tanpa kebutuhan terukur.

D1 SQLite: ID TEXT UUID server, timestamp INTEGER Unix ms UTC ditampilkan WIB, uang INTEGER safe integer rupiah. Prepared queries, FK/CHECK/UNIQUE dan atomic DB.batch(). Tidak ada RLS, database RPC, row/advisory lock atau transaksi JavaScript interaktif.

Guard gagal harus mengakibatkan error SQL dan rollback seluruh batch; UPDATE nol row bukan rollback. Read di luar batch hanya kandidat; versi/komposisi/harga divalidasi ulang di batch. Snapshot immutable, idempotency unique, stok/invoice/status satu efek atomik. Jangan memecah transaksi stok menjadi beberapa commit karena batas query.

## Akses dan keamanan

Browser tidak mengakses D1. Actor dari sesi server, role/ownership diperiksa setiap route, default deny dan projection minimum. Cookie sesi demo opaque HttpOnly/Secure pada HTTPS/SameSite, hash token saja di DB; CSRF+Origin untuk mutasi. Sesi tamu bukan akun produksi. Jangan self-assign staff/admin dari browser atau membangun kriptografi autentikasi sendiri.

Endpoint simulasi hanya terdaftar mode DEMO dan row mode DEMO, ditolak non-demo. Data DEMO tidak menjadi pembayaran sah. Reset terbatas operator dengan database terisolasi. Jangan commit secret, token deploy/merchant/sesi, PII atau menaruhnya pada VITE_*, URL/log/localStorage. Resource cloud, billing, deploy, transaksi nyata dan operasi destruktif perlu izin eksplisit.

## Cara kerja

Buat tugas kecil dengan check runnable, test gagal dahulu untuk logika lalu implementasi minimum. Uji D1 lokal dan staging nyata untuk concurrency/rollback; mock tidak cukup. Jangan centang RELEASE atau klaim selesai tanpa command/output terbaru. Frontend diverifikasi build/typecheck/test plus interaksi, keyboard, kontras, mobile >=360px dan states. Tidak ada tautan dummy atau tombol mati.

D01-D08 BRD memblokir aktivasi produksi terkait, bukan scaffold lokal demo. Integrasi email/auth produksi/MFA, gateway, refund dan rekonsiliasi ditunda, bukan diklaim tersedia. Perubahan kontrak memperbarui PRD/SCHEMA/DESIGN/RELEASE dan rencana dalam perubahan sama.
