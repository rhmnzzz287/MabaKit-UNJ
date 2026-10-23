# Design dan arsitektur: MabaKit

Revisi v2: 22 Oktober 2026. Target aktif demo presentasi dosen di Cloudflare. Kontrak [PRD.md](PRD.md) dan [SCHEMA.md](SCHEMA.md); belum bukti UI siap. Booking/reservasi, kalender dan pilihan slot tidak termasuk produk.

## 1. Arsitektur

```text
Browser: React + TypeScript + Vite + Tailwind CSS
  localStorage cart, API relative /api/*, cookie sesi akun
        |
Cloudflare Worker
  Static Assets: frontend/dist/ + gambar katalog dari manifest
  API: auth, katalog/paket, profil, checkout, simulasi pembayaran, invoice, ulasan, tim/admin
        |
Cloudflare D1 binding DB
  SQLite relational, prepared queries, atomic DB.batch(), guard SQL
```

Satu deployment Worker melayani API dan static assets. Source UI frontend/src/, server backend/src/, migrasi backend/db/migrations/. Wrangler untuk dev, migrasi dan deployment. API `/api/*` harus diarahkan ke Worker sebelum SPA fallback; route API tak dikenal menghasilkan JSON 404, bukan index.html. Route UI mendukung refresh via SPA fallback.

D1 hanya diakses Worker, tidak dari SDK browser. Sesi cookie opaque HttpOnly dengan hash token di D1; role berasal dari server, bukan pilihan pengguna. SQL guard dan batch menjadi otoritas mutasi. Tidak ada transaksi interaktif yang menunggu keputusan JavaScript di antara statement.

R2 dipakai untuk galeri unggahan admin: objek privat `products/<productId>/<photoId>`, disajikan lewat `/media/*` dengan header nosniff dan cache immutable; metadata dan batas lima foto per produk dijaga D1. Gambar pilot lama tetap memakai Static Assets dari manifest ekstraksi PDF. Cron Triggers untuk rekonsiliasi gateway ditunda, sama seperti integrasi Midtrans/Xendit, email otomatis dan MFA. Demo tidak memanggil gateway atau pengiriman email. Tidak perlu KV, Durable Objects, Queues, ORM atau Express.

Environment lokal, demo staging dan produksi memakai binding/database berbeda. Demo diberi mode DEMO server-side, tanpa secret merchant. Konfigurasi Wrangler menyimpan binding non-secret; token deploy dan secret operator hanya di environment/Workers Secrets, tidak VITE_* atau repo. Resource cloud, biaya, domain dan deployment memerlukan persetujuan terpisah.

## 2. Arah visual

Audience mahasiswa baru, wali dan koordinator; bahasa Indonesia operasional. ENERGY 2, RHYTHM 2, MOTION 1. Identitas toko hijau dengan foto barang dan spesifikasi dekat harga, bukan klaim resmi kampus. Paket mendapat hierarki utama karena solusi bisnisnya pembelian praktis beberapa barang; satuan tetap mudah ditemukan pada bagian tersendiri. Beranda memberi orientasi singkat dan paket utama, lalu membuka katalog penuh; bukan landing page panjang.

| Keputusan | Alasan |
|---|---|
| Satu CTA utama per tahap | Bedakan pilih paket, tambah keranjang, cek percobaan dan lihat invoice |
| Isi paket sebagai daftar komponen per fakultas | Pembeli memahami barang yang diterima dan varian yang berlaku |
| Kejujuran pembayaran di titik transaksi | Keterangan percobaan hanya di pembayaran, invoice dan konteks dashboard; bukan badge berulang di hero, katalog, nav, login atau detail |
| Invoice HTML responsif | Bukti alur digital tanpa dependency PDF atau email |
| Satu lokasi/jam layanan | Menjelaskan pengambilan tanpa fitur booking |
| Serah terima manual, tanpa QR | Demo tidak butuh kamera, tiket, atau library tambahan; operator mengonfirmasi setelah barang diserahkan |
| Workspace tim terpisah | Staf dan admin hanya melihat data operasional setelah verifikasi server |

