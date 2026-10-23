# MabaKit Digital Business Website v2: Desain dan Acceptance Criteria

Status: rancangan untuk persetujuan pemilik. Belum menjadi klaim implementasi atau izin deployment.
Tanggal: 22 Oktober 2026.

## 1. Tujuan dan sumber keputusan

MabaKit membantu mahasiswa baru UNJ menyiapkan perlengkapan PKKMB melalui paket yang menyesuaikan fakultas, informasi barang yang jelas, dan pembelian yang dapat dipantau lewat akun. Website merupakan toko milik MabaKit, bukan marketplace dan bukan kanal resmi UNJ.

Sumber utama:
- `docs/reference/objective-by-lecturer.md`: persyaratan website, konsep bisnis, dan video.
- `docs/reference/My First Board.jpg`: perjalanan pelanggan, termasuk cabang yang ditunda secara eksplisit di bawah.
- `docs/reference/updatekatalog.pdf`: sumber katalog dan gambar produk paling baru, 17 halaman; prioritas tertinggi untuk daftar/visual produk, kecuali pengecualian eksplisit pemilik (tas putih tidak dimasukkan).
- `docs/reference/katalog.pdf`: versi katalog sebelumnya, 9 halaman; hanya referensi pembanding atau fallback gambar yang benar bila tidak tersedia pada update terbaru.
- `docs/reference/1MabaKit Define.pdf`: konsep bisnis, paket, dan konteks identitas fakultas; terutama halaman 10–15 untuk referensi lama, bukan sumber katalog terbaru.
- `docs/reference/MabaKit Define.md`: pendamping teks; PDF yang ditunjuk pemilik menjadi rujukan apabila keduanya berbeda.
- Percakapan pemilik: akun email/password tanpa verifikasi email; pembayaran percobaan; pengambilan kampus; admin dashboard; foto baru ditunda; alamat/WhatsApp di bagian 8.

Dokumen ini menggantikan keputusan v1 tentang pembeli tanpa login dan identitas pesanan berbasis sesi. Implementasi v1 tetap baseline, bukan dibuang. Kontrak aktif `AGENT.md`, `docs/PRD.md`, `docs/SCHEMA.md`, `docs/DESIGN.md`, dan `docs/RELEASE.md` harus diselaraskan sebelum kode v2, bukan diam-diam dianggap sudah berubah.

## 2. Kriteria sukses untuk dosen

| Penilaian | Yang harus terlihat pada website | Bukti penerimaan |
| --- | --- | --- |
| Website Completeness, 30% | Homepage, katalog, detail, transaksi, About Us; minimal 5 produk/penawaran; navigasi berfungsi; URL publik | AC-C01–C05, AC-J01, AC-R01 |
| Business Concept, 40% | Masalah mahasiswa baru, target UNJ, solusi paket/satuan, value proposition, model pendapatan, harga dan branding konsisten | AC-B01–B04 |
| Customer Journey Video, 30% | Satu perjalanan lengkap dari homepage sampai hasil akhir beserta penjelasannya, maksimal 7 menit | AC-R02 |

Target bukan aktivasi bisnis produksi. Tidak ada gateway, penagihan uang, pengiriman email otomatis, integrasi ekspedisi, QR pickup, booking, atau slot kunjungan dalam tahap ini.

## 3. Keputusan yang sudah disepakati

1. Lanjutkan React/TypeScript/Vite/Tailwind, Worker API same-origin, dan D1. Pertahankan pengamanan stok, idempotensi, audit, snapshot immutable, serta workspace privat yang sudah ada.
2. Paket menjadi penawaran utama; satuan tetap dapat dibeli pada bagian tersendiri.
3. Kustomisasi berarti penyesuaian isi/varian paket terhadap fakultas. Bukan editor bebas warna, teks, bordir, atau tambah/hapus komponen.
4. Pembeli boleh menjelajah dan menyiapkan keranjang sebelum login, sesuai board. Login wajib sebelum checkout atau akses profil/pesanan/invoice. Keranjang bukan transaksi dan tidak menahan stok.
5. Akun email/password persisten, email sementara boleh. Tidak ada verifikasi email, Google login, atau reset password lewat email pada tahap ini. Kepemilikan berdasarkan ID akun, bukan alamat email atau cookie sesi lama.
6. Admin/tim masuk melalui pintu terpisah. Registrasi publik hanya menghasilkan pembeli; role berasal dari server.
7. Pembayaran tetap percobaan tanpa gateway. Tombol Cek status pembayaran dapat memperagakan perpindahan ke pembayaran tercatat. Tidak mengaku membaca bank atau menerima uang.
8. Pengambilan kampus aktif. Kurir terlihat sebagai opsi nonaktif bertuliskan `Segera tersedia`; tidak ada alamat kirim, ongkir, resi, atau status pengiriman palsu.
9. Foto baru tidak digenerate dalam pekerjaan perencanaan. Gambar katalog memakai sumber terbaru `docs/reference/updatekatalog.pdf`, diekstrak dari gambar tertanam asli, bukan screenshot halaman. Goodie bag putih/natural dikecualikan atas instruksi pemilik; hanya tas warna-warni yang ditampilkan, dijual, dan dipakai dalam paket baru. Jangan mengarang foto paket lengkap.
10. Website ditujukan untuk presentasi. Kredensial presentasi bukan standar keamanan operasional.

