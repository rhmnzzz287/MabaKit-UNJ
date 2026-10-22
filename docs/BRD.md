# Business Requirements Document: MabaKit UNJ

Revisi: 22 Oktober 2026. Status: baseline dokumentasi setelah penghapusan booking/reservasi; keputusan bisnis dan kesiapan operasional tetap memerlukan persetujuan pemilik.

## 1. Masalah, tujuan dan pelanggan

Mahasiswa baru kesulitan menemukan perlengkapan PKKMB dengan spesifikasi jelas, membandingkan biaya, dan membeli beberapa barang tanpa berpindah toko. MabaKit menjual stok sendiri melalui katalog satuan dan paket, dengan harga transparan serta konfirmasi pesanan yang bisa diperiksa.

Tujuan website adalah membantu pelanggan memilih perlengkapan sesuai kebutuhan dan anggaran, menyelesaikan pembelian, serta mengetahui progres sampai barang diserahkan. Keberhasilan dinilai dari alur belanja dan pemenuhan pesanan, bukan jumlah booking atau pemesanan waktu.

Pembeli mencakup mahasiswa, orang tua/wali dan koordinator kelompok. Pembeli tidak wajib memiliki NIM. Penerima barang dapat berbeda dari pemilik akun. MabaKit bukan marketplace dan belum terbukti sebagai kanal resmi UNJ/BEM/HIMA.

Sumber: `../MabaKit Define.md`. Angka simulasi pendapatan dan biaya pada sumber bukan harga publik atau realisasi usaha.

## 2. Batas produk dan rollout

| Tahap | Ruang lingkup | Syarat aktivasi |
|---|---|---|
| Rilis pertama | Katalog terkurasi, satuan, paket tetap, keranjang lokal, akun email OTP, checkout Midtrans Snap, pengambilan di satu lokasi, pengelolaan stok/pesanan, bukti pesanan dalam web, penyerahan dengan kode | Kontrak teknis diuji; keputusan D01-D08 lengkap |
| Berikutnya | Paket rakitan khusus, kustomisasi berbayar, harga kolektif otomatis, pengiriman kurir | Harga, kapasitas kerja, aturan biaya, SLA dan kebijakan pembatalan disetujui |
| Opsional | QR/kamera scanner, WhatsApp otomatis, PDF invoice, video/testimoni | Ada kebutuhan operasional dan aset/izin; kanal cadangan tersedia |

**Di luar cakupan project:** booking dan reservasi, termasuk kalender kedatangan, pemilihan slot, kuota kunjungan, booking fee dan reschedule. Fitur tersebut tidak masuk roadmap. Pengambilan barang adalah tahap pemenuhan pembelian; pembeli mengikuti informasi lokasi/jam layanan dan menunggu status siap, tanpa memesan jadwal.

Pembeli tetap dapat merakit kebutuhannya lewat item satuan dan jumlah di keranjang. Rilis pertama tidak menawarkan diskon kelompok otomatis, bundel bersarang, preorder, pembayaran sebagian, pengambilan sebagian atau multi-lokasi. Model awal adalah pembelian stok tersedia, bukan pesan barang untuk dibayar nanti. Alokasi stok sementara selama pembayaran diproses hanya pengaman transaksi internal.

Pesanan besar melebihi batas checkout diarahkan ke kontak operator tanpa janji harga khusus otomatis. Penundaan fitur sumber merupakan rekomendasi untuk mengurangi risiko awal; pemilik menyetujui rollout sebelum implementasi. Fitur tertunda yang diminta masuk rilis pertama memerlukan kontrak lengkap sebelum pengerjaan.

## 3. Nilai dan ukuran keberhasilan

- Pembeli dapat melihat bahan, ukuran, warna, isi paket, total final dan cara pengambilan sebelum membayar.
- Pembayaran sah tercatat satu kali; tidak ada penjualan melebihi stok tersedia.
- Staf mengetahui barang yang harus disiapkan dari snapshot pembelian, bukan katalog yang dapat berubah.
- Setiap pembayaran belum cocok atau perlu refund masuk daftar tindak lanjut dengan pemilik kasus.
- Ukur pesanan lunas, penyerahan selesai, kegagalan checkout, mismatch pembayaran, refund dan kontribusi transaksi. Target volume/konversi ditetapkan setelah baseline pilot; jangan menampilkan angka rekaan.

Kontribusi transaksi = pendapatan barang dikurangi harga pokok, kemasan, fee gateway, tenaga langsung, subsidi dan biaya retur/refund yang relevan. Paket tidak otomatis lebih menguntungkan. Harga jual integer rupiah, termasuk biaya yang dibebankan kepada pembeli; fee gateway ditanggung toko pada rilis pertama. Perlakuan pajak wajib dikonfirmasi pemilik sebelum harga dipublikasikan.

