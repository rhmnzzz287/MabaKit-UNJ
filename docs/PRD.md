# Product Requirements Document: MabaKit

Revisi: 22 Oktober 2026. Baseline usulan rilis pertama; persetujuan scope mengikuti [BRD.md](BRD.md). Kontrak data: [SCHEMA.md](SCHEMA.md).

## 1. Batas produk

Website toko perlengkapan PKKMB untuk mahasiswa baru UNJ, wali dan koordinator. Tujuannya memperjelas spesifikasi/harga, memudahkan pembelian barang satuan atau paket, serta melacak pesanan sampai diserahkan. MabaKit menjual stok sendiri, bukan marketplace. Rilis pertama memakai React + TypeScript + Vite, Supabase, Midtrans Snap, dengan pengambilan barang saja. Tidak ada layanan resmi kampus yang diklaim tanpa bukti.

Booking dan reservasi tidak masuk produk atau roadmap: tanpa kalender, pilihan slot, kuota kunjungan, booking fee atau reschedule. Pengambilan mengikuti lokasi/jam layanan toko setelah pesanan READY; pelanggan tidak memesan waktu. Alokasi stok selama pembayaran diproses adalah mekanisme internal transaksi belanja, bukan reservasi pelanggan.

Tertunda: kurir, kustomisasi teks berbayar, diskon kuantitas otomatis, paket builder khusus, cloud cart, Realtime, WhatsApp/PDF otomatis, QR kamera. Kebutuhan sumber tetap masuk roadmap BRD. Kode pengambilan dalam web menjadi jalur utama tanpa ketergantungan pesan eksternal.

## 2. Alur dan kebutuhan fungsional

| ID | Kebutuhan dan acceptance criteria |
|---|---|
| FR01 | Katalog publik hanya menampilkan produk aktif, foto berizin, spesifikasi, varian, harga IDR, dan komponen paket. Filter fakultas/prodi opsional. Checklist hanya tampil bila sumber, tahun dan tanggal verifikasi tersedia; labelnya “Panduan berdasarkan sumber”, bukan jaminan resmi. |
| FR02 | Varian adalah SKU stok. Paket tetap berisi SKU tertentu beserta jumlahnya, tanpa paket di dalam paket. Isi tidak dapat diedit pembeli; pilih item satuan untuk kombinasi lain. Paket tersedia hanya jika seluruh komponen tersedia. |
| FR03 | Keranjang disimpan lokal tanpa data pribadi/token rahasia. Tidak mengunci stok. Data lokal rusak direset dengan pemberitahuan. Harga dan stok divalidasi ulang saat checkout; perubahan harga/isi paket menghasilkan 409 dan mengharuskan persetujuan ulang, bukan debit diam-diam. |
| FR04 | Login Supabase email OTP saat checkout. SMTP produksi, batas kirim/verifikasi, masa berlaku dan redirect allowlist dikonfigurasi. Pesan tidak mengungkap keberadaan akun. Tidak perlu email kampus/NIM wajib. Admin wajib MFA. |
| FR05 | Data checkout: nama pembeli, nama penerima dan nomor kontak Indonesia. Informasi lokasi/jam pengambilan ditampilkan untuk diperiksa, bukan dipilih sebagai jadwal. Nama 1-100 karakter setelah trim; telepon `08`, `628`, atau `+628` dinormalisasi ke `+628` diikuti 8-11 digit. Format valid bukan bukti WhatsApp aktif. Fakultas/prodi opsional dan pasangan harus cocok; NIM tidak dikumpulkan di rilis pertama. |
| FR06 | Maksimum 20 baris unik, quantity integer 1-99 per baris, maksimum total Rp10.000.000 per order. Batas ini keputusan teknis pilot, dapat ditinjau setelah uji. Validasi juga di server. Tolak SKU nonaktif, input asing, pecahan, negatif, komposisi kosong atau checkout yang sedang ditutup. |
| FR07 | `create-payment` menghitung total dari DB, membuat snapshot barang/instruksi pengambilan dan mengalokasikan stok komponen sementara dalam transaksi. Retry memakai idempotency key sama; tidak menambah alokasi atau tagihan. Detail kontrak ada di SCHEMA. |
| FR08 | Midtrans Snap membuka UI resmi provider. Hanya channel yang diaktifkan merchant dan terbukti mendukung kebijakan expiry ditawarkan. Tidak menjanjikan semua bank/e-wallet. Browser callback hanya memicu refresh status server, tidak menandai lunas. |
| FR09 | Pembeli melihat detail order miliknya, jumlah, status, instruksi, deadline, dan kode pickup setelah `READY`. Pembayaran lunas menampilkan “Pembayaran diterima. Pesanan sedang disiapkan.” Tidak menampilkan “siap diambil” sebelum staf menandai siap. |
| FR10 | Staf melihat pesanan operasional yang diperlukan, snapshot komponen, nama penerima dan status penyiapan. Staf menandai `READY`, mencari kode melalui endpoint terproteksi, lalu konfirmasi penyerahan. Dua staf bersamaan hanya dapat menyerahkan sekali. Kode tidak menjadi akses publik ke detail pelanggan. |
| FR11 | Admin mengelola katalog, stok, informasi pengambilan, review pembayaran dan catatan refund; setiap perubahan sensitif diaudit. Produk yang sudah dipakai dinonaktifkan, bukan dihapus. Tidak ada tombol “set lunas” manual yang melewati verifikasi gateway. |
| FR12 | Checkout dapat dihentikan operator tanpa mematikan akses pesanan, webhook, rekonsiliasi, atau pickup. Kebijakan privasi, ketentuan, kontak dan jam bantuan yang sudah disetujui tersedia sebelum pengumpulan data/pembayaran. |

