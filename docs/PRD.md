# Product Requirements Document: MabaKit

Revisi: 22 Oktober 2026. Target aktif: demo presentasi dosen, bukan toko yang menerima uang nyata. Tujuan bisnis mengikuti [BRD.md](BRD.md); kontrak data mengikuti [SCHEMA.md](SCHEMA.md).

## 1. Tujuan dan scope aktif

Website toko perlengkapan PKKMB mahasiswa baru UNJ, wali dan koordinator. Pembeli melihat spesifikasi/harga, memilih satuan atau paket, checkout, melakukan simulasi pembayaran, lalu melihat pesanan dan invoice digital. MabaKit menjual barang sendiri, bukan marketplace atau kanal resmi kampus.

Platform dipilih: React + TypeScript + Vite + Tailwind CSS di Cloudflare Workers Static Assets, API Cloudflare Workers dan database D1. Foto contoh berizin memakai Static Assets; R2 ditunda sampai upload diperlukan. Data/harga/lokasi demo wajib berlabel SIMULASI.

Booking/reservasi tidak masuk produk maupun roadmap. Tidak ada kalender, pilihan slot, kuota kunjungan, booking fee atau reschedule. Pengambilan mengikuti informasi toko setelah READY, tanpa memesan waktu. Alokasi stok checkout adalah pengaman internal, bukan reservasi pelanggan.

Midtrans/Xendit ditunda sampai pemilik memutuskan melanjutkan setelah presentasi. Demo tidak meminta kredensial merchant, mengirim request gateway, menampilkan QR/rekening pembayaran nyata atau menerima uang. Kurir, builder khusus, kustomisasi, diskon kelompok otomatis, WhatsApp/PDF otomatis dan scanner kamera juga ditunda.

## 2. Kebutuhan dan acceptance criteria

| ID | Kebutuhan |
|---|---|
| FR01 | Katalog aktif menampilkan spesifikasi, varian, harga IDR, ketersediaan dan isi paket. Foto berizin atau placeholder berlabel. Checklist fakultas/prodi hanya dipublikasikan dengan sumber/tahun/verifikasi; tidak mengklaim resmi. |
| FR02 | SKU adalah unit stok. Paket tetap berisi SKU dan jumlah, tanpa paket bersarang. Ketersediaan paket mengikuti seluruh komponen. Kombinasi lain lewat barang satuan di keranjang. |
| FR03 | Keranjang lokal tanpa PII/token. Data rusak direset dengan pesan. Harga/stok divalidasi ulang server; perubahan versi/harga/instruksi menghasilkan 409 dan konfirmasi ulang. |
| FR04 | Demo tidak memerlukan email OTP nyata. Usulan akses demo: sesi tamu opaque dibuat Worker, cookie HttpOnly, Secure pada HTTPS, SameSite=Lax. Detail/invoice hanya untuk sesi pemilik. Mode demo bukan autentikasi pelanggan produksi. Admin/staf tidak boleh mendapat role dari pilihan di browser; jalur demo admin harus dibatasi dan memakai data simulasi terpisah. Login produksi dan MFA ditunda, bukan diklaim tersedia. |
| FR05 | Checkout: nama pembeli/penerima dan nomor kontak Indonesia; gunakan data fiktif saat presentasi. Nama trim 1-100 karakter; telepon 08/628/+628 dinormalisasi menjadi +628 diikuti 8-11 digit. Fakultas/prodi opsional, pasangan harus cocok; NIM tidak wajib. Lokasi/jam layanan ditampilkan, bukan dipilih. |
| FR06 | Maksimum 20 baris unik, quantity integer 1-99 per baris, total maksimum Rp10.000.000. Server menolak ID asing/nonaktif, pecahan, negatif, komposisi kosong, checkout ditutup, body >32 KB atau field tidak dikenal. |
| FR07 | Checkout server menghitung total dari D1, membuat draft order PENDING, snapshot dan alokasi stok HELD atomik. Key sama/body sama mengembalikan draft sama; key sama/body beda 409. Draft diperlukan agar refresh tidak menggandakan pesanan. |
| FR08 | Halaman pembayaran menampilkan total dari snapshot, pilihan metode berlabel simulasi (transfer bank, e-wallet, QRIS), tanpa instruksi bayar nyata. Pemilihan metode disimpan dan dibatasi enum server. Tombol “Cek status pembayaran” menjalankan simulasi sukses di Worker, bukan pemeriksaan bank. Keterangan ini terlihat sebelum klik. |
| FR09 | Klik tombol menghasilkan PAID simulasi, alokasi CONSUMED dan invoice dalam satu batch atomik. Konfirmasi menampilkan “Pesanan simulasi berhasil dibuat”, invoice digital dan status sedang disiapkan. Klik ulang/refresh/dua tab tidak membuat invoice atau pengurangan stok kedua. PAID tidak berarti READY. |
| FR10 | Halaman order milik sesi menampilkan snapshot barang/paket, jumlah, total, metode dan status. Invoice berupa halaman HTML responsif dengan nomor unik, nomor order, tanggal WIB, penerima, rincian harga/jumlah/subtotal/total, metode, status dan watermark “SIMULASI, bukan bukti pembayaran nyata”. Tidak mengklaim faktur pajak; PDF/email otomatis bukan scope. |
| FR11 | Staf demo terbatas melihat packing, menandai READY dan mengklaim pickup sekali. Admin demo terbatas mengelola katalog/stok/instruksi dan pause checkout dengan audit. Tidak ada akses publik generik mengubah tabel/role/status. |
| FR12 | Draft demo kedaluwarsa 30 menit setelah dibuat; stok dilepas sekali bila masih PENDING/HELD. Klik cek sesudah expiry ditolak dan meminta checkout baru. Karena tidak ada gateway, demo boleh menentukan expiry sendiri. Kegagalan DB tidak boleh menampilkan sukses. |

