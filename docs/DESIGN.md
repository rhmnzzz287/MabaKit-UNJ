# Design dan arsitektur: MabaKit

Revisi: 22 Oktober 2026. Target aktif demo presentasi dosen di Cloudflare. Kontrak [PRD.md](PRD.md) dan [SCHEMA.md](SCHEMA.md); belum bukti UI siap. Booking/reservasi, kalender dan pilihan slot tidak termasuk produk.

## 1. Arsitektur

```text
Browser: React + TypeScript + Vite + Tailwind CSS
  localStorage cart, API relative /api/*, cookie sesi demo
        |
Cloudflare Worker
  Static Assets: dist/ + foto demo berizin
  API: katalog, sesi, checkout, simulasi pembayaran, invoice, staf/admin
        |
Cloudflare D1 binding DB
  SQLite relational, prepared queries, atomic DB.batch(), guard SQL
```

Satu deployment Worker melayani API dan static assets. Source UI src/, server worker/, migrasi db/migrations/. Wrangler untuk dev, migrasi dan deployment. API `/api/*` harus diarahkan ke Worker sebelum SPA fallback; route API tak dikenal menghasilkan JSON 404, bukan index.html. Route UI mendukung refresh via SPA fallback.

D1 hanya diakses Worker, tidak dari SDK browser. Sesi cookie HttpOnly dengan token hash di D1; role operator diprovisioning terpercaya, bukan pilihan pengguna. SQL guard dan batch menjadi otoritas mutasi. Tidak ada transaksi interaktif yang menunggu keputusan JavaScript di antara statement.

R2 ditunda; foto pilot memakai Static Assets. Saat upload/evidence perlu dibuat, tulis kontrak akses/ukuran/tipe/retensi dulu. Cron Triggers untuk rekonsiliasi gateway ditunda, sama seperti integrasi Midtrans/Xendit, OTP/email produksi dan MFA. Demo tidak memanggil gateway atau pengiriman email. Tidak perlu KV, Durable Objects, Queues, ORM atau Express.

Environment lokal, demo staging dan produksi memakai binding/database berbeda. Demo diberi mode DEMO server-side, tanpa secret merchant. Konfigurasi Wrangler menyimpan binding non-secret; token deploy dan secret operator hanya di environment/Workers Secrets, tidak VITE_* atau repo. Resource cloud, biaya, domain dan deployment memerlukan persetujuan terpisah.

## 2. Arah visual

Audience mahasiswa baru, wali dan koordinator; bahasa Indonesia operasional. ENERGY 2, RHYTHM 2, MOTION 1. Identitas toko hijau dengan foto barang dan spesifikasi dekat harga, bukan klaim resmi kampus. Katalog langsung, tanpa halaman marketing panjang.

| Keputusan | Alasan |
|---|---|
| Satu CTA utama per tahap | Bedakan tambah keranjang, pilih metode, cek simulasi dan lihat invoice |
| Isi paket sebagai daftar komponen | Pembeli memahami barang yang diterima |
| Label SIMULASI persisten | Penonton tidak mengira demo menerima uang atau memverifikasi bank |
| Invoice HTML responsif | Bukti alur digital tanpa dependency PDF atau email |
| Satu lokasi/jam layanan | Menjelaskan pengambilan tanpa fitur booking |
| Kode pickup, tanpa scanner | Demo bekerja tanpa izin kamera atau library tambahan |

Tidak membuat logo, foto/testimoni sintetis atau statistik rekaan. Foto valid belum ada: placeholder berlabel. Spesifikasi dan harga fixture berlabel SIMULASI, bukan data produksi.

## 3. Token visual

| Token | Nilai |
|---|---|
| Brand/hover | #047857 teks putih / #064e3b |
| Tint | #f0fdf4 |
| Peringatan | #92400e pada #fef3c7, disertai teks |
| Surface/latar | #ffffff / #f8fafc |
| Teks utama/sekunder | #0f172a / #475569 |
| Input boundary | #64748b pada putih; #cbd5e1 dekoratif saja |
| Error | #b91c1c pada putih, pesan tekstual |
| Focus | #0f172a 2px offset 3px, tidak terpotong |
| Typography | system-ui, sans-serif; Plus Jakarta Sans self-host hanya bila aset/izin tersedia; body/input >=16px, line-height 1.5 |
| Radius/spacing | kontrol 8px, kartu 12px, spacing kelipatan 4px |