Tidak membuat logo, testimoni, ulasan contoh, atau statistik rekaan. Tanpa ulasan nyata, bagian testimoni publik dihilangkan. Gambar memakai hasil ekstraksi `docs/reference/updatekatalog.pdf` sesuai manifest, bukan ilustrasi yang diklaim foto asli.

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
| / | Publik. Beranda: masalah persiapan PKKMB, target mahasiswa baru UNJ, paket utama dengan CTA `Pilih paket sesuai fakultas`, manfaat, cara pembelian, tautan bagian satuan. Tanpa ulasan contoh atau badge demo berulang. |
| /catalog | Publik. Bagian paket dahulu, lalu bagian produk satuan dengan heading jelas; filter fakultas/kategori, harga/varian/ketersediaan; loading, kosong dengan reset, error dengan retry |
| /products/:id | Publik. Spesifikasi, galeri foto, varian, harga dasar/tagihan dan diskon, komponen paket per fakultas; CTA paket menuju `/packages/:id/customize`, satuan menuju pemilihan varian; pilihan tidak lengkap error, stok habis tidak dapat ditambah |
| /packages/:id/customize | Publik. Fakultas, prodi bila tersedia, checklist referensi, komponen dan varian sesuai fakultas, quote harga/stok server, CTA tambah keranjang. Ganti fakultas menghitung ulang quote dan menampilkan perbedaan sebelum konfirmasi. Fakultas tanpa mapping tidak dapat dilanjutkan. |
| /cart | Publik. Baris per konfigurasi, edit fakultas/kuantitas, hapus, total; CTA Lanjut checkout melalui login; kosong menyediakan Lihat katalog; localStorage rusak dipulihkan dengan pesan |
| /login | Publik, hanya akun buyer. Email dan password, error umum termasuk penolakan akun operator, kembali ke `next` internal allowlist pembeli. Tanpa data privat sebelum sukses. |
| /register | Publik. Nama, email, password; role selalu buyer dari server. Email sementara boleh, tanpa verifikasi email. |
| /profile | Akses: pembeli login. Nama, WhatsApp, fakultas/prodi milik akun. Email login tidak dapat diubah lewat field kontak. Simpan divalidasi server, error field terlihat. |
| /checkout | Akses: pembeli login. Kontak dari profil, snapshot isi dan konfigurasi, total server, pickup aktif, kurir nonaktif `Segera tersedia`, submit idempoten. Sebelum order dibuat, harga di-quote ulang ke server; bila harga berubah keranjang diperbarui dan pembeli harus menyetujui total baru. Tanpa login diarahkan ke `/login` tanpa kehilangan keranjang. |
| /orders | Akses: pembeli login. Pesanan Saya: status, empty/loading/error, refresh manual dan refetch saat tab aktif |
| /orders/:id | Akses: pemilik order. Detail, linimasa Menunggu pembayaran, Sedang disiapkan, Siap diambil, Sudah diterima; pesan berakhir tersendiri untuk expired; lokasi ambil, invoice bila memenuhi status. Order akun lain 404. |
| /orders/:id/payment | Akses: pemilik order. Total dan metode dari server, keterangan `Tidak ada pembayaran atau penagihan nyata pada versi ini.`, CTA `Cek status pembayaran`. Loading mencegah double click; error tidak mengklaim sukses; expired menawarkan checkout baru; tanpa QR/rekening nyata. |
| /orders/:id/invoice | Akses: pemilik order. Invoice HTML dari snapshot: nomor invoice/order, tanggal WIB, pembeli, item/quantity/harga/subtotal/total/metode/status, keterangan `Dokumen percobaan, bukan bukti pembayaran sah.` termasuk pada cetak. Bukan faktur pajak; PDF otomatis tidak ada. |
| /about | Publik. Customer problem, target customer, solusi paket/satuan, value proposition, revenue model penjualan barang. Tanpa klaim marketplace, afiliasi UNJ atau omzet rekaan. |
| /contact | Publik. Alamat dan WhatsApp dari pemilik: Jalan R.Mangun Muka Raya No. 11, Kelurahan Rawamangun, Kecamatan Pulo Gadung, Kota Jakarta Timur, DKI Jakarta 13220; WhatsApp +6283874234882 menuju `https://wa.me/6283874234882`. Bukan klaim toko resmi atau lokasi pickup terkonfirmasi; chat manual tidak menyatakan pesan terkirim. |
| /operator/login | Publik, hanya akun staff/admin. Login akun individual tanpa pemilih role dan tanpa kode bersama; akun buyer ditolak server. Setelah login kembali ke `next` operator allowlist; tidak menampilkan data tim sebelum sukses. Cookie operator terpisah dari cookie pembeli. |
| /admin/* | Akses: admin. Dashboard: KPI penjualan percobaan dan kinerja staf, pesanan, CRUD produk/varian, draft/publish paket dengan slot/mapping/harga, fakultas, stok, pengambilan, akses tim (buat staf, atur izin, nonaktifkan), audit. Admin melihat antrean tetapi tidak menjalankan fulfillment. Nilai diberi konteks `Transaksi percobaan`. Tanpa role/izin dari browser atau secret. |
| /team | Akses: staf/admin. Workspace operasional: ringkasan percobaan, antrean pesanan, akses cepat sesuai izin server. Admin hanya melihat. 401/403 menampilkan akses terbatas tanpa data. |
| /team/orders | Akses: staf/admin. Filter dan pagination pesanan, antrean operasional, akses cepat ke detail. `/staff*` lama dialihkan ke sini. |
| /team/orders/:id | Akses: staf/admin. Packing snapshot, `Tandai siap` hanya dengan `orders.ready`, konfirmasi serah terima sekali hanya dengan `orders.complete`, salin pesan WhatsApp manual. Admin tidak melihat tombol aksi fulfillment. |
| /privacy, /terms, /help | Publik. Menjelaskan data fiktif, batasan percobaan dan ketentuan; tidak mengarang kontak/legalitas. Konten belum tersedia berlabel draft |

Navigasi publik: Beranda, Paket & Produk, Tentang Kami, Hubungi Kami, Keranjang, Masuk. Setelah login: Akun dan Pesanan Saya. Tidak ada tautan admin pada navbar pembeli. Logout membersihkan state privat di klien dan menolak request berikutnya.

Demo tidak otomatis mengubah PAID menjadi READY atau PICKED_UP. Akun persisten dapat melihat riwayat pesanan akun sendiri setelah login ulang pada browser lain; jangan mengklaim pemulihan akun lewat email tersedia. Order legacy milik sesi lama tetap terisolasi dan tidak dipasang ke akun berdasarkan kecocokan email. Profil tidak memulihkan akses ke order yang bukan milik akun.

Portal operator memakai sesi dan CSRF sendiri; setiap route tim/admin memeriksa role dan izin dari D1. Izin yang dicabut berlaku pada request berikutnya. UI hanya menyembunyikan aksi yang tidak diizinkan, bukan menjadi kontrol keamanan.

## 5. Mobile, aksesibilitas dan kegagalan

Mulai 360px; uji 390/430/768/1280, zoom 200%, tanpa overflow. Form satu kolom, target sentuh 48px, CTA sticky tidak menutup input/fokus. Label terlihat, error aria-describedby, status live region, keyboard semantik dengan focus terlihat. Dialog Escape/focus return; reduced motion. Status bukan warna saja.

Gambar memakai rasio asli, `object-fit: contain`, width/height eksplisit dan `srcset`/`sizes` sesuai slot; turunan 480 dan 960 hanya bila sumber mendukung, tanpa upscale. Lazy-load di bawah layar, alt menyebut produk dan fakultas.

Tidak ada tautan # dummy atau tombol tanpa aksi. Loading/empty/error/offline diperiksa. Retry konfirmasi menggunakan order/key sama; kegagalan DB menampilkan error, bukan invoice palsu lokal. Ulasan dirender sebagai teks, bukan HTML mentah. Data tim tidak di-cache di URL atau localStorage; email/password tidak masuk URL atau localStorage.

## 6. Verifikasi

Belum ada bukti UI/backend demo selesai. Wajib build/typecheck/test, klik setiap kontrol, kontras, keyboard, mobile, refresh deep-link, guard halaman privat, cookie/CSRF/ownership, invoice snapshot, kualitas gambar dan race check/expiry. Uji staging Cloudflare terpisah dari lokal. Bukti di [RELEASE.md](RELEASE.md); tidak ada klaim gateway atau pembayaran nyata.
