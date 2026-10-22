# MabaKit: tujuan project dan indeks

Revisi: 22 Oktober 2026. Status: spesifikasi target demo presentasi dosen. Saat ini baru scaffold React; bukan toko produksi atau integrasi pembayaran yang selesai.

## Tujuan

Website toko perlengkapan PKKMB mahasiswa baru UNJ: memeriksa spesifikasi/harga, membeli satuan/paket dan mengikuti pesanan hingga pengambilan. Wali dan koordinator dapat berbelanja tanpa NIM. MabaKit menjual barang sendiri, bukan marketplace atau kanal resmi kampus.

Target sekarang adalah bahan presentasi, bukan menerima uang. Alur: katalog, keranjang, checkout, total dan metode pembayaran simulasi, tombol Cek status pembayaran, konfirmasi pesanan, invoice digital HTML. Semua transaksi dan invoice berlabel SIMULASI, bukan bukti pembayaran nyata.

Booking/reservasi tidak termasuk produk atau roadmap: tanpa kalender, slot, kuota kunjungan, booking fee atau reschedule. Pengambilan mengikuti lokasi/jam layanan setelah READY, bukan janji waktu individual.

## Platform yang dipilih

- Frontend: React + TypeScript + Vite + Tailwind CSS, Cloudflare Workers Static Assets.
- Backend: Cloudflare Workers, API same-origin /api/*.
- Database: Cloudflare D1, SQLite relasional dengan prepared query, atomic batch dan SQL guards.
- Foto demo: Static Assets berizin/placeholder berlabel; R2 ditunda sampai upload diperlukan.
- Midtrans/Xendit, webhook, cron rekonsiliasi, email/OTP produksi dan MFA ditunda.
- Sesi tamu demo di Worker/D1, bukan akun produksi. Role staf/admin tetap dibatasi server.

Tidak ada resource cloud atau deployment yang dibuat melalui penyelarasan dokumen. Paket, kuota, domain, billing dan secret cloud dikonfirmasi sebelum aktivasi. Tidak menjamin seluruh layanan gratis.

## Urutan baca

1. [BRD.md](BRD.md): tujuan bisnis, fase demo dan keputusan pemilik.
2. [PRD.md](PRD.md): kontrak produk aktif dan batas simulasi.
3. [SCHEMA.md](SCHEMA.md): tabel D1, API, transaksi dan akses.
4. [DESIGN.md](DESIGN.md): deployment, layar dan aksesibilitas.
5. [KISS.md](KISS.md): batas kompleksitas.
6. [RELEASE.md](RELEASE.md): bukti demo dan gerbang produksi terpisah.

Panduan agen: [../AGENT.md](../AGENT.md). Rencana: [../PLAN.md](../PLAN.md). Desain keputusan: [superpowers/specs/2026-10-22-cloudflare-full-design.md](superpowers/specs/2026-10-22-cloudflare-full-design.md).

PRD/SCHEMA mengatur kontrak aktif; desain keputusan merekam alasan dan batas. Konflik uang/status/akses diselesaikan sebelum kode. Sumber awal: ../MabaKit Define.md, ../My First Board.jpg, ../Foto Produk-MabaKit Define.pdf. Contoh bisnis bukan harga atau izin resmi.

## Gerbang berikutnya

Susun implementasi tugas kecil dari kontrak demo. Fixture selalu SIMULASI; tidak meminta data nyata saat presentasi. Keputusan D01-D08 memblokir aktivasi produksi terkait, bukan scaffold lokal. Bukti database D1, keamanan akses dan interaksi UI diperlukan sebelum menyatakan demo siap. Produksi butuh keputusan baru dan sandbox gateway; data DEMO tidak dipromosikan menjadi pembayaran sah.
