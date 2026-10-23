# MabaKit Customer and Team Experience Design

Status: disetujui pemilik dan diimplementasikan untuk demo pada 2026-10-22; deployment produksi belum diizinkan.

## Intent

Maba UNJ dapat menyiapkan kebutuhan ospek tanpa panik, membeli perlengkapan, lalu mengetahui proses pesanan. Tim MabaKit dapat memantau penjualan dan menyelesaikan pesanan sampai barang diterima. Demo terasa utuh, bukan kumpulan layar yang tidak terhubung.

## Keputusan pengguna

- Demo terhubung pada Worker + D1 yang sudah ada, bukan prototipe local-only.
- Beranda sebelum katalog, gambar produk featured bergeser, value proposition kebutuhan ospek lebih mudah.
- Profil pembeli sederhana: nama, WhatsApp, email; halaman progres pesanan.
- Dashboard tim: penjualan, pesanan masuk, proses operasional dan shortcut WhatsApp per pesanan.
- `/team` beserta seluruh turunannya bukan halaman publik. Hanya admin dan anggota tim MabaKit yang telah diverifikasi server boleh mengakses workspace dan API operasionalnya. Sesi pembeli tidak memberi akses tim.
- Invoice email disimulasikan; kurangi label demo yang berulang.
- QR ditunda seluruhnya. Ulasan setelah pesanan diterima.
- Filter antislop during untuk perencanaan dan implementasi.

## Approaches

1. Demo terhubung dengan React/Worker/D1: dipilih pengguna karena perubahan tim harus terlihat pada pembeli dan proses bisnis bisa dicoba utuh.
2. Prototipe data lokal: lebih cepat untuk tampilan, ditolak karena tidak menunjukkan alur pembeli dan tim bersama.

## Usulan tampilan

### Beranda `/`

Header MabaKit, Katalog, Pesanan saya, Profil, Keranjang. Navigasi publik tidak menampilkan pintu workspace tim. Tautan workspace hanya muncul setelah server mengonfirmasi role operator; menyembunyikan tautan bukan kontrol keamanan. Hero: “Perlengkapan ospek beres. Maba UNJ nggak perlu panik.” CTA utama “Lihat perlengkapan”, sekunder “Cek pesanan”. Hindari janji semua persyaratan fakultas pasti terpenuhi tanpa data resmi.

Featured carousel menggunakan foto produk asli yang tersedia: topi fakultas, kipas, goodie bag dan perlengkapan lain. Tampilkan nama, harga dari API dan tautan detail. Carousel bukan klaim best seller. Kontrol sebelumnya/berikutnya/jeda, interval 6 detik, berhenti pada hover/fokus, tanpa autoplay pada reduced motion. Tidak ada animasi parallax atau gambar dekoratif baru.

Berikutnya: value proposition memilih varian fakultas, membeli perlengkapan dalam satu tempat, dan memantau proses sampai siap diambil; cara beli tiga langkah; contoh ulasan berlabel; CTA katalog. Tidak menampilkan angka pelanggan/penjualan rekaan atau logo afiliasi resmi.

Katalog pindah ke `/catalog`; detail produk dan keranjang tetap dipakai.

### Pembeli

`/profile`: nama, WhatsApp, email, simpan perubahan. Data menjadi default checkout, bukan pengganti snapshot order lama. `/orders`: ringkasan pesanan dan status. `/orders/:id`: rincian barang, timeline, instruksi ambil, invoice dan ulasan saat eligible.

Checkout tidak meminta nama pemesan dan penerima terpisah. Pengambilan diwakilkan tidak termasuk tahap ini. Email dan nomor tervalidasi, data fiktif dianjurkan pada titik pengisian kontak dalam sesi percobaan.

Timeline: Menunggu pembayaran; Sedang disiapkan; Siap diambil; Sudah diterima. Pesanan kedaluwarsa ditampilkan sebagai berakhir, bukan sukses. Gunakan refresh manual dan refetch saat kembali ke tab. Tidak mengklaim real-time push.

Invoice tersedia setelah pembayaran simulasi. Preview email memakai email snapshot, subject dan invoice yang sama, jelas menyatakan tidak ada email dikirim. Tidak ada status delivered palsu.

### Tim

