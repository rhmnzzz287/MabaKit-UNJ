# KISS: batas kompleksitas MabaKit

Revisi: 22 Oktober 2026. Target demo presentasi sesuai [PRD.md](PRD.md). Booking/reservasi di luar produk dan roadmap; pengambilan bukan janji temu.

| Kebutuhan | Pilihan aktif | Ditunda |
|---|---|---|
| Frontend | React + TypeScript + Vite + Tailwind, Workers Static Assets | SSR/framework baru tanpa kebutuhan |
| API | Worker same-origin, SQL berparameter | Express, microservices, ORM wrapper |
| Database | D1, migrasi, atomic batch, SQL guards | Database lain, replica read sebelum perlu |
| State | React seperlunya, cart localStorage | Redux/Zustand/cloud cart tanpa kebutuhan |
| Pembayaran | DEMO, total server, metode simulasi, tombol Cek status pembayaran | Midtrans/Xendit, webhook, cron rekonsiliasi, uang nyata |
| Invoice | HTML dari snapshot dengan watermark SIMULASI | PDF/email otomatis, faktur pajak |
| Identitas | Sesi tamu demo opaque, operator dibatasi server | Akun/email OTP produksi, MFA integration |
| Foto | Static Assets berizin/placeholder | R2 sampai upload dibutuhkan |
| Pickup | Informasi jam/lokasi, kode manual, claim sekali | Booking, kalender, slot, scanner wajib |
| Operasi | Audit, pause checkout, reset demo terbatas | Analitik rumit, multi-vendor, queue broker |

## Jangan disederhanakan

Harga/total dihitung server. Mutasi stok, status dan invoice atomik/idempotent. Ownership dan role diperiksa setiap route; tidak ada RLS otomatis di D1. SQL guard gagal harus rollback seluruh batch; nol row UPDATE bukan rollback. Session cookie, CSRF, validasi input, aksesibilitas dan error handling tetap wajib walau demo.

Tidak membuat abstraction payment multi-provider atau adapter gateway kosong untuk nanti. Endpoint simulasi hanya ada di mode DEMO dan data terisolasi. Tidak mengiklankan transaksi simulasi sebagai pembayaran sah.

## Kapan menambah

Gateway setelah pemilik/dosen ingin melanjutkan, provider dipilih dan kontrak/sandbox diuji. R2 setelah upload/evidence perlu; OTP/email setelah akun produksi dirancang; MFA sebelum aksi admin produksi. Cron/Queues hanya jika pekerjaan nyata membutuhkannya. Durable Objects bukan pengganti tanpa uji untuk transaksi D1.

Semua perubahan kontrak memperbarui PRD/SCHEMA/DESIGN/RELEASE lebih dulu. Pilih diff terkecil yang menjaga keamanan dan konsistensi.