## 4. Keputusan bisnis wajib

Semua keputusan berikut berstatus **BELUM DIKONFIRMASI**. Nama individu, bukti dan tanggal keputusan diisi pemilik sebelum go-live. Tenggat berarti gerbang, bukan tanggal fiktif.

| ID | Keputusan / bukti yang diperlukan | Penanggung jawab | Tenggat |
|---|---|---|---|
| D01 | Nama penjual/legalitas, rekening settlement, akun merchant Midtrans aktif, channel yang disetujui, izin merek/foto | Pemilik usaha | Sebelum aktivasi pembayaran produksi |
| D02 | SKU pilot, stok fisik, supplier, isi paket tetap, harga jual dan biaya, pajak serta margin | Pemilik + logistik | Sebelum publikasi katalog |
| D03 | Fakultas/prodi dan ketentuan PKKMB tahun berjalan; sumber, tahun, tanggal verifikasi; jangan klaim resmi tanpa izin | Kurator | Sebelum publikasi checklist |
| D04 | Satu lokasi pengambilan yang diizinkan, tanggal/jam layanan WIB, staf, kemampuan penyiapan dan prosedur barang belum diambil; tanpa jadwal pilihan pelanggan | Logistik | Sebelum membuka checkout |
| D05 | Kontak bantuan, jam layanan, tenggat respons, pembatalan, retur barang cacat/tidak sesuai, refund dan estimasi penyelesaiannya | Pemilik + operasional | Sebelum membuka checkout |
| D06 | Pemberitahuan privasi, dasar pemrosesan, pengelola data, jangka simpan dan permintaan hapus; retensi finansial sesuai kewajiban hukum | Pemilik | Sebelum mengumpulkan data pelanggan nyata |
| D07 | Anggaran hosting, paket backup, penanggung jawab insiden, batas transaksi pilot berdasarkan uji beban | Pemilik + teknis | Sebelum peluncuran |
| D08 | Persetujuan baseline dan penundaan fitur, kriteria UAT, tim staf/admin dan persetujuan peluncuran | Pemilik | Sebelum implementasi untuk scope; sebelum go-live untuk UAT |

Tidak menjanjikan pickup di Kampus A Rawamangun, kustom 24 jam, pengiriman H-3, harga diskon atau kelengkapan wajib fakultas sebelum bukti tersedia.

## 5. Operasi dan tanggung jawab

- Pemilik: harga, kebijakan komersial, persetujuan refund dan akses admin.
- Kurator: foto berizin dan ketepatan informasi; checklist tak terverifikasi disembunyikan dari publik.
- Logistik/staf: hitung stok, siapkan pesanan, tandai siap, serahkan barang sekali setelah pemeriksaan penerima.
- Teknis: akses minimum, rekonsiliasi, alarm, backup, rollback dan investigasi tanpa membocorkan rahasia/data pribadi.

Lunas belum berarti siap diambil. Pembeli datang setelah status READY dan mengikuti jam layanan. Informasi lokasi/jam disnapshot saat checkout; bukan janji waktu penyerahan individual. Perubahan operasional pada pesanan berjalan harus diberitahukan langsung, tidak menimpa instruksi lama diam-diam. Jika pemenuhan tidak memungkinkan, operator menawarkan penyelesaian sesuai kebijakan dan persetujuan pembeli.

## 6. Risiko dan keputusan lanjut

| Risiko | Penanganan minimum |
|---|---|
| Ketentuan PKKMB berubah | Sumber dan tanggal verifikasi terlihat; stop penjualan item terkait dan tinjau pesanan terdampak |
| Pembayaran terlambat / hasil gateway ambigu | Pertahankan alokasi stok saat belum pasti, rekonsiliasi server, hentikan checkout baru saat gangguan berkepanjangan |
| Barang sudah habis saat pembayaran terlambat masuk | Jangan aktifkan pemenuhan otomatis; kasus review dan refund/solusi disetujui pembeli |
| Persediaan fisik berbeda | Penyesuaian stok diaudit, tanpa mengambil stok yang dialokasikan untuk transaksi berjalan |
| Tim tidak mampu memenuhi volume | Pilot terbatas menurut kemampuan teruji, pause checkout tanpa menghalangi pembeli melihat pesanannya; bukan menambah sistem booking |

Kriteria selesai bisnis: pemilik menerima UAT dan seluruh gerbang [RELEASE.md](RELEASE.md). Status dokumen saja tidak cukup.