## 4. Pendekatan dan alasan

Dipilih: modernisasi bertahap fondasi yang ada. Autentikasi akun, konfigurasi fakultas, dan dashboard admin ditambahkan tanpa mengulang mesin transaksi.

Alternatif: bangun ulang seluruh website. Ditolak karena mengulang guard stok/akses dan menambah risiko regresi tanpa manfaat bagi penilaian dosen.

Urutan ketergantungan: kontrak/data dan autentikasi; konfigurasi paket; perjalanan pembeli; operasional admin; verifikasi dan publikasi dengan izin. Rencana implementasi file-per-file ditulis setelah desain ini disetujui.

## 5. Perjalanan pelanggan dan pemetaan board

| Langkah board | Perilaku v2 |
| --- | --- |
| Masuk homepage | Problem/solusi singkat, paket utama, CTA `Pilih paket sesuai fakultas`; satuan sebagai alternatif, bukan fokus yang sama besar |
| Pilih fakultas/prodi | Pilihan fakultas relevan PDF; prodi hanya yang sudah memiliki data. Tidak mengarang daftar prodi atau menganggap prodi memiliki aturan khusus tanpa sumber |
| Checklist spesifikasi | Daftar perlengkapan referensi, barang yang tercakup paket, dan spesifikasi yang tersedia. Tidak memakai istilah `ketentuan resmi` tanpa bukti |
| Pilih paket/satuan | Paket Hemat, Paket Praktis, Starter Kit sebagai struktur penawaran; hanya penawaran yang komposisi, harga, dan stoknya sudah valid yang dapat dibeli |
| Detail | Foto tersedia, deskripsi, spesifikasi, isi paket, harga, ketersediaan, dan panduan penyesuaian fakultas |
| Kustomisasi | Halaman tersendiri sebelum paket masuk keranjang, menampilkan fakultas, komponen dan varian yang cocok. Pemilihan fakultas menyelesaikan varian di server |
| Keranjang / tambah barang lain | Ringkasan konfigurasi; kuantitas/edit/hapus; kembali ke katalog tidak menghilangkan pilihan |
| Cek sudah login | Belum login diarahkan ke login/daftar dengan tujuan kembali aman; cart tetap tersedia |
| Login / daftar | Email dan password; data nama/WhatsApp/fakultas dilengkapi profil atau checkout. NIM tidak wajib; wali/pembeli lain tetap dapat bertransaksi |
| Checkout | Identitas kontak diisi dari profil dan dapat diperiksa; fakultas penerima dibedakan dari email akun. Rincian total dan lokasi ambil terlihat sebelum submit |
| Distribusi | Ambil di kampus aktif, kurir nonaktif dengan `Segera tersedia`; tanpa pemilihan tanggal/jam booking |
| Pembayaran | Pilih metode yang ditampilkan untuk percobaan, lihat ringkasan, tekan `Cek status pembayaran`; kegagalan/retry tidak membuat hasil palsu |
| Invoice / nomor pesanan | Setelah pembayaran tercatat; order number unik dan instruksi berikutnya; keterangan bahwa dokumen bukan bukti pembayaran nyata |
| Email/WhatsApp/QR pada board | Pengiriman otomatis dan QR ditunda. Invoice tersedia di akun; Contact Us membuka WhatsApp secara manual. Tidak mengklaim pesan terkirim |
| Pantau pesanan | Login ulang tetap melihat riwayat; timeline mengikuti status server dan timestamp; tim mengubah fulfillment sesuai izin |

Perubahan fakultas setelah konfigurasi tidak mengganti barang diam-diam: konfigurasi dihitung ulang, perbedaan ditampilkan, pembeli harus mengonfirmasi sebelum lanjut. Paket untuk fakultas berbeda boleh berada dalam satu cart sebagai baris terpisah.

## 6. Halaman dan navigasi

| Route usulan | Akses | Isi/tindakan utama |
| --- | --- | --- |
| `/` | Publik | Penawaran paket utama, manfaat yang relevan, cara pembelian, tautan satuan |
| `/catalog` | Publik | Bagian paket dahulu; bagian produk satuan terpisah dengan heading jelas; filter fakultas |
| `/products/:id` | Publik | Detail barang/paket; CTA paket menuju halaman penyesuaian, satuan menuju pemilihan varian |
| `/packages/:id/customize` | Publik | Fakultas, prodi bila tersedia, checklist, komponen sesuai fakultas, harga/stok, CTA tambah keranjang |
| `/cart` | Publik | Pilihan tersimpan, edit konfigurasi, kuantitas, total, lanjut checkout melalui login |
| `/login`, `/register` | Publik | Akun pembeli; kembali ke tujuan internal yang diizinkan |
| `/profile` | Pembeli login | Nama, kontak, fakultas/prodi; email login tidak bisa diubah lewat field kontak |
| `/checkout` | Pembeli login | Kontak, snapshot isi, total, pickup dan submit idempoten |
| `/orders` | Pembeli login | Pesanan Saya, status, empty/loading/error/refresh |
| `/orders/:id` | Pemilik | Detail, timeline, lokasi ambil, invoice bila memenuhi status |
| `/orders/:id/payment` | Pemilik | Alur cek status percobaan, tanpa rekening/QR pembayaran nyata |
| `/orders/:id/invoice` | Pemilik | Snapshot pembelian dan dokumen yang jujur tentang pembayaran percobaan |
| `/about` | Publik | Customer problem, target customer, solusi, nilai paket/satuan, revenue model penjualan barang |
| `/contact` | Publik | Alamat dan WhatsApp dari pemilik; bukan klaim toko resmi/lokasi pickup terkonfirmasi |
| `/operator/login` | Publik, tanpa data privat | Login akun individual admin/tim; tidak lagi memilih role lalu memasukkan kode bersama |
| `/admin` | Admin | Dashboard lengkap di bagian 10 |
| `/team`, `/team/orders`, `/team/orders/:id` | Staff/admin | Penjualan dan operasional pesanan; staff tidak mendapat hak CRUD admin |