Workspace privat: `/team`, `/team/orders`, `/team/orders/:id` dan seluruh route turunannya hanya tersedia untuk operator aktif dengan role `admin` atau `staff`. `staff` berarti anggota tim MabaKit yang diberi akses oleh pengelola, bukan semua pembeli yang memiliki sesi. Pemeriksaan akses wajib selesai di server sebelum HTML workspace dikirim atau data operasional dimuat; tidak boleh ada kilasan dashboard atau kontak pelanggan sebelum otorisasi selesai.

Pintu login terpisah di `/operator/login`, bukan halaman dashboard publik pada `/team`. GET/HEAD halaman tim tanpa sesi valid diarahkan ke login tanpa data privat; sesi pembeli tanpa hak operator menerima 403 dan pesan akses terbatas. Login gagal tidak mengungkap apakah kode/anggota tertentu terdaftar. Setelah login berhasil, tujuan kembali hanya path internal yang diizinkan dalam workspace, bukan URL bebas. Halaman login yang dapat dibuka publik tidak memberi akses ke workspace.

`/team`: ringkasan nilai penjualan dibayar, jumlah transaksi dibayar, menunggu pembayaran, disiapkan, siap diambil, selesai. Pilihan hari ini/7 hari/30 hari/semua; batas tanggal WIB. Nilai penjualan bukan profit dan berlabel simulasi.

`/team/orders`: filter pembayaran dan pengerjaan, pagination, akses detail. `/team/orders/:id`: kontak, item/varian/komponen paket, pembayaran, instruksi ambil, timestamp dan tindakan yang sah. Pembayaran tetap simulasi milik alur yang ada, bukan dropdown bebas untuk tim.

Tindakan: tandai siap hanya untuk PAID+UNFULFILLED; konfirmasi barang diterima hanya untuk PAID+READY dengan dialog pemeriksaan. Tidak memerlukan QR atau token dari pembeli. Audit merekam operator dan waktu; pengulangan tidak menggandakan efek.

Shortcut WhatsApp menampilkan tujuan dan draft berdasarkan status. Buka chat dilakukan manual; tidak mengirim otomatis, tidak mengubah status, dan menyediakan salin pesan. Fixture tidak mengarah ke nomor orang nyata.

Stok tetap melalui izin admin yang sudah ada; staff fokus pesanan dan penjualan. Jangan memberi seluruh hak admin hanya karena membuka workspace tim.

| Aktor | Halaman dan API tim | Pengaturan/katalog/stok/audit admin |
| --- | --- | --- |
| Publik tanpa sesi | Ditolak | Ditolak |
| Pembeli dengan sesi valid | Ditolak | Ditolak |
| Tim MabaKit, role `staff` aktif | Diizinkan untuk penjualan dan operasional pesanan | Ditolak |
| Role `admin` aktif | Diizinkan | Diizinkan |
| Operator kedaluwarsa atau dicabut | Ditolak | Ditolak |

Role dibaca dari record operator server pada setiap request. Role di body, query, header buatan browser atau localStorage tidak pernah menjadi bukti izin. Admin tetap dapat masuk ke workspace tim tanpa menurunkan role menjadi `staff`.

## Data dan akses: proposal teknis

Identitas pembeli tetap sesi demo satu hari, bukan akun permanen atau login lintas perangkat. Profil session-owned di D1. Workspace berbeda tidak membuat sesi pembeli baru. Seed katalog tetap; fixture pesanan dan profil dibuat lewat setup lokal idempotent tanpa menghapus data.

### Batas keamanan workspace