## 3. Uang dan snapshot

Harga final SKU dan harga paket adalah integer rupiah positif. Harga SKU mencakup atribut varian; tidak ada penambahan surcharge tersembunyi. Paket memiliki harga tetap; tidak ada diskon tambahan. Subtotal = jumlah `unit_price_rp × quantity`; total = subtotal, pickup Rp0, biaya gateway ditanggung toko. Jangan memakai float untuk uang.

Contoh uji **SIMULASI**, bukan harga jual: SKU A Rp15.000 × 2 + paket P Rp30.000 × 1 = Rp60.000. Jika P berisi A × 1 dan B × 2, kebutuhan stok total adalah A × 3 dan B × 2. Paket tidak mengurangi stok virtual kedua kalinya. Semua total, judul, atribut, komponen dan harga disnapshot saat order dibuat. Perubahan katalog tidak mengubah pesanan lama.

## 4. Pembayaran dan konsistensi stok

### 4.1 Pembuatan

- Dua Edge Functions publik: `create-payment` (JWT terverifikasi) dan `payment-webhook` (notifikasi provider, tanpa JWT pelanggan). Keduanya memakai rahasia server; service-role key tidak masuk browser.
- Satu order memakai satu `gateway_order_id` dan satu usaha pembayaran. Tombol coba lagi membuka usaha sama selama masih berlaku; order baru hanya setelah order lama terminal dan alokasi stok dilepas.
- DB menetapkan `expires_at = created_at + 30 menit`. Midtrans dikonfigurasi deadline setara pada channel yang dipakai dan diverifikasi sandbox. Bila channel tidak dapat memenuhi kontrak, jangan aktifkan channel tersebut.
- Order dan alokasi stok dibuat sebelum permintaan Snap. Jangan membuka transaksi DB selama panggilan jaringan. Jika provider berhasil tetapi penyimpanan token gagal, retry/reconcile memakai identitas sama; jangan membuat transaksi kedua. Token hanya dikembalikan kepada pemilik order.
- Jika hasil pembuatan ambigu, tampilkan “Status pembayaran sedang diperiksa”. Alokasi stok tetap ditahan sampai server memperoleh status definitif. Setelah ketidakpastian 5 menit, buat alarm; jangan melepaskan stok hanya karena request timeout.

