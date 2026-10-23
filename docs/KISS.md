# KISS: batas kompleksitas MabaKit

Revisi v2: 22 Oktober 2026. Target demo presentasi sesuai [PRD.md](PRD.md). Booking/reservasi di luar produk dan roadmap; pengambilan bukan janji temu.

| Kebutuhan | Pilihan aktif | Ditunda |
|---|---|---|
| Frontend | React + TypeScript + Vite + Tailwind, Workers Static Assets | SSR/framework baru tanpa kebutuhan |
| API | Worker same-origin, SQL berparameter | Express, microservices, ORM wrapper |
| Database | D1, migrasi, atomic batch, SQL guards | Database lain, replica read sebelum perlu |
| State | React seperlunya, cart localStorage | Redux/Zustand/cloud cart tanpa kebutuhan |
| Pembayaran | DEMO, total server, metode simulasi, tombol Cek status pembayaran | Midtrans/Xendit, webhook, cron rekonsiliasi, uang nyata |
| Invoice | HTML dari snapshot dengan keterangan percobaan | PDF/email otomatis, faktur pajak |
| Identitas | Akun persisten email/password, hash Web Crypto PBKDF2-SHA256 bergaram, cookie sesi portal pembeli/operator terpisah, role dan izin dari server | Verifikasi email, Google login, reset password lewat email, MFA, SSO |
| Paket | Slot komponen + mapping fakultas + harga konfigurasi di server | Editor bebas warna/teks/bordir, bundel bersarang |
| Foto | Gambar manifest dari `updatekatalog.pdf`, Static Assets | R2 sampai upload dibutuhkan, generasi foto baru |
| Pickup | Informasi jam/lokasi, konfirmasi serah terima manual sekali | Booking, kalender, slot, QR, scanner wajib |
| Operasi | Audit, pause checkout, reset demo terbatas | Analitik rumit, multi-vendor, queue broker |

## Jangan disederhanakan

Harga, komponen, fakultas/varian yang diizinkan, total dan stok dihitung server. Mutasi stok, status dan invoice atomik/idempotent. Ownership dan role diperiksa setiap route; tidak ada RLS otomatis di D1. SQL guard gagal harus rollback seluruh batch; nol row UPDATE bukan rollback. Session cookie, CSRF, validasi input, aksesibilitas dan error handling tetap wajib walau demo.

Autentikasi memakai primitif Web Crypto PBKDF2-SHA256 bergaram, bukan algoritme buatan sendiri; token sesi hanya disimpan sebagai hash. Dependency runtime baru, vendor autentikasi berbayar atau ORM tetap memerlukan persetujuan eksplisit pemilik sebelum dipakai.

Tidak membuat abstraction payment multi-provider atau adapter gateway kosong untuk nanti. Endpoint simulasi hanya ada di mode DEMO dan data terisolasi. Tidak mengiklankan transaksi simulasi sebagai pembayaran sah.

## Kapan menambah

Gateway setelah pemilik/dosen ingin melanjutkan, provider dipilih dan kontrak/sandbox diuji. Verifikasi email, recovery password, dan MFA setelah demo presentasi selesai; hardening itu prasyarat produksi, bukan alasan mengganti mekanisme PBKDF2 sekarang. R2 setelah upload/evidence perlu. Cron/Queues hanya jika pekerjaan nyata membutuhkannya. Durable Objects bukan pengganti tanpa uji untuk transaksi D1.

Semua perubahan kontrak memperbarui PRD/SCHEMA/DESIGN/RELEASE lebih dulu. Pilih diff terkecil yang menjaga keamanan dan konsistensi.