- Demo tetap menggunakan verifikasi kode operator server yang sudah ada, bukan registrasi tim mandiri. Pengelola memberi kode role yang sesuai hanya kepada admin/tim MabaKit. Kode berasal dari Worker Secrets, tidak disertakan dalam bundle frontend, `VITE_*`, fixture, dokumentasi publik atau response API. Kode tidak boleh tersimpan pada URL, log atau localStorage. Ini kredensial bersama untuk demo, bukan identitas anggota individual dan bukan autentikasi produksi.
- Login memerlukan sesi valid serta pemeriksaan Origin dan CSRF. Batasi percobaan berdasarkan sumber server yang tidak dapat direset hanya dengan membuat sesi pembeli baru, disertai batas per sesi. Kegagalan verifikasi atau secret yang belum dikonfigurasi harus menolak akses. Client tidak boleh memilih role tanpa membuktikan kode untuk role tersebut.
- Sesi operator mengikuti sesi server: token opaque pada cookie HttpOnly, Secure pada HTTPS, SameSite; hanya hash token disimpan. Setelah login operator atau kenaikan hak berhasil, rotasi token sesi dan CSRF serta invalidasi token lama di server. Pertahankan kepemilikan profil/order melalui relasi sesi server yang sama, tanpa membuat identitas pembeli baru. Masa berlaku maksimal satu hari dan tidak melebihi sesi pembeli semula. Sesi pembeli tanpa record operator aktif tetap tidak berhak mengakses tim.
- Logout operator mencabut record/hak operator di server, bukan hanya menyembunyikan UI atau menghapus state browser. Pengelola harus dapat mencabut akses sesi operator untuk demo. Request berikutnya, termasuk dari tab lain, harus ditolak setelah logout, pencabutan atau expiry. Rotasi kode harus disertai pencabutan sesi operator terdampak; mengganti secret saja tidak mencabut sesi yang sudah aktif.
- Worker memeriksa sesi dan role sebelum meneruskan request halaman tim ke Static Assets. Konfigurasi saat ini hanya menjalankan Worker lebih dahulu untuk `/api/*`; implementasi wajib menambahkan `/team` dan `/team/*` serta jalur operator lama yang masih aktif agar SPA fallback, direct URL, reload, trailing slash dan deep link tidak melewati guard. `/staff`, `/admin` dan turunannya tidak boleh menjadi pintu alternatif tanpa pemeriksaan; hapus atau lindungi dengan role yang sesuai sebelum redirect ke workspace baru. Path setara setelah normalisasi juga harus melewati guard.
- Setiap endpoint data/tindakan tim menerapkan guard server yang sama, termasuk `/api/staff/*`, endpoint `/api/team/*` bila ditambahkan, dan endpoint ringkasan penjualan. `/api/admin/*` tetap khusus `admin`. API mengembalikan 401 untuk sesi hilang/tidak valid/kedaluwarsa dan 403 untuk sesi valid tanpa role yang diizinkan, bukan redirect HTML. Endpoint tidak dikenal tetap 404 tanpa data privat. Semua mutasi wajib memeriksa Origin, CSRF dan transisi status setelah otorisasi.
- Halaman privat, response autentikasi dan API operasional memakai `Cache-Control: no-store`; CDN, browser cache dan service worker tidak boleh menyimpan response privat. Setelah logout, UI menghapus data tim dari state dan tidak memulihkannya lewat navigasi kembali tanpa verifikasi server. Error/log tidak memuat kode, cookie, token atau kontak pelanggan.
- Bundle JavaScript dan aset visual umum boleh tetap publik, tetapi tidak berisi secret, fixture pesanan privat atau data pelanggan. `noindex` dan tidak adanya tautan publik hanya mengurangi penemuan, bukan bukti perlindungan akses.

### Batas jaminan demo

Perubahan ini menetapkan otorisasi privat untuk demo Worker+D1. Belum ada akun anggota individual, MFA atau atribusi personal yang terverifikasi. Audit demo mencatat ID sesi operator dan role, tidak mengklaim identitas orang dari kode bersama. Deployment publik atau pemakaian data pelanggan nyata memerlukan desain autentikasi produksi dan persetujuan terpisah; tidak dianggap aman untuk produksi hanya karena `/team` dilindungi.

### Snapshot order dan ulasan

Email disimpan sebagai snapshot baru pada order; recipient_name internal dapat tetap sama dengan buyerName agar migrasi tidak merusak order lama. Status lama dipertahankan: PENDING/PAID/EXPIRED dan UNFULFILLED/READY/PICKED_UP/CANCELLED. Tidak menambah PROCESSING karena PAID+UNFULFILLED sudah mewakili persiapan.

Ulasan tingkat pesanan, bukan tiap produk: satu ulasan per order PAID+PICKED_UP; rating integer 1–5, komentar 10–1000 karakter, belum ada edit/hapus. Publik hanya nama depan, rating, komentar, waktu, label percobaan. Data kontak tidak masuk feed. Contoh ulasan menggunakan nama fiktif dan label “Contoh ulasan”; tidak menyebutnya testimoni jujur pelanggan nyata.

## Constraints dan non-goals

Tidak ada QR/scanner, pemesanan slot, pengiriman barang, pembatalan/refund baru, gateway, email nyata, WhatsApp otomatis, production auth, keuntungan/laba, klaim resmi UNJ atau deployment. D01–D08 produksi tetap terblokir. Tidak menambah library bila native/platform/dependency yang ada cukup.