Navigasi publik: Beranda, Paket & Produk, Tentang Kami, Hubungi Kami, Keranjang, Masuk. Setelah login: Akun dan Pesanan Saya. Tidak menampilkan tautan admin pada navbar pembeli. `/staff*` lama tetap dijaga dan dialihkan; route turunannya tidak menjadi celah akses.

## 7. Data fakultas, produk, dan paket

### 7.1 Aturan sumber

Referensi lama PDF Define halaman 10–14 dan katalog terbaru memperlihatkan:
- Topi putih dengan tulisan fakultas: FEB, FIP, FIK, FPPsi, FT, FIS, FMIPA, FBS.
- Referensi warna: FEB oranye, FIP hijau, FIK/FIKK putih dengan tulisan gelap, FPPsi/FPSI/FPsi biru muda, FT biru, FIS/FISH merah, FMIPA ungu, FBS hijau toska. Ini deskripsi visual sumber, bukan kode warna resmi.
- Produk umum: rok span/A-line, kemeja putih, gesper hitam, kaus kaki putih di atas mata kaki, slayer, kipas, totebag, dasi, notebook.

Nama/label dari sumber tetap disimpan. Gunakan satu identitas fakultas internal dengan alias untuk label yang merujuk kelompok sama: FIS/FISH; FIK/FIKK; FPPsi/FPSI/FPsi. Display produk boleh memakai label persis pada sumbernya. Alias tidak menghasilkan stok atau fakultas duplikat.

Katalog terbaru `updatekatalog.pdf` memisahkan notebook (halaman 6–7) dan totebag (halaman 12–14) sebagai dua kategori berbeda. Ini menggantikan ambiguitas label/foto pada PDF Define lama. Jangan menukar foto/SKU notebook dan tas. Label `FEG` pada bagian totebag disimpan sebagai label sumber belum terkonfirmasi, bukan otomatis dianggap FEB atau fakultas baru; mapping penjualannya ditahan sampai jelas. Label lain yang sudah disepakati tetap mengikuti aturan alias di atas.

Goodie bag putih/natural pada sumber lama/data existing tidak termasuk penawaran v2. Update terbaru juga memuat totebag FIKK berwarna putih: instruksi pengecualian tas putih tetap berlaku, sehingga varian ini tidak otomatis dipublikasikan. Fakultas FIK/FIKK tetap tersedia untuk produk lain; paket yang membutuhkan tas fakultas tersebut menunggu varian berwarna yang disetujui, tanpa fallback ke tas fakultas lain. Hanya tas warna-warni dari katalog terbaru yang boleh dipublikasikan. Nonaktifkan SKU putih/natural untuk pembelian baru, keluarkan dari rekomendasi dan konfigurasi paket baru, lalu petakan ulang paket hanya jika SKU tas berwarna dan harganya sudah ditetapkan; jangan substitusi diam-diam. Snapshot order lama tetap utuh, file sumber tidak dihapus, dan stok tas baru tidak disalin dari SKU putih. Produk hanya dapat menjadi komponen paket jika tipe, varian, harga, dan foto konsisten.

Checklist awal adalah daftar referensi MabaKit, bukan kewajiban resmi per fakultas/prodi. Fakultas tidak berarti seluruh barang sumber wajib dibeli. Tidak membuat spesifikasi bahan/ukuran atau aturan jurusan yang tidak ada datanya.

### 7.2 Penawaran paket

Struktur bisnis mengikuti PDF: Paket Hemat, Paket Praktis, Starter Kit. Contoh komposisi dalam PDF bukan SKU/harga final. Angka simulasi pendapatan dan biaya pada PDF tidak boleh dipakai sebagai omzet aktual atau harga katalog otomatis.

Keputusan usulan implementer: katalog boleh menyiapkan ketiga tipe sebagai draft admin, tetapi tombol beli hanya aktif untuk paket yang disetujui komposisi dan harga serta punya mapping fakultas lengkap. Harga katalog existing tetap baseline; penawaran baru memerlukan data pemilik. Minimal lima penawaran dosen tetap terpenuhi melalui produk existing yang benar, bukan lima paket rekaan.

Satu paket memiliki slot komponen tetap: barang umum menggunakan SKU umum; barang beridentitas fakultas menggunakan SKU dari mapping fakultas. Tidak mengambil SKU fakultas lain sebagai fallback. Stock paket = minimum floor(stok tersedia komponen / kuantitas per paket), memakai hasil konfigurasi, bukan stok paket terpisah.

Harga paket mengikuti harga server yang ditetapkan admin untuk konfigurasi fakultas. Tampilkan rincian isi dan total; klaim `hemat Rp...` hanya jika selisih terhadap total satuan benar dan positif. Harga konfigurasi yang belum ditetapkan berarti belum tersedia, bukan harga nol. Pergantian fakultas memperbarui quote, gambar relevan, dan stok.