Kontras aktual wajib diukur: normal >=4,5:1, teks besar/kontrol penting >=3:1. Nilai hex bukan bukti audit.

## 4. Layar dan interaksi

| Route | Konten dan states |
|---|---|
| / | Katalog aktif, filter opsional fakultas/kategori, harga/varian/ketersediaan; loading, kosong dengan reset, error dengan retry |
| /products/:id | Spesifikasi, foto, varian, harga, komponen paket; CTA Tambah ke keranjang; pilihan tidak lengkap error, stok habis tidak dapat ditambah |
| /cart | Jumlah, estimasi, total; CTA Lanjut checkout; kosong menyediakan Lihat katalog; localStorage rusak dipulihkan dengan pesan |
| /checkout | Form data fiktif, instruksi lokasi/jam SIMULASI, rincian harga, pilih metode transfer bank/e-wallet/QRIS simulasi. CTA Lanjut ke pembayaran simulasi membuat draft PENDING. Sesi tamu dibuat server, tidak meminta email OTP nyata |
| /orders/:id/payment | Total dan metode dari server, banner SIMULASI, penjelasan tombol tidak memeriksa bank. CTA Cek status pembayaran. Loading mencegah double click; error tidak mengklaim sukses; expired menawarkan checkout baru; tidak ada QR/rekening nyata |
| /orders dan /orders/:id | Sesi owner saja. Setelah cek sukses: Pesanan simulasi berhasil dibuat; PAID SIMULASI, sedang disiapkan, tautan invoice. READY baru menampilkan kode pickup. Refresh memulihkan status server, bukan membuat pesanan baru |
| /orders/:id/invoice | Invoice digital HTML dari snapshot: nomor invoice/order, tanggal WIB, penerima, item/quantity/harga/subtotal/total/metode/status. Watermark SIMULASI, bukan bukti pembayaran nyata; bukan faktur pajak; tidak perlu PDF/email otomatis |
| /staff/orders | Operator demo terproteksi, packing snapshot, filter status, Tandai siap hanya PAID |
| /staff/pickup | Lookup kode dan konfirmasi penyerahan, autentikasi operator, sudah diambil tampil waktu/staf tanpa tombol klaim ulang |
| /admin | Operator admin terproteksi; katalog/stok/instruksi/pause/audit. Tidak ada role dari browser, secret atau tombol mengaktifkan gateway |
| /privacy, /terms, /help | Jelaskan demo, data fiktif dan batasan; tidak mengarang kontak/legalitas. Konten belum tersedia berlabel draft, produksi diblokir |

Demo tidak otomatis mengubah PAID menjadi READY. Sesi tamu hanya berlaku pada browser yang sama; jangan mengklaim riwayat lintas perangkat atau pemulihan akun tersedia. Penggantian sesi tidak memberi akses order lama. Aturan akses demo operator ditetapkan sebelum demo dipublikasikan; login produksi terpisah.

## 5. Mobile, aksesibilitas dan kegagalan

Mulai 360px; uji 390/430/768/1280, zoom 200%, tanpa overflow. Form satu kolom, target sentuh 48px, CTA sticky tidak menutup input/fokus. Label terlihat, error aria-describedby, status live region, keyboard semantik dengan focus terlihat. Dialog Escape/focus return; reduced motion. Status bukan warna saja.

Tidak ada tautan # dummy atau tombol tanpa aksi. Loading/empty/error/offline diperiksa. Retry konfirmasi menggunakan order/key sama; kegagalan DB menampilkan error, bukan invoice palsu lokal. Kode pickup sensitif, tanpa URL/log publik.

## 6. Verifikasi

Belum ada bukti UI/backend demo selesai. Wajib build/typecheck/test, klik setiap kontrol, kontras, keyboard, mobile, refresh deep-link, cookie/CSRF/ownership, invoice snapshot dan race check/expiry. Uji staging Cloudflare terpisah dari lokal. Bukti di [RELEASE.md](RELEASE.md); tidak ada klaim gateway atau pembayaran nyata.