## 3. Uang dan snapshot

Semua nominal INTEGER rupiah, operasi JavaScript memakai safe integer, bukan pecahan float untuk uang. Harga SKU/paket positif; subtotal = jumlah unit_price_rp × quantity; total = subtotal. Pickup dan biaya simulasi Rp0, tidak ada surcharge tersembunyi.

Fixture SIMULASI: A Rp15.000 × 2 + P Rp30.000 × 1 = Rp60.000. Jika P berisi A×1/B×2, kebutuhan stok A×3/B×2. Paket tidak mempunyai stok virtual kedua. Snapshot judul, atribut, komponen, harga dan instruksi tidak berubah setelah checkout.

## 4. Status dan pembatasan simulasi

| Dimensi | Status demo | Aturan |
|---|---|---|
| payment_status | PENDING, PAID, EXPIRED | PAID hanya melalui endpoint simulasi milik sesi; semua row payment mode DEMO |
| fulfillment_status | UNFULFILLED, READY, PICKED_UP, CANCELLED | READY perlu PAID; penyerahan sekali; expiry membatalkan draft |
| stock_allocation_status | HELD, CONSUMED, RELEASED | HELD dikonsumsi saat PAID atau dilepas saat expiry; tidak kembali HELD |

Endpoint konfirmasi simulasi hanya terdaftar saat environment demo eksplisit. Deployment produksi tidak boleh mendaftarkannya; request harus ditolak. Mengubah label atau environment saja tidak mengaktifkan gateway nyata. Data DEMO tidak boleh disalin menjadi transaksi produksi atau diperlakukan sebagai pembayaran sah.

Reset demo harus dibatasi operator, menolak environment non-demo dan tidak pernah menyentuh database produksi. Reset bukan fitur publik.

## 5. Keamanan dan kualitas

Semua akses D1 melalui Worker. Tidak ada RLS atau akses DB langsung dari browser. Actor dari sesi server, otorisasi/ownership per route, SQL berparameter, projection field minimum. Mutasi cookie memeriksa Origin dan token CSRF; rate limit checkout 5/menit/sesi serta pencarian pickup 30/menit/staf harus ditegakkan server, bukan hanya memory per instance.

Demo publik membatasi pembuatan sesi sebelum sesi diterbitkan: maksimum 10/menit/IP yang dihash dengan salt server (IP dari metadata Cloudflare terpercaya, bukan header bebas). Batas awal pilot: maksimum 2 draft HELD aktif per sesi dan 10 per IP hash; penolakan 429 tanpa alokasi baru. Counter dan pemeriksaan hold harus atomik di D1, termasuk request paralel; IP bersama bisa terkena limit dan operator dapat meninjau batas tanpa menonaktifkan proteksi. Jangan menyimpan IP mentah; hash/window kedaluwarsa dibersihkan. Uji bypass lewat sesi baru wajib sebelum demo publik.

Cookie sesi tidak disimpan di localStorage. Token hanya hash di DB; token pickup tidak masuk URL/log. Respons error tidak membocorkan SQL, token atau PII. HTTPS, CSP, rendering teks tanpa HTML mentah dan secret binding wajib. Demo publik tetap memakai data fiktif, akses minimum dan isolasi environment.

Mobile mulai 360px, zoom 200%, target 48px, keyboard, focus, reduced motion dan kontras WCAG AA. Status loading/empty/error dan retry wajib; tidak perlu polling gateway pada demo. Target uji, bukan klaim hasil: LCP ≤2,5 detik, CLS ≤0,1 pada profil mobile 4G; checkout server p95 ≤2 detik; pilot 20 checkout serentak.

## 6. Gerbang pembayaran nyata, ditunda

Jangan membuat adapter Midtrans/Xendit, webhook atau cron rekonsiliasi sekarang. Sebelum aktivasi: pilih satu provider, setujui D01-D08, autentikasi produksi/MFA, kebijakan refund/retensi, biaya cloud dan backup. Kontrak provider ditulis dan diuji sandbox sebelum kode menerima uang.

Baseline keamanan kelak: total server, signature dan status provider diverifikasi, amount/currency/referensi/environment cocok, idempotency, jaringan di luar batch D1, timeout tidak melepas stok ambigu. Late settlement setelah release masuk REVIEW/CANCELLED, bukan menghidupkan order. Refund penuh manual dengan bukti; restock sekali sebelum pickup, tanpa restock otomatis setelah penyerahan. Detail status live dan mapping provider merupakan pekerjaan baru, bukan fitur demo yang telah selesai.

[RELEASE.md](RELEASE.md) memisahkan bukti demo dan gerbang produksi. Tidak ada klaim gateway terintegrasi atau uang diterima.