### 7.3 Kualitas dan pemetaan gambar katalog

Inventaris awal `updatekatalog.pdf` berisi 63 gambar tertanam, dibanding 40 pada `katalog.pdf`. Terdapat 16 gambar 1920×1280 (delapan slayer dan delapan dasi fakultas), 26 gambar 1024×765, dan sumber lain hingga 2048×1365. Foto slayer tambahan pada bagian akhir berukuran sekitar 1366–1376px lebar, serta 1152×925. Gambar referensi fakultas sekitar 255–268px tetap tidak layak diperbesar menjadi foto detail produk.

Penambahan yang sudah diperiksa visual: slayer dan dasi untuk FEB, FIP, FIK, FPPsi, FT, FIS, FMIPA, FBS; foto slayer segitiga tambahan; notebook FEB/FIP; totebag berwarna dan satu visual gabungan paket. Slayer panjang dan segitiga tidak dianggap SKU identik tanpa atribut/model yang jelas. Foto bundling berisi beberapa barang bukan bukti komposisi atau harga paket final, dan tidak boleh dipasang pada paket yang isinya berbeda. Tulisan tahun/label pada gambar tidak menjadi klaim aturan PKKMB tahun berjalan.

Notebook/tas yang sebelumnya kurang lengkap kini memiliki lebih banyak visual, tetapi stok, harga, komposisi paket dan status publikasi tetap perlu data server. Penambahan foto tidak otomatis berarti produk tersedia. Label `FEG` masih muncul pada teks sumber, sementara foto tas oranye bertuliskan Fakultas Ekonomi dan Bisnis; simpan ketidaksesuaian ini dalam manifest dan jangan mengubah alias penjualan tanpa konfirmasi. Resolusi sumber adalah batas kualitas, bukan sesuatu yang diperbaiki hanya dengan menaikkan angka piksel.

Ketentuan implementasi:
- Ekstrak embedded images langsung dari PDF, bukan screenshot, thumbnail pembaca PDF, atau render seluruh halaman lalu crop foto. Pertahankan master asli di luar bundle publik; file hasil ekstraksi sementara bukan perubahan kode pada tahap ini.
- Buat manifest yang mencatat halaman PDF, indeks gambar, ukuran asli, product/variant ID, label fakultas sumber, jenis foto/ilustrasi, dan status dipakai/dikecualikan. Verifikasi visual setiap mapping; urutan ekstraksi tidak dianggap urutan SKU.
- Hanya turunkan ukuran dari master, jangan upscale atau memakai AI sharpening/generation untuk menutupi sumber kecil tanpa instruksi baru pemilik. Gambar yang tidak cukup besar ditampilkan lebih kecil atau memakai sumber existing yang benar dan lebih baik; kebutuhan pengganti dicatat.
- Gunakan WebP atau JPEG dengan kualitas awal 85–90 dan periksa hasil visual; jangan berulang kali mengompresi file turunan. Sediakan lebar 480px dan 960px jika sumber mendukungnya; varian tidak boleh melebihi dimensi asli. Tidak ada kewajiban membuat 960px dari gambar 765px potret.
- Gunakan `srcset`/`sizes` sesuai slot aktual. Untuk layar 2×, targetkan resolusi intrinsik dua kali lebar render; jika sumber kurang, batasi ukuran tampil atau catat pengecualian kualitas, jangan mengklaim detail tajam.
- Foto berasio asli, `object-fit: contain` pada slot katalog/detail agar tulisan fakultas, barang, dan warna tidak terpotong. Jangan stretching, filter warna, atau zoom di atas resolusi master. Tetapkan width/height untuk mencegah layout bergeser.
- Alt menjelaskan produk dan fakultas yang benar. Gambar referensi/ilustrasi tidak diklaim foto barang asli. Lazy-load gambar di bawah layar; gambar utama detail tidak wajib lazy.
- Quality gate pada kartu mobile, desktop, detail dan layar 2×: tulisan fakultas terbaca sesuai sumber, warna tidak berubah mencolok, tidak ada crop barang, blur akibat upscale, rasio rusak, atau gambar salah SKU. Screenshot pemeriksaan menjadi bukti manual; build saja tidak membuktikan kualitas gambar.
- Goodie bag putih/natural tidak tampil pada kartu, detail aktif, carousel, thumbnail, rekomendasi maupun foto paket baru. Jangan menghapus rekam gambar dari snapshot order lama.

## 8. Contact Us dan identitas bisnis

Tampilkan persis informasi dari pemilik:

- Jalan R.Mangun Muka Raya No. 11
- Kelurahan: Rawamangun
- Kecamatan: Pulo Gadung
- Kota: Jakarta Timur, Daerah Khusus Ibukota Jakarta 13220
- WhatsApp: +6283874234882

Tautan WhatsApp: `https://wa.me/6283874234882`. Membuka chat manual tidak menyatakan pesan telah dikirim. Tidak mengarang email support, jam buka, anggota tim, peta embed, atau nomor lain.

Alamat ini informasi kontak. Lokasi pengambilan memakai store settings yang diperiksa pemilik, kemudian disalin sebagai snapshot ke order. Jangan menyamakan alamat kontak dengan pickup point tanpa konfirmasi. Contact Us bisa dipublikasikan sesuai permintaan pemilik; lokasi pickup yang belum disetujui memblokir kesiapan publikasi checkout, bukan diisi alamat rekaan.

