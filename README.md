# MabaKit

Toko perlengkapan PKKMB mahasiswa baru UNJ untuk demo presentasi dosen. Pembayaran simulasi, bukan uang nyata, dan belum dideploy.

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
```

Verifikasi: `npm test`, `npm run typecheck`, `npm run build`. Reset data: hapus `backend/.wrangler/state`, lalu ulangi migrasi dan seed.

## Status

Demo lokal berjalan: katalog, keranjang, checkout, pembayaran simulasi, invoice HTML, pengambilan oleh staf, dan admin stok. 57 test lulus. Bukti ada di [docs/RELEASE.md](docs/RELEASE.md). Deployment, gateway pembayaran nyata, dan keputusan produksi belum dikerjakan.
