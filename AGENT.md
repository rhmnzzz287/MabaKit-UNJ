# AGENT.md: panduan agen MabaKit

Revisi v2: 22 Oktober 2026. Target aktif demo presentasi dosen di Cloudflare, pembayaran dummy tanpa uang nyata. Panduan ini tidak menggantikan kontrak docs.

## Struktur repo

- `frontend/`: UI React/Vite/Tailwind, `src/`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`.
- `backend/`: Worker API (`src/`), D1 (`db/migrations/`, `db/seed.sql`), test backend (`test/`), `wrangler.jsonc`, `tsconfig.json`.
- `docs/`: kontrak produk/arsitektur, di luar kedua folder kode; `docs/reference/` materi awal produk (PDF, catatan, gambar).
- Akar repo: `AGENT.md`, `PLAN.md`, `package.json`, `.github/`.

## Baca sebelum bekerja

1. docs/README.md: tujuan dan scope.
2. docs/BRD.md: fase demo vs keputusan bisnis produksi.
3. docs/PRD.md: perilaku/acceptance criteria.
4. docs/SCHEMA.md: D1, API, transaksi, akses.
5. docs/DESIGN.md: arsitektur, layar, aksesibilitas.
6. docs/KISS.md: batas kompleksitas.
7. docs/RELEASE.md: bukti demo vs gerbang produksi.
8. PLAN.md: status dan urutan kerja; jangan percaya checkbox tanpa bukti.

Konflik status/uang/akses diselesaikan di PRD/SCHEMA sebelum kode. Desain keputusan aktif: docs/superpowers/specs/2026-10-22-mabakit-business-website-v2-design.md. PRD/SCHEMA adalah kontrak aktif.

## Scope tetap

- Toko perlengkapan PKKMB mahasiswa baru UNJ; paket adalah penawaran utama, satuan pada bagian tersendiri; bukan marketplace atau kanal resmi kampus.
- Kustomisasi berarti penyesuaian isi/varian paket terhadap fakultas, dihitung server. Editor bebas warna, teks, bordir, atau tambah/hapus komponen bukan scope.
- Tanpa booking/reservasi, kalender, slot, kuota kunjungan, booking fee atau reschedule. Kurir tampil nonaktif `Segera tersedia`, tanpa alamat kirim, ongkir atau resi.
- Target presentasi: total server, pilih metode simulasi, Cek status pembayaran, konfirmasi pesanan dan invoice digital HTML dengan keterangan percobaan, bukan bukti pembayaran nyata.
- Jangan memasang Midtrans/Xendit, webhook, cron rekonsiliasi atau merchant secret sekarang. Tidak ada QR/rekening bayar nyata. Produksi memerlukan keputusan baru setelah presentasi.
- Tidak membuat data/angka/izin palsu. Tanpa ulasan nyata, bagian testimoni publik dihilangkan. Fixture diberi label SIMULASI, gunakan data fiktif saat demo.

## Stack

React + TypeScript + Vite + Tailwind CSS, Cloudflare Workers Static Assets untuk frontend; Workers API same-origin untuk backend; D1 binding DB untuk database. frontend/src/ UI, backend/src/ server, backend/db/migrations/ SQL. Gambar katalog dari manifest ekstraksi PDF di Static Assets; R2 ditunda sampai upload perlu. Tidak menambah vendor/database/ORM/KV/Queues/Durable Objects tanpa kebutuhan terukur.

D1 SQLite: ID TEXT UUID server, timestamp INTEGER Unix ms UTC ditampilkan WIB, uang INTEGER safe integer rupiah. Prepared queries, FK/CHECK/UNIQUE dan atomic DB.batch(). Tidak ada RLS, database RPC, row/advisory lock atau transaksi JavaScript interaktif.

Guard gagal harus mengakibatkan error SQL dan rollback seluruh batch; UPDATE nol row bukan rollback. Read di luar batch hanya kandidat; versi/komposisi/harga divalidasi ulang di batch. Snapshot immutable, idempotency unique, stok/invoice/status satu efek atomik. Jangan memecah transaksi stok menjadi beberapa commit karena batas query.

## Akses dan keamanan

Browser tidak mengakses D1. Actor dari sesi server, role/ownership diperiksa setiap route, default deny dan projection minimum. Akun pembeli persisten memakai email/password; mekanisme yang disetujui adalah Web Crypto PBKDF2-SHA256 bergaram untuk hash password, cookie sesi opaque HttpOnly/Secure pada HTTPS/SameSite, penyimpanan token sebagai hash saja, serta CSRF plus Origin pada setiap mutasi. Jangan membangun algoritme kriptografi sendiri atau mengganti primitif ini tanpa persetujuan.

Registrasi publik hanya menghasilkan role buyer; role staf/admin berasal dari server, tidak pernah dari pilihan browser, header, cookie buatan atau localStorage. Sesi akun yang kedaluwarsa atau dicabut tidak boleh berubah menjadi sesi tamu lalu melanjutkan transaksi. Kepemilikan order berdasarkan `users.id`, bukan email atau cookie sesi lama; order legacy tetap terisolasi dan tidak di-attach ulang lewat pencocokan email.

Endpoint simulasi hanya terdaftar mode DEMO dan row mode DEMO, ditolak non-demo. Data DEMO tidak menjadi pembayaran sah. Reset terbatas operator dengan database terisolasi. Jangan commit secret, token deploy/merchant/sesi, PII atau menaruhnya pada VITE_*, URL/log/localStorage. Resource cloud, billing, deploy, transaksi nyata dan operasi destruktif perlu izin eksplisit.

## Invarian v2

- Server menghitung harga, komponen, fakultas/varian yang diizinkan, total dan stok; body buyer tidak dapat mengubah harga atau role.
- Checkout memakai satu `DB.batch()` atomik yang memvalidasi ulang status aktif, mapping fakultas, harga/versi, stok dan pickup settings; satu komponen gagal berarti seluruh rollback.
- Tas putih/natural, termasuk totebag FIKK putih, tidak dapat dijual lewat route mana pun, termasuk request API langsung ke SKU; snapshot order lama tetap utuh.
- Gambar tidak pernah di-upscale dan tidak memakai AI sharpening; turunan hanya dari master, dengan width/height eksplisit, `object-fit: contain`, srcset/sizes dan alt yang menyebut produk dan fakultas.
- Tidak ada testimoni palsu, ulasan contoh sebagai social proof, atau badge demo berulang di hero, katalog, nav, login dan detail. Keterangan percobaan hanya di pembayaran, invoice termasuk cetak, dan konteks dashboard.
- Login wajib sebelum checkout, profil, pesanan, pembayaran dan invoice; katalog dan keranjang tetap publik. Redirect login hanya path internal yang diizinkan.

## Cara kerja

Buat tugas kecil dengan check runnable, test gagal dahulu untuk logika lalu implementasi minimum. Uji D1 lokal dan staging nyata untuk concurrency/rollback; mock tidak cukup. Jangan centang RELEASE atau klaim selesai tanpa command/output terbaru. Frontend diverifikasi build/typecheck/test plus interaksi, keyboard, kontras, mobile >=360px, states dan kualitas gambar. Tidak ada tautan dummy atau tombol mati.

D01-D08 BRD memblokir aktivasi produksi terkait, bukan scaffold lokal demo. Verifikasi email, recovery password, MFA, gateway, refund dan rekonsiliasi ditunda, bukan diklaim tersedia. Perubahan kontrak memperbarui PRD/SCHEMA/DESIGN/RELEASE dan rencana dalam perubahan sama.