## 9. Akun, akses, dan data pribadi

### 9.1 Akun persisten

`users.id` stabil; sesi dapat kedaluwarsa/dirotasi tanpa menghilangkan pesanan. Login tidak membuat pembeli baru. Registrasi hanya role buyer, email dinormalisasi, unik tanpa membedakan kapital. Email sementara tidak diblokir berdasarkan domain. Email belum terverifikasi tidak diklaim verified.

Usulan validasi: nama 1–80 karakter; email maksimal 254 karakter; password 8–128 karakter tanpa pemotongan diam-diam; WhatsApp divalidasi/normalisasi server. Email admin seed di bawah pengecualian khusus seed, bukan alasan melonggarkan validasi registrasi publik. Error login umum tidak mengungkap akun ada/tidak. Jangan memasukkan email/password ke URL, localStorage, log, atau bundle.

Autentikasi wajib memakai mekanisme/library terpelihara yang terbukti kompatibel Workers+D1, bukan membuat algoritme hash/kriptografi sendiri. Sebelum implementasi akun: lakukan qualification singkat yang membuktikan register/login, hash salted, session cookie, rotasi/logout, dan D1 lokal. Dependency baru harus disetujui; jika solusi memerlukan vendor berbayar atau ORM tambahan, berhenti dan minta persetujuan. Pemilihan paket/version menjadi keputusan eksplisit rencana teknis setelah qualification, bukan diasumsikan sudah tersedia.

Cookie opaque HttpOnly, SameSite, Secure pada HTTPS; token disimpan sebagai hash di DB; CSRF dan Origin untuk mutasi; pembatasan login per sumber server dan identitas/sesi. Logout/revocation segera menolak request berikutnya. Jangan mengganti akun kedaluwarsa dengan sesi tamu lalu meneruskan transaksi otomatis.

Pembeli publik tanpa akun: katalog/cart saja. Buyer login: profil sendiri dan seluruh pesanan akun sendiri. Staff: snapshot pesanan operasional dan status yang sah, bukan profil akun bebas. Admin: operasional dan katalog/settings/akses; tidak membaca password/hash lewat API.

### 9.2 Seed presentasi

| Role | Email login | Password awal |
| --- | --- | --- |
| Admin | `mabakita@admin` | `admin123` |
| Pembeli | `pembeli@demo.mabakit` | `buyermabakit123` |

Hanya lingkungan presentasi terisolasi. Seed idempoten tidak menggandakan user, mereset password yang sudah diganti, menghapus pesanan, atau menaikkan role akun buyer yang kebetulan menggunakan email sama. Konflik role harus gagal eksplisit. Password di-hash memakai mekanisme auth terpilih; tidak disimpan plaintext di tabel/migrasi/frontend. Seed operator lain hanya lewat admin/provisioning terpercaya, tidak ada pendaftaran admin publik.

Kredensial ini sudah diketahui publik dalam percakapan dan lemah. Jangan pakai data pelanggan nyata, jangan tampilkan login admin di storefront, dan ganti/nonaktifkan sebelum penggunaan operasional. Tidak ada klaim kesiapan auth produksi/MFA/recovery.

### 9.3 Migrasi identitas

Pesanan/profil lama masih session-owned. Jangan mengklaim kepemilikan berdasarkan kesamaan nama/email atau memasang semua order ke akun buyer seed. Legacy order tetap terisolasi sebagai data presentasi lama/read-only operasional. Order baru wajib account-owned. Setup presentasi baru membuat order lewat API akun seed, bukan memindahkan order lama secara sembarang. Backup sebelum migrasi; tanpa reset DB otomatis.

## 10. Dashboard admin dan tim

Dashboard admin bukan sekadar ringkasan stok:

| Bagian | Perilaku |
| --- | --- |
| Ringkasan | Penjualan tercatat percobaan, jumlah pesanan, antrean pending/disiapkan/siap/selesai; periode today/7d/30d/all berbatas WIB; agregat seluruh order |
| Pesanan | Filter payment/fulfillment, pagination, detail kontak/item/komponen/fakultas, timestamp, snapshot lokasi ambil |
| Fulfillment | PAID+UNFULFILLED ke READY; PAID+READY ke PICKED_UP dengan konfirmasi; audit operator/waktu; replay idempoten; tidak memotong stok kedua kali |
| Produk satuan | Buat/edit judul, deskripsi, harga, varian, foto existing, active/nonactive; validasi harga rupiah integer positif dan stok |
| Paket | Draft/publish, slot komponen, mapping fakultas, harga konfigurasi, preview isi/stock; publish ditolak jika konfigurasi belum lengkap |
| Fakultas | Kelola mapping SKU dan alias dengan validasi hubungan; tidak mengarang standar resmi |
| Stok | Stock on hand tidak boleh di bawah reserved; perubahan diaudit; produk terpakai dinonaktifkan, bukan hard delete riwayat |
| Pengambilan | Lokasi, detail, jam layanan informasional, pause checkout; perubahan hanya untuk order baru |
| Akses tim | Daftar akun operator dan pencabutan sesi/akses; role hanya admin; tidak mengembalikan hash/password |
| Audit | Tindakan penting, waktu dan operator; metadata minimum tanpa secret atau data pribadi berlebihan |