Label tidak diulang di setiap bagian, tetapi pembayaran, invoice, preview email, metrik penjualan dan ulasan fiktif tetap transparan. Kontrak lama yang mewajibkan watermark simulasi tidak diam-diam dihapus; perubahan harus tercermin di PRD/SCHEMA/DESIGN/RELEASE.

## Acceptance

Pembeli mengisi profil, checkout, membayar simulasi dan melihat invoice; tim melihat order yang sama, menandai siap dan selesai; pembeli refresh, melihat progres dan mengirim satu ulasan. Pembeli tidak dapat mengakses order/profil pengguna lain melalui endpoint pembeli. Operator berizin dapat membaca snapshot order lintas pembeli hanya melalui endpoint operasional yang dilindungi; izin ini bukan akses bebas ke profil pembeli. Pendapatan dihitung seluruh order terbayar, bukan 50 order terakhir. Pengulangan pembayaran/penyerahan tidak menggandakan stok, invoice atau audit. Keyboard, layar 360px, zoom 200%, reduced motion serta loading/empty/error/retry berfungsi.

### Acceptance akses privat (wajib sebelum dinyatakan selesai)

1. Tanpa cookie, request langsung GET/HEAD ke `/team`, `/team/`, `/team/orders` dan `/team/orders/:id` diarahkan ke `/operator/login` tanpa HTML/data dashboard. URL tebakan, reload dan navigasi client tidak membuka workspace.
2. Sesi pembeli valid tanpa operator menerima 403 pada halaman tim. Request API tim tanpa sesi valid menerima 401; sesi pembeli menerima 403. Response tidak membocorkan jumlah penjualan, daftar order, kontak atau detail order.
3. Login dengan kode tidak valid, role hasil manipulasi atau secret kosong gagal. Membuat sesi baru tidak melewati pembatasan percobaan berbasis sumber. Login/kenaikan hak berhasil merotasi token sesi dan CSRF; token lama tidak dapat mengakses workspace/API, sedangkan profil/order pembeli tetap dimiliki sesi yang benar. Tidak ada kode operator pada bundle, response, URL atau log.
4. Operator `staff` dan `admin` aktif dapat membuka dashboard dan snapshot order lintas pembeli melalui API operasional, tanpa akses bebas ke profil. Endpoint pembeli tetap membatasi ownership meskipun sesi memiliki role operator. `staff` tetap menerima 403 pada seluruh API admin dan halaman admin, termasuk ketika request dibuat langsung tanpa UI.
5. Setelah logout, pencabutan atau expiry, request halaman/API selanjutnya ditolak, termasuk dari tab kedua. Tombol Back tidak menampilkan ulang data tim tanpa verifikasi. Rotasi kode disertai pencabutan sesi lama yang terdampak.
6. Jalur lama `/staff`, `/admin` beserta turunannya, variasi slash/path ternormalisasi dan SPA fallback tidak dapat melewati pemeriksaan. Deployment preview/staging Cloudflare menguji routing Static Assets sebenarnya, bukan hanya mock route React.
7. Response privat memakai `Cache-Control: no-store`. Dua browser dengan role berbeda tidak menerima response privat satu sama lain dari cache. Mutasi tanpa Origin/CSRF yang sah ditolak tanpa perubahan status/stok/audit.
8. Bukti pengujian mencakup guard Worker, role API, login/logout/revocation dan alur browser anonim/pembeli/staff/admin. Sampai bukti tersedia, dokumen ini adalah persyaratan, bukan klaim bahwa implementasi sudah terlindungi.

## Yang perlu dikonfirmasi saat review

Kewajiban workspace tim tidak publik dan hanya untuk admin/tim MabaKit berasal dari pengguna. Detail mekanisme kode demo, lokasi `/operator/login`, redirect/403, pencabutan sesi dan perlindungan cache adalah proposal teknis penyusun, belum persetujuan autentikasi produksi.

Usulan identitas berbasis sesi, range metrik WIB, ulasan per pesanan, konfirmasi manual penerimaan, fixture tanpa kontak nyata, dan hak stok admin saja adalah pilihan teknis penyusun, bukan keputusan pengguna yang sudah disetujui. Review dokumen sebelum implementasi.