### 4.2 Webhook dan sumber otoritas

Midtrans signature tepat:

`SHA512(order_id + status_code + gross_amount + ServerKey)`

Urutan string persis dari payload, tanpa separator; bukan HMAC, bukan key-first. Bandingkan digest constant-time. Signature bukan satu-satunya pemeriksaan: panggil Status API Midtrans melalui server, cocokkan merchant/environment, `order_id`, `transaction_id` yang terikat, currency IDR, dan jumlah persis terhadap DB. Parse gross amount sebagai desimal eksak (`60000.00` = Rp60.000), tolak jumlah pecahan rupiah atau mismatch. Jangan memakai total dari browser.

Kontrak provider harus dicocokkan lagi dengan dokumentasi resmi saat implementasi: https://docs.midtrans.com/ bagian Snap, HTTP notifications, transaction status dan expiry. Sandbox membuktikan mapping channel yang benar; dokumen ini bukan bukti aktivasi merchant.

| Hasil server terverifikasi | Perilaku |
|---|---|
| `pending` | Tetap menunggu; jangan turunkan status yang sudah lunas |
| `settlement` | Lunas jika jumlah/referensi cocok |
| `capture` + `fraud_status=accept` | Lunas; channel kartu tidak diaktifkan rilis awal |
| `capture` dengan challenge/deny atau status tidak dikenal | `REVIEW`, tidak boleh fulfillment otomatis |
| `deny`, `cancel`, `expire`, atau `failure` | Gagal/expired hanya bila belum lunas dan status provider definitif; lepaskan alokasi stok sekali |
| Refund/chargeback/status finansial lain | Review operator; catat fakta provider, jangan otomatis memulihkan stok atau menghapus jejak pembayaran |

Webhook duplikat yang valid adalah sukses idempotent (HTTP 200), bukan ditolak sebagai kesalahan. Payload invalid ditolak (400/403); gangguan provider/DB menghasilkan respons retryable (503). Gateway reference tidak dikenal tidak membuat order baru; log aman dan alarm. Transaksi DB dan status guard mencegah efek kedua. Jangan menyimpan payload mentah berisi data finansial/PII ke log.

### 4.3 Expiry, urutan event, dan late payment

Scheduled worker satu menit merekonsiliasi order pending, creation ambigu, dan review yang belum selesai, maksimal 50 per batch terurut tertua dengan lease dan retry backoff 1, 2, 5, lalu 15 menit. Bukan polling browser yang melepaskan stok. Timer browser hanya informasi.

Saat melewati deadline: query provider; jika pending, minta expiry/cancel yang sesuai channel lalu periksa ulang. Lepaskan hanya setelah status nonpaid definitif. Status API tidak tersedia atau masih ambigu: tahan alokasi stok, alarm, retry. Not-found setelah request timeout tidak langsung dianggap gagal; pastikan tidak ada transaksi terlambat lewat rekonsiliasi provider sebelum operator menutup kasus.

Settlement setelah alokasi stok dilepas menghasilkan pembayaran `REVIEW` dan fulfillment `CANCELLED`, bukan otomatis `PAID`/`READY`. Operator menyetujui solusi atau refund. Pembayaran tidak boleh menghidupkan stok yang sudah dipakai order lain. Notifikasi pending/expire terlambat tidak membatalkan order `PAID` atau `PICKED_UP`.

### 4.4 Refund

Rilis pertama memakai proses manual di dashboard Midtrans atau kanal merchant yang disetujui. Admin mencatat alasan, jumlah, referensi, waktu dan bukti hasil; tombol pencatatan tidak mengklaim uang sudah dikembalikan. Refund penuh yang dikonfirmasi menjadi `REFUNDED`; refund parsial tidak didukung otomatis. Jangan melepaskan stok setelah barang diserahkan. Retur fisik dihitung dan dicatat sebagai penyesuaian stok tersendiri.