Counts antrean memakai created_at; nilai dan jumlah pembayaran tercatat memakai paid_at. UI menjelaskan perbedaan tanggal agar order dibuat kemarin/dibayar hari ini tidak dianggap bug. Ringkasan bukan laba atau uang nyata masuk.

Dashboard staff tetap fokus operasional. Semua endpoint CRUD/settings/stock/akses admin memeriksa admin di server walaupun request tidak berasal dari UI.

## 11. Pembayaran, status, dan copy profesional

Tidak ada badge demo berulang di hero, katalog, nav, login, atau detail barang. Copy utama menjelaskan produk dan aksi konkret. Jangan menghapus kejujuran transaksi:

- Pada pembayaran: `Tidak ada pembayaran atau penagihan nyata pada versi ini.`
- Pada invoice: `Dokumen percobaan, bukan bukti pembayaran sah.` Termasuk tampilan cetak.
- Pada dashboard: nilai diberi konteks `Transaksi percobaan`, tidak dipasarkan sebagai omzet nyata.
- Tombol `Cek status pembayaran` bukan klaim verifikasi bank. Endpoint percobaan hanya bekerja pada data/lingkungan presentasi; tidak ada rekening/QR bayar nyata.

Alur: PENDING/UNFULFILLED; pembayaran percobaan berhasil menjadi PAID/UNFULFILLED dan stok HELD menjadi CONSUMED satu kali; tim menandai READY lalu PICKED_UP. Expiry membuat EXPIRED/CANCELLED dan melepas hold; bukan menjadi tahap sukses. Percobaan cek status pada order expired ditolak.

Timeline buyer: Menunggu pembayaran, Sedang disiapkan, Siap diambil, Sudah diterima. Expired memakai pesan berakhir tersendiri. Ada refresh manual dan refetch saat tab kembali aktif; tidak menjanjikan push real-time.

Ulasan fiktif/example tidak muncul sebagai testimoni nyata. Untuk presentasi tanpa ulasan nyata, hilangkan bagian testimoni publik. Ulasan dari akun pengujian bukan bukti pengalaman pelanggan; jangan menampilkan seed tersebut sebagai social proof tanpa konteks.

## 12. Invarian teknis dan ketahanan

- Harga, komponen, fakultas/varian yang diizinkan, total dan stok dihitung server; body buyer tidak dapat mengubah harga atau role.
- Konfigurasi diberi identitas yang membedakan paket/fakultas/komponen; cart tidak menggabungkan konfigurasi berbeda. Requote saat harga/version berubah, pembeli mengonfirmasi perubahan.
- Checkout memvalidasi ulang active status, mapping fakultas, harga/version, stok dan pickup settings di atomic DB.batch(). Satu komponen gagal berarti semua rollback.
- Idempotency key mengikat akun dan hash payload; double click/retry tidak menggandakan order/hold. Payload berbeda dengan key sama ditolak.
- Snapshot order menyimpan nama/kontak, fakultas dan label sumber, tiap SKU/atribut/kuantitas, harga, isi paket, serta pickup. Edit profil/katalog tidak mengubah order lama.
- Private HTML dan API memakai no-store; tidak ada data lintas akun melalui cache/CDN atau Back setelah logout. Semua path privat melewati Worker sebelum assets.
- Loading/empty/error/retry untuk data; gagal API tidak menjadi konfirmasi lokal. Error DB tidak disamarkan sebagai pembayaran sukses.
- Mobile minimal 360px, zoom 200%, target sentuh 48px, fokus jelas, keyboard lengkap, dialog Escape/focus return, kontras WCAG AA, reduced motion.
- Pertahankan identitas hijau MabaKit dan foto produk existing. Paket mendapat hierarki utama karena solusi bisnisnya pembelian praktis beberapa barang; satuan tetap mudah ditemukan. Usulan dials ENERGY 2 / RHYTHM 2 / MOTION 1, tanpa redesign dekoratif.

## 13. Acceptance criteria

Semua PASS membutuhkan bukti runnable atau inspeksi manual yang dicatat, bukan checkbox asumsi.

### Konsep bisnis dan konten
- **AC-B01:** Homepage menjelaskan masalah persiapan PKKMB, target mahasiswa baru UNJ, dan solusi paket sesuai fakultas dalam copy yang dapat ditemukan tanpa login.
- **AC-B02:** About Us menjelaskan value proposition dan pendapatan penjualan barang/paket; tidak ada klaim marketplace, afiliasi UNJ, omzet/profit rekaan.
- **AC-B03:** Kontak menampilkan semua empat baris alamat dan nomor WhatsApp bagian 8; klik membuka `https://wa.me/6283874234882`; tidak ada klaim pesan terkirim.
- **AC-B04:** Tidak ada testimoni palsu, ilustrasi diklaim foto asli, atau banner demo di seluruh storefront. Pemberitahuan percobaan pembayaran dan invoice tetap ada.

