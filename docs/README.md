# MabaKit: tujuan project dan indeks dokumen

Revisi: 22 Oktober 2026. Status: spesifikasi kandidat implementasi. Belum ada aplikasi, migrasi, pengujian integrasi, atau bukti kelayakan produksi.

## Tujuan project

MabaKit adalah website toko perlengkapan PKKMB untuk mahasiswa baru UNJ. Pembeli dapat memeriksa spesifikasi dan harga, memilih barang satuan atau paket sesuai kebutuhan, melihat total belanja, membayar, lalu mengikuti status pesanan sampai barang diserahkan. Orang tua/wali dan koordinator kelompok juga dapat berbelanja tanpa NIM.

Website menjual barang milik MabaKit sendiri, bukan marketplace atau kanal resmi kampus. Nilai utamanya adalah memperjelas pilihan perlengkapan dan menyelesaikan pembelian dalam satu tempat, bukan mengelola jadwal pelanggan.

## Cakupan rilis pertama

- Katalog, detail spesifikasi, varian dan paket tetap dengan isi yang jelas.
- Keranjang lokal, login email OTP, checkout dan pembayaran Midtrans Snap.
- Riwayat pesanan, status pembayaran, status penyiapan dan kode pengambilan.
- Admin katalog/stok, staf penyiapan/penyerahan, serta tindak lanjut pembayaran dan refund.
- Pengambilan barang di satu lokasi operasional dengan informasi jam layanan yang disahkan pemilik. Pembeli tidak memilih atau memesan waktu kedatangan.

**Booking dan reservasi tidak termasuk cakupan project maupun roadmap.** Tidak ada kalender pemesanan, pemilihan slot, kuota kunjungan, booking fee, atau reschedule. Batas waktu pembayaran hanya mengatur transaksi belanja. Alokasi stok sementara saat pembayaran diproses adalah pengaman internal terhadap penjualan ganda, bukan layanan reservasi barang bagi pelanggan.

Paket builder khusus, kustomisasi berbayar, harga kolektif otomatis dan kurir tetap kebutuhan pengembangan berikutnya sesuai sumber bisnis, setelah aturan operasionalnya tersedia. Membeli kombinasi sendiri sudah dapat dilakukan lewat barang satuan di keranjang.

## Urutan baca dan sumber kebenaran

1. [BRD.md](BRD.md): masalah pelanggan, tujuan bisnis, batas produk dan keputusan pemilik.
2. [PRD.md](PRD.md): alur belanja, perilaku produk, pembayaran dan acceptance criteria.
3. [SCHEMA.md](SCHEMA.md): kontrak data, transaksi, akses dan konsistensi stok.
4. [DESIGN.md](DESIGN.md): arsitektur, layar, status dan aksesibilitas.
5. [KISS.md](KISS.md): batas kompleksitas dan alasan penundaan fitur.
6. [RELEASE.md](RELEASE.md): bukti pengujian dan operasional sebelum menerima uang nyata.

Konflik aturan uang, status atau akses harus diselesaikan di PRD dan SCHEMA sebelum kode dibuat. Contoh harga, lokasi dan jam layanan bukan data produksi.

Sumber awal berada di direktori induk: `MabaKit Define.md`, `My First Board.jpg`, dan `Foto Produk-MabaKit Define.pdf`. Sumber bisnis mencakup paket rakitan, kustomisasi dan pesanan kolektif; rollout bertahap tidak membuang kebutuhan tersebut. Foto produk bukan bukti ketentuan PKKMB tahun berjalan atau izin penggunaan logo kampus.

## Batas revisi ini dan gerbang berikutnya

Revisi ini menyelaraskan seluruh dokumen dengan arahan tanpa booking/reservasi. Kontrak slot, kapasitas jadwal dan counter booking dihapus dari checkout, data, layar, operasi dan uji. Pengaman harga, stok, pembayaran, akses dan penyerahan tetap wajib.

**Mulai implementasi:** pemilik menyetujui baseline rilis pertama di BRD dan kontrak PRD/SCHEMA. Pengembangan sandbox boleh memakai fixture berlabel SIMULASI. Keputusan bisnis yang belum tersedia memblokir aktivasi fitur terkait dan peluncuran, bukan diisi dengan tebakan.

**Mulai produksi:** seluruh butir wajib RELEASE memiliki bukti, penanggung jawab dan persetujuan peluncuran. Dokumen tidak menggantikan sandbox test, UAT, pemulihan backup atau aktivasi merchant.

Belum ada izin membangun aplikasi atau deploy dalam revisi dokumentasi ini.
