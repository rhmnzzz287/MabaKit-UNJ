# Keputusan desain: Cloudflare penuh dan demo pembayaran

Revisi: 22 Oktober 2026. Pemilik memilih Cloudflare penuh, lalu mengubah prioritas menjadi bahan presentasi dosen dengan pembayaran dummy. Kontrak aktif ada di ../../PRD.md, ../../SCHEMA.md dan ../../DESIGN.md; dokumen ini mencatat alasan, bukan bukti implementasi.

## Tujuan dan pendekatan

MabaKit toko perlengkapan PKKMB, bukan marketplace atau kanal resmi kampus. Booking/reservasi tetap di luar scope, termasuk kalender/slot/kuota/booking fee/reschedule.

Dipertimbangkan: Cloudflare penuh, Cloudflare dengan database eksternal, serta Cloudflare dengan Firebase. Pemilik memilih Cloudflare penuh agar frontend, backend dan database memakai satu platform. Database eksternal menambah vendor; Firebase mengubah relasi paket/stok menjadi model dokumen dan menambah platform.

Target: React/Vite/Tailwind pada Workers Static Assets, API same-origin di Workers, database D1 relasional SQLite. Foto demo memakai Static Assets; R2 ditunda sampai upload perlu. Source frontend/src/, backend/src/, backend/db/migrations/. Wrangler untuk local dev/migration/deploy, binding DB tidak masuk browser. Resource cloud/deploy/billing belum diotorisasi oleh dokumen ini.

## Pivot presentasi

Alur yang diminta pemilik: total belanja, pilihan metode, tombol Cek status pembayaran, konfirmasi pesanan dan invoice digital. Midtrans/Xendit ditunda sampai dosen/pemilik ingin melanjutkan. Tidak ada uang nyata atau panggilan gateway.

Usulan teknis: draft PENDING dibuat saat checkout agar refresh/idempotency aman; tombol check-payment menyimulasikan PAID/CONSUMED dan menghasilkan satu invoice HTML digital dari snapshot. Label SIMULASI selalu terlihat, bukan bukti pembayaran nyata dan bukan faktur pajak. PAID tidak otomatis READY. Tidak perlu PDF/email otomatis, webhook atau cron rekonsiliasi.

Sesi tamu demo opaque di Worker/D1 menghindari email provider yang belum dibutuhkan. Ini bukan akun produksi; akses order dibatasi sesi dan role operator tidak diberikan oleh pilihan browser. Detail keamanan mengikuti PRD/SCHEMA. Login produksi/email/MFA tetap gerbang masa depan.

## Batas D1

D1 tidak menyediakan RLS, RPC PostgreSQL, row/advisory lock atau transaksi JavaScript interaktif. DB.batch() atomik dengan SQL guards harus memvalidasi ulang versi, komposisi, harga, stok dan snapshot dalam batch. Nol row conditional UPDATE bukan kegagalan transaksi; guard SQL perlu menghasilkan error/rollback seluruh batch. Uji komponen kedua gagal, race SKU terakhir, duplicate checkout/check-payment, invoice unik dan expiry wajib pada local serta staging D1 nyata.

Uang INTEGER safe integer rupiah, ID TEXT UUID, timestamp INTEGER Unix ms UTC. Browser hanya mengakses Worker, prepared SQL dan ownership per route. Session cookie hash-only di DB, CSRF/Origin dan rate limits server wajib. Endpoint dummy hanya terdaftar DEMO dan row mode DEMO; environment non-demo menolak, database tidak dibagi dengan produksi.

## Review builder dan keputusan

Review awal menanyakan stock hold/late payment, fallback D1, auth, refund, biaya dan R2. Hal yang sudah dijawab kontrak lama tidak memerlukan keputusan ulang: total server, expiry, idempotency dan proteksi stok. Pivot demo menghapus kebutuhan gateway/refund/email produksi sekarang. Demo expiry 30 menit boleh ditentukan server karena tidak ada pembayaran eksternal; invoice dan stok hanya satu efek atomik.

Jika D1 gagal membuktikan invariant, operasi transaksi diblokir sampai diperbaiki, bukan diam-diam mengganti database atau menerima counter salah. Akun/paket/biaya Cloudflare, deployment, metode auth produksi/provider email/MFA dan gateway tetap memerlukan persetujuan saat fase terkait dimulai. Budget alert bukan batas keras biaya.

D01-D08 BRD memblokir aktivasi produksi terkait, bukan scaffold lokal dengan fixture SIMULASI. Presentasi tidak membuktikan kesiapan menerima uang. Implementasi berikutnya mengikuti PLAN.md dan gerbang demo RELEASE; tidak membangun abstraction payment multi-provider untuk nanti.