### Katalog dan paket
- **AC-C01:** Homepage, catalog, detail, transaction, About Us, Contact Us memiliki route nyata dan navigasi berfungsi.
- **AC-C02:** Minimal 5 produk/penawaran aktif memiliki judul, deskripsi, foto tersedia dan harga konsisten detail/cart/checkout; produk tanpa data tidak dibuat seolah dapat dibeli.
- **AC-C03:** Paket ditampilkan lebih dahulu dan menjadi CTA utama; produk satuan berada pada bagian terpisah dan tetap bisa dibeli.
- **AC-C04:** Paket wajib melewati halaman penyesuaian; pilih fakultas memperbarui komponen relevan, varian, foto tersedia, harga dan stok. Fakultas tanpa mapping tidak dapat dipaksa checkout.
- **AC-C05:** Label sumber/alias PDF dipertahankan tanpa duplikasi stok. Tidak ada daftar prodi atau klaim checklist resmi rekaan.
- **AC-C06:** Dua paket sama dengan fakultas berbeda menjadi baris berbeda; edit fakultas menampilkan perubahan dan meminta konfirmasi; refresh/login tidak menghilangkan pilihan.
- **AC-C07:** SKU salah fakultas, harga palsu, mapping hilang/nonactive, atau stok kurang ditolak server. Tidak ada fallback SKU fakultas lain.
- **AC-C08:** Foto setiap SKU aktif dipetakan ke gambar sumber `updatekatalog.pdf` (prioritas), `katalog.pdf` (fallback yang cocok), atau sumber existing yang benar melalui manifest; notebook tidak memakai foto totebag. Nama fakultas dan warna cocok dengan sumber. Label ambigu `FEG` tidak dipetakan ke FEB tanpa konfirmasi.
- **AC-C09:** Gambar berasal embedded image asli, rasio utuh, tidak di-upscale, dan diperiksa pada kartu/detail mobile/desktop serta layar 2×. Sumber kecil dibatasi ukuran tampil atau ditandai membutuhkan pengganti; tidak ada klaim resolusi tinggi hasil pembesaran semu.
- **AC-C10:** Goodie bag putih/natural, termasuk totebag FIKK putih pada update terbaru, tidak dapat dibeli melalui katalog, URL lama maupun request API, dan tidak masuk paket/rekomendasi baru. Hanya tas berwarna dengan SKU/harga/mapping valid yang tersedia; order lama tetap memiliki snapshot aslinya. Mengirim ID SKU putih langsung ditolak server.

### Autentikasi dan akses
- **AC-A01:** Email sementara valid dapat mendaftar dan login tanpa verifikasi email. Email kapital sama dianggap satu akun. Password tidak pernah tersimpan plaintext atau dikembalikan API.
- **AC-A02:** Tanpa login, `/orders`, `/profile`, `/checkout`, order detail/payment/invoice diarahkan ke login tanpa data privat; API terkait 401. Cart/catalog tetap publik.
- **AC-A03:** Login kembali pada browser baru menemukan pesanan akun yang sama. Buyer lain mendapat 404 untuk order/invoice/payment milik orang lain; admin privilege tidak melewati ownership endpoint buyer.
- **AC-A04:** Registrasi dengan body role=admin, forged cookie/header/localStorage, atau seed email conflict tidak memberi role admin. Staff tidak bisa memakai API admin.
- **AC-A05:** Logout, sesi expired dan pencabutan menolak request berikutnya; halaman Back/tab kedua tidak menampilkan data privat tanpa validasi. Redirect login hanya path internal allowlisted.
- **AC-A06:** Seed dua akun bagian 9.2 dapat dijalankan ulang tanpa duplikasi/reset data. Akun admin login lewat operator portal; pembeli login lewat buyer portal; kredensial admin tidak ada di bundle publik.
- **AC-A07:** Login salah dibatasi server, error tidak membocorkan keberadaan email, mutasi lintas Origin/CSRF salah ditolak; data lama tidak otomatis diambil berdasarkan kecocokan email.

### Transaksi dan pelacakan
- **AC-J01:** Satu buyer dapat menuntaskan homepage, fakultas, paket/detail/customize, cart, login, checkout, payment check, invoice dan order tracking; tanpa langkah manual DB.
- **AC-J02:** Checkout wajib pickup; kurir terlihat nonaktif `Segera tersedia`. Tidak ada form alamat kirim, ongkir atau booking palsu.
- **AC-J03:** Double submit, cek status ganda, READY/complete ganda menghasilkan satu order, satu invoice, satu konsumsi stok dan audit transisi yang tidak terduplikasi.
- **AC-J04:** Order expired tidak menjadi PAID; stok dilepas. SKU terakhir diperebutkan dua buyer hanya satu berhasil; kegagalan komponen paket rollback seluruh cart/order.
- **AC-J05:** Nama/kontak/fakultas/komponen/harga/pickup order lama tetap sama setelah profil atau katalog diedit.
- **AC-J06:** Buyer melihat UNFULFILLED, READY, PICKED_UP setelah perubahan tim dan refresh/refocus. Timestamp berasal server; tidak ada sukses atau pengiriman email palsu.
- **AC-J07:** Invoice hanya pemilik order PAID; pesan `Dokumen percobaan, bukan bukti pembayaran sah.` tetap terlihat pada cetak. Payment page tidak memuat rekening/QR bayar nyata.

