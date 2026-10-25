# MabaKit

Toko perlengkapan PKKMB mahasiswa baru UNJ. Pembayaran simulasi, bukan uang nyata, dan belum dideploy.

## Struktur

- `frontend/`: UI React + TypeScript + Vite + Tailwind CSS.
- `backend/`: Cloudflare Worker API, D1 (migrasi dan seed), test backend.
- `docs/`: kontrak produk dan arsitektur. Mulai dari [docs/README.md](docs/README.md).
- `AGENT.md` dan `PLAN.md`: aturan kerja agen dan status rencana.

## Jalankan lokal

Prasyarat Node 22. Semua perintah dari akar repo.

```
npm install
npm run db:migrate:local
npm run db:seed:local
cp backend/.dev.vars.example backend/.dev.vars   # isi kode staf/admin lokal
npm run dev:worker                               # http://127.0.0.1:8787
# Login tim: /operator/login (bukan tautan publik)
```

Verifikasi: `npm test`, `npm run typecheck`, `npm run build`. Reset data: hapus `backend/.wrangler/state`, lalu ulangi migrasi dan seed.

## Deploy ke Cloudflare

Worker `mabakit-unj` melayani API dan aset statis `frontend/dist` sekaligus, jadi satu URL untuk semuanya. Resource yang dipakai: **hanya D1 `mabakit-demo`**. R2 sengaja tidak dipasang karena mengaktifkannya butuh checkout langganan (kartu kredit), sedangkan foto katalog sudah dilayani Static Assets dari `frontend/dist/products`. Efeknya upload foto lewat panel admin nonaktif (`admin-media.ts` membalas `checkout_disabled`); foto baru masuk lewat repo/seed.

Biaya: prototype ini masuk tier gratis Cloudflare dan tidak memerlukan kartu.

| Layanan | Tier gratis | Dipakai di sini |
| --- | --- | --- |
| Workers | 100.000 request/hari | semua halaman + `/api/*` (karena `run_worker_first`) |
| Static Assets | gratis, tanpa batas | foto produk, JS, CSS |
| D1 | 5 juta baris baca/hari, 100.000 baris tulis/hari, 5 GB | katalog, pesanan, akun |

Kalau batas harian lewat, request gagal dengan error — bukan ditagih. Tagihan baru muncul kalau plan diupgrade ke Workers Paid ($5/bulan) secara manual.

```
npm run deploy:setup      # login (kalau perlu) + D1 + migrasi + seed + secret + deploy
```

`deploy:setup` menjalankan `scripts/deploy-cloudflare.sh`: login wrangler bila token belum ada (membuka browser sendiri), membuat database D1 bila belum ada, menulis `database_id` nyata ke `backend/wrangler.jsonc`, menerapkan migrasi dan seed ke D1 remote, membuat secret `DEMO_SECRET` (dipakai hash rate limit), lalu `npm run deploy`. Aman diulang: seed memakai `INSERT OR IGNORE`, secret dan database yang sudah ada dilewati.

Deploy berikutnya cukup `npm run deploy`. Variabel lain: `APP_ORIGIN` (opsional, origin tautan invoice; default origin request) bisa diisi di `vars` `backend/wrangler.jsonc`. `STAFF_DEMO_CODE` dan `ADMIN_DEMO_CODE` sudah tidak dibaca kode — login tim memakai akun seed.

Kalau skrip berhenti di langkah 1, login OAuth-nya tidak selesai (browser ditutup atau akun belum punya izin). Ulangi `npm run deploy:setup`; alternatif tanpa browser: `export CLOUDFLARE_API_TOKEN=...` lalu jalankan lagi. Skrip mencetak tiap perintah yang dijalankan dan punya trap yang menyebut baris gagal, jadi tidak pernah keluar tanpa pesan. Satu-satunya prompt yang tersisa adalah konfirmasi `d1 migrations apply` (tekan Enter).

Catatan: `APP_MODE` bernilai `demo`, jadi endpoint `/api/demo/*` terbuka. Untuk pemakaian nyata, ubah ke nilai lain dan hapus seed data uji.

## Rate limit

Semua dibatasi per IP (hash, bukan IP mentah) dengan counter di tabel D1 `rate_limits`. Jendela lama dibuang berkala, jadi tabel tidak tumbuh tanpa batas.

| Scope | Batas | Jendela | Kena di |
| --- | --- | --- | --- |
| `api` | 120 | 1 menit | semua `/api/*` |
| `login_source` | 10 | 5 menit | login per IP |
| `login_email` | 10 | 5 menit | login per email |
| `auth_source` | 10 | 5 menit | register per IP |
| `export_sales` | 20 | 5 menit | ekspor penjualan |
| `staff_create` | 20 | 5 menit | buat akun staf |
| sesi demo | 10 | 1 menit | trigger DB saat buat sesi |

Lewat batas dibalas `429` dengan `{"error":"rate_limited"}`. Satu page load hanya 1-3 permintaan `/api`, jadi 120/menit longgar untuk manusia.

Biaya: satu baris D1 ditulis per permintaan `/api`, jadi batas 100.000 tulisan/hari di tier gratis setara ~100.000 permintaan API/hari.


## Status

Demo lokal berjalan: beranda, katalog, profil sesi, keranjang, checkout dengan snapshot email, pembayaran simulasi, invoice dan pratinjau email, ulasan setelah serah terima, serta workspace tim privat `/team` untuk staf/admin. 87 test lulus. Bukti ada di [docs/RELEASE.md](docs/RELEASE.md). Deployment, gateway pembayaran nyata, dan keputusan produksi belum dikerjakan.
