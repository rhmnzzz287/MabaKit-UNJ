# MabaKit: tujuan project dan indeks

Revisi v2: 22 Oktober 2026. Status: demo lokal berjalan di Worker + D1 dengan pembayaran simulasi. Belum dideploy dan bukan toko produksi; tidak ada uang nyata.

## Tujuan

Website toko perlengkapan PKKMB mahasiswa baru UNJ: memeriksa spesifikasi/harga, membeli paket sesuai fakultas atau satuan, dan mengikuti pesanan hingga pengambilan. Wali dan koordinator dapat berbelanja tanpa NIM. MabaKit menjual barang sendiri, bukan marketplace atau kanal resmi kampus.

Target sekarang adalah bahan presentasi, bukan menerima uang. Alur: katalog paket-first, penyesuaian paket per fakultas, keranjang, akun pembeli, checkout, total dan metode pembayaran simulasi, tombol Cek status pembayaran, konfirmasi pesanan, invoice digital HTML. Keterangan percobaan muncul di pembayaran, invoice dan konteks dashboard, bukan sebagai badge berulang di storefront.

Booking/reservasi tidak termasuk produk atau roadmap: tanpa kalender, slot, kuota kunjungan, booking fee atau reschedule. Pengambilan mengikuti lokasi/jam layanan setelah READY, bukan janji waktu individual. Kurir tampil nonaktif `Segera tersedia`.

Kontak resmi sesuai desain v2 bagian 8: Jalan R.Mangun Muka Raya No. 11, Kelurahan Rawamangun, Kecamatan Pulo Gadung, Kota Jakarta Timur, DKI Jakarta 13220; WhatsApp +6283874234882, tautan `https://wa.me/6283874234882`. Chat manual tidak menyatakan pesan terkirim. Alamat kontak bukan konfirmasi lokasi pickup.

## Platform yang dipilih

- Frontend: React + TypeScript + Vite + Tailwind CSS, Cloudflare Workers Static Assets.
- Backend: Cloudflare Workers, API same-origin /api/*.
- Database: Cloudflare D1, SQLite relasional dengan prepared query, atomic batch dan SQL guards.
- Gambar katalog: ekstraksi embedded image dari `docs/reference/updatekatalog.pdf` (63 gambar, fallback `docs/reference/katalog.pdf` 40 gambar) dengan manifest halaman/indeks/ukuran/mapping; turunan WebP atau JPEG kualitas 85-90, lebar 480 dan 960 hanya bila sumber mendukung, tanpa upscale. Aset disajikan lewat Static Assets; R2 ditunda sampai upload diperlukan.
- Akun pembeli persisten email/password (tanpa verifikasi email, Google login atau reset password lewat email), password di-hash Web Crypto PBKDF2-SHA256 bergaram, cookie sesi opaque HttpOnly, token disimpan sebagai hash. Kepemilikan berdasarkan `users.id`, bukan email atau cookie sesi lama.
- Midtrans/Xendit, webhook, cron rekonsiliasi, email otomatis, MFA dan kurir ditunda.
- Role staf/admin berasal dari server. `/team` dan `/team/*` untuk staf/admin, `/admin` hanya admin, `/staff*` lama dialihkan ke `/team/orders`. Guard diperiksa Worker sebelum aset disajikan, tanpa tautan admin pada navbar pembeli.

Tidak ada resource cloud atau deployment yang dibuat melalui penyelarasan dokumen. Paket, kuota, domain, billing dan secret cloud dikonfirmasi sebelum aktivasi. Tidak menjamin seluruh layanan gratis.

## Menjalankan demo lokal

Prasyarat: Node 22 dan npm. Semua perintah dari akar repo.

```
npm install
npm run db:migrate:local
npm run db:seed:local
cp backend/.dev.vars.example backend/.dev.vars   # isi kode staf/admin lokal, jangan commit
npm run dev:worker               # build lalu wrangler dev di http://127.0.0.1:8787
```

Seed presentasi membuat akun admin `mabakita@admin` / `admin123` dan pembeli `pembeli@demo.mabakit` / `buyermabakit123`. Hanya untuk lingkungan presentasi terisolasi, idempoten, dan wajib diganti sebelum penggunaan operasional.

Reset data demo: hapus `backend/.wrangler/state`, ulangi migrasi dan seed. Verifikasi: `npm test`, `npm run typecheck`, `npm run typecheck:worker`, `npm run build`. Kode staf/admin hanya untuk demo lokal dan tidak boleh dipakai di deployment publik.

## Struktur repo

- `frontend/`: React + Vite + Tailwind (`src/`, `index.html`, konfigurasi Vite/Vitest/TS).
- `backend/`: Worker API (`src/`), D1 (`db/`), test backend (`test/`), `wrangler.jsonc`, `.dev.vars.example`.
- `docs/`: dokumen ini dan kontrak lain, di luar folder kode; `docs/reference/` menyimpan materi awal produk.

## Urutan baca

1. [BRD.md](BRD.md): tujuan bisnis, fase demo dan keputusan pemilik.
2. [PRD.md](PRD.md): kontrak produk aktif dan batas simulasi.
3. [SCHEMA.md](SCHEMA.md): tabel D1, API, transaksi dan akses.
4. [DESIGN.md](DESIGN.md): deployment, layar dan aksesibilitas.
5. [KISS.md](KISS.md): batas kompleksitas.
6. [RELEASE.md](RELEASE.md): bukti demo dan gerbang produksi terpisah.

Panduan agen: [../AGENT.md](../AGENT.md). Rencana: [../PLAN.md](../PLAN.md). Desain keputusan aktif: [superpowers/specs/2026-10-22-mabakit-business-website-v2-design.md](superpowers/specs/2026-10-22-mabakit-business-website-v2-design.md); catatan arsitektur v1: [superpowers/specs/2026-10-22-cloudflare-full-design.md](superpowers/specs/2026-10-22-cloudflare-full-design.md).

PRD/SCHEMA mengatur kontrak aktif; desain keputusan merekam alasan dan batas. Konflik uang/status/akses diselesaikan sebelum kode. Sumber awal: ../MabaKit Define.md, ../My First Board.jpg, ../Foto Produk-MabaKit Define.pdf. Contoh bisnis bukan harga atau izin resmi.

## Gerbang berikutnya

Susun implementasi tugas kecil dari kontrak v2. Fixture selalu SIMULASI; tidak meminta data nyata saat presentasi. Komposisi dan harga paket per fakultas belum disahkan, jadi publish paket ditahan sampai data pemilik ada; minimum lima penawaran dipenuhi produk satuan existing yang benar. Keputusan D01-D08 memblokir aktivasi produksi terkait, bukan scaffold lokal. Bukti database D1, keamanan akses, kualitas gambar dan interaksi UI diperlukan sebelum menyatakan demo siap. Produksi butuh keputusan baru dan sandbox gateway; data DEMO tidak dipromosikan menjadi pembayaran sah.