### Admin dan operasi
- **AC-D01:** Akun admin seed bisa membuka dashboard, staff hanya workspace operasional, buyer/public tidak memperoleh HTML/data admin melalui direct URL/API atau path ternormalisasi.
- **AC-D02:** Ringkasan menghitung >50 order dan batas hari WIB; created_at/paid_at dijelaskan; empty state nol bukan data contoh tersembunyi.
- **AC-D03:** Admin dapat create/edit/nonactivate produk/varian dan draft/publish paket beserta mapping/harga; config incomplete, harga invalid, atau stock_on_hand < reserved ditolak.
- **AC-D04:** Tim hanya dapat READY untuk PAID+UNFULFILLED dan PICKED_UP untuk PAID+READY; konfirmasi tampil dan bisa dibatalkan dengan keyboard; tidak mengubah status pembayaran lewat dropdown bebas.
- **AC-D05:** Pengaturan pickup/pause checkout berfungsi; snapshot lama tidak berubah. Revocation operator dan audit dapat diverifikasi tanpa menampilkan password/token.

### Ketahanan dan rilis
- **AC-R01:** URL publik HTTPS, seluruh link/button utama berfungsi; tidak ada secret/seed admin bocor; Worker guards diuji pada routing Static Assets sebenarnya. Deployment memerlukan izin pemilik terpisah.
- **AC-R02:** Skenario video maksimal 7 menit menunjukkan satu journey lengkap dan hasil akhir, menyebut manfaat paket/fakultas, serta menjelaskan bahwa pembayaran tidak menagih uang. Rekaman final disediakan pemilik/tim, bukan diklaim dibuat otomatis.
- **AC-R03:** Mobile 360px dan desktop, zoom 200%, keyboard/focus/dialog, kontras, loading/empty/error/retry lulus checklist manual; kegagalan koneksi tidak membuat order/sukses palsu.
- **AC-R04:** Test backend/frontend, typecheck dan build lulus; migration/seed rerun aman; staging D1 menguji atomicity/concurrency sebelum klaim rilis publik terverifikasi.

## 14. Tahapan pekerjaan untuk rencana implementasi berikutnya

1. Selaraskan kontrak; inventaris data produk/fakultas dan qualification autentikasi Workers+D1. Jangan pilih dependency atau membuat harga baru diam-diam.
2. Akun persisten dan role server, seed akun presentasi, migrasi ownership tanpa mengklaim legacy order.
3. Katalog paket-first, mapping fakultas, quote/stock dan customizer; snapshot transaksi.
4. Login-gated journey buyer, pembayaran percobaan jujur, tracking lintas login, About Us/Contact Us.
5. Dashboard admin lengkap, CRUD tervalidasi, operasional tim dan audit.
6. Regression test, pemeriksaan mobile/aksesibilitas, staging dan publikasi dengan izin, checklist rekaman video.

Ini roadmap desain, bukan pengganti rencana TDD file-per-file. Sesudah approval, tulis plan dengan interface, test gagal/lulus, file exact dan acceptance mapping setiap task. Scope dapat ditambah melalui revisi spesifikasi tanpa menandai yang belum dibuat sebagai selesai.

## 15. Batas kesiapan dan data yang masih dibutuhkan

- **Foto baru:** generation tetap ditunda. `updatekatalog.pdf` menjadi sumber gambar terbaru, `katalog.pdf` referensi versi sebelumnya; implementasi nanti mengekstrak master sesuai bagian 7.3. Sumber terlalu kecil perlu pengganti atau batas ukuran tampil, bukan upscale.
- **Paket baru:** komposisi dan harga final tiap paket/fakultas belum disahkan. Draft dapat dirancang; publish paket tersebut tertahan sampai data disetujui.
- **Notebook/totebag:** katalog terbaru memisahkan keduanya; konflik lama terselesaikan oleh sumber terbaru. Label totebag `FEG` masih perlu konfirmasi sebelum dipetakan untuk penjualan. Goodie bag putih/natural dikecualikan; SKU tas warna-warni, harga dan mapping paket pengganti tetap perlu divalidasi.
- **Prodi/aturan resmi:** hanya data tersedia; tidak mengarang kewajiban per prodi. Tidak perlu memblokir belanja berbasis fakultas jika prodi belum didata.
- **Pickup point/jam:** periksa dengan pemilik sebelum publikasi transaksi; alamat Contact Us bukan persetujuan otomatis lokasi pickup.
- **Auth dependency:** perlu qualification dan persetujuan sebelum implementasi, tanpa biaya/vendor baru secara diam-diam.
- **Domain/Cloudflare/deploy:** izin dan binding staging tetap diperlukan. Public URL adalah deliverable yang belum terpenuhi hanya dengan localhost.
- **Recovery/email/MFA/kurir/QR/gateway:** di luar tahap ini, tidak ditampilkan seolah aktif.

## 16. Cek cakupan mandiri

- Semua minimum website dosen dipetakan ke bagian 2, 6 dan AC-C01/C02/R01.
- Seluruh cabang board dipetakan pada bagian 5; kurir/email/QR ditunda secara eksplisit, bukan dilupakan.
- Keputusan akun, paket-fakultas, pembayaran percobaan, dashboard, seed, kontak dan penundaan foto tercakup.
- Lima risiko utama untuk test plan: kepemilikan lintas login/legacy; konfigurasi beda fakultas; double submit dan SKU terakhir; sesi revoked/cache Back; sumber/harga/mapping belum lengkap. Masing-masing dipin ke AC-A03/A05/A07, C06/C07, J03/J04, C02/D03.
- Dokumen tidak menyatakan fitur v2 sudah ada, data sumber resmi, foto sudah dibuat, atau website sudah dipublikasikan.