## 5. Status bersama

| Dimensi | Nilai | Transisi normal |
|---|---|---|
| `payment_status` | `PENDING`, `PAID`, `FAILED`, `EXPIRED`, `REVIEW`, `REFUNDED` | `PENDING` menjadi paid/gagal/expired/review; paid menjadi refunded melalui bukti refund atau review saat sengketa |
| `fulfillment_status` | `UNFULFILLED`, `READY`, `PICKED_UP`, `CANCELLED` | unfulfilled menjadi ready hanya jika paid; ready menjadi picked_up atomik; nonpaid terminal menjadi cancelled |
| `stock_allocation_status` | `HELD`, `CONSUMED`, `RELEASED` | held menjadi consumed saat paid, atau released saat nonpaid definitif; tidak pernah kembali held |

Penerimaan pembayaran mengonsumsi alokasi stok secara atomik. Stok fisik berkurang saat konsumsi, bukan saat pickup. Pickup tidak mengurangi stok lagi. Instruksi lokasi/jam pengambilan disnapshot dari pengaturan toko; tidak ada jadwal atau kapasitas yang dipesan. Jika pemenuhan tidak memungkinkan, operator menghubungi pembeli untuk penyelesaian/refund sesuai kebijakan dan persetujuan pembeli. Refund lewat operasi admin teraudit, bukan edit langsung. Riwayat PICKED_UP tetap dipertahankan setelah refund/sengketa; syarat PAID berlaku saat klaim, bukan menghapus sejarah penyerahan. Detail SCHEMA.

## 6. Kualitas, privasi, dan verifikasi

- Semua tabel terekspos memiliki RLS dan grants minimum. Role akun terpisah dari profil; pelanggan tidak dapat menulis role/status/harga/stock. Server tetap memeriksa aktor meskipun memakai service-role.
- Token sesi ditangani SDK; cegah XSS lewat rendering teks, CSP sesuai Snap, tanpa HTML mentah. Semua endpoint HTTPS, body dibatasi 32 KB dan input allowlist; rate limit checkout 5 request/menit/user dan pencarian pickup 30/menit/staf di server. Retry idempotent tetap dibatasi tanpa membuat efek baru.
- Timeout HTTP provider 10 detik; kegagalan tidak menghapus order. Respons UI memuat retry atau kontak bantuan, bukan status lunas palsu.
- Poll detail order pending setiap 10 detik hanya ketika halaman terlihat; berhenti saat terminal. Tanpa Realtime. Webhook dan worker tetap otoritas.
- Target uji, bukan klaim hasil: katalog LCP ≤2,5 detik dan CLS ≤0,1 pada profil mobile 4G terdefinisi; checkout server p95 ≤2 detik tidak termasuk provider. Pilot uji 20 checkout serentak dengan invariant benar, bukan jaminan kapasitas Supabase.
- UI 360px sampai desktop, zoom 200%, target sentuh 48×48px, WCAG AA, navigasi keyboard, status diumumkan pembaca layar, reduced motion. Bukti RELEASE belum tersedia.
- Data minimal, log teredaksi, akses staf dibatasi kebutuhan. Jangka simpan konkret disahkan D06 sebelum produksi; penghapusan akun tidak menghapus catatan finansial yang wajib disimpan. Backup dan salinan data masuk kebijakan retensi.

## 7. Uji wajib sebelum rilis

Test transaksi nyata PostgreSQL dan integrasi sandbox, bukan mock saja. Bukti serta matriks kasus di [RELEASE.md](RELEASE.md): manipulasi harga/role, balapan SKU terakhir, komponen paket bersama, retry checkout, provider timeout, signature/amount salah, duplikat/out-of-order/late settlement, scheduler mati, penyerahan ganda, refund dan akses lintas akun.
