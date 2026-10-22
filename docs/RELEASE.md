# Gerbang implementasi dan produksi MabaKit

Revisi: 22 Oktober 2026. Semua butir awal **BELUM DIVERIFIKASI**. Checkbox hanya dicentang setelah ada hasil nyata. Bukti memuat tanggal, environment, commit/migration, penanggung jawab, command/skenario, dan hasil; jangan menyimpan secret atau data pelanggan nyata dalam evidence publik.

Gerbang ini memverifikasi toko perlengkapan PKKMB dari pemilihan produk sampai penyerahan. Booking/reservasi bukan fitur yang akan dirilis; uji tidak mencakup kalender, pemilihan slot, kuota kunjungan atau reschedule. Pengaman alokasi stok selama pembayaran tetap wajib diuji.

## 1. Sebelum implementasi

- [ ] Pemilik menyetujui scope rilis pertama dan fitur tertunda BRD; perubahan dicatat, bukan diasumsikan.
- [ ] PRD dan SCHEMA disetujui sebagai kontrak status, harga, akses, stok, instruksi pengambilan dan gateway.
- [ ] Rencana implementasi tugas kecil disusun setelah review spesifikasi; setiap logika nontrivial memiliki runnable test.

## 2. Uji wajib database dan endpoint

Gunakan database staging nyata, JWT per role, transaksi konkuren dan fixture SIMULASI. Mock hanya pelengkap; hasil database harus diperiksa setelah setiap skenario.

| ID | Kasus | Hasil wajib |
|---|---|---|
| T01 | Anon, customer A/B, staff, admin membaca/menulis setiap tabel/view/RPC | Matriks SCHEMA terpenuhi; A tidak membaca order B; tidak ada bocor token/hash/kontak/kolom internal |
| T02 | Customer mengubah role, paid status, total, stock, refund; memanggil service-only RPC atau memalsukan actor UUID | Ditolak, data tidak berubah. Admin tanpa MFA tidak dapat aksi sensitif |
| T03 | Input qty 0/-1/1.5/100, body terlalu besar, ID asing, paket kosong/nonaktif, varian milik produk lain, total >Rp10.000.000 | 422 atau 409 sesuai kontrak, tanpa order/alokasi stok setengah jadi |
| T04 | Dua checkout bersamaan untuk SKU terakhir | Hanya satu berhasil; stock_reserved tidak negatif atau melebihi stock_on_hand |
| T05 | Satuan A×2 + paket (A×1,B×2) | Total fixture Rp60.000, reserved A×3/B×2; jika B habis, rollback alokasi A dan seluruh order juga |
| T06 | Key sama/body sama secara paralel, retry setelah timeout, key sama/body beda | Satu order/attempt/alokasi stok; hasil sama atau PROCESSING, beda body 409 |
| T07 | Admin mengubah harga/komposisi/instruksi pengambilan atau menutup checkout saat submit; expected_total/version basi | Snapshot konsisten atau 409; instruksi berubah perlu persetujuan ulang; checkout yang sudah ditutup ditolak tanpa alokasi baru |
| T08 | Produk atau informasi pengambilan berubah setelah pembelian | Harga/komponen/instruksi snapshot pesanan tidak berubah |
| T09 | PAID dua kali, release dua kali, PAID vs expiry bersamaan | Masing-masing efek counter sekali; status tidak mundur; stock_allocation_status dan counter stok sesuai |
| T10 | Staf A/B claim sama serentak, token salah, token lama setelah rotasi, refund vs claim | Satu handover; invalid ditolak; refund/claim diserialisasi; no second stock decrement |
| T11 | Refund penuh dari HELD/CONSUMED/RELEASED, refund sesudah pickup, duplicate refund, retur fisik | HELD melepaskan stock_reserved tanpa menambah on_hand; CONSUMED sebelum pickup restock sekali; RELEASED tanpa efek counter; sesudah pickup riwayat tetap dan tidak restock otomatis; evidence wajib |
| T12 | Stock adjustment di bawah stock_reserved | Ditolak, audit ada untuk perubahan sah |
| T13 | Telepon berbagai format valid/invalid, nama panjang/berisi markup, wali tanpa NIM, department asing | Normalisasi PRD; validation jelas; markup dirender teks; wali dapat checkout |
| T14 | Cart lokal rusak, double click, refresh, dua tab, server gagal setelah alokasi stok | Recovery aman; tidak ada tagihan baru tersembunyi; UI tidak menandai PAID sendiri |
| T15 | Counter rekonsiliasi berbeda dari order | Alarm, pause checkout, investigasi; bukan silent auto-fix |

## 3. Integrasi Midtrans sandbox

- [ ] M01: Merchant sandbox aktif; dokumentasi provider diperiksa dan channel terpilih mendukung deadline 30 menit. Catat channel yang benar-benar diuji, bukan daftar semua bank.
- [ ] M02: QRIS/VA/channel aktif membayar tepat jumlah, status server PAID sekali, alokasi stok CONSUMED, stock dikonsumsi, UI belum READY.
- [ ] M03: Signature salah, urutan key-first, gross amount salah/pecahan, reference atau transaction_id salah ditolak; browser callback palsu tidak berpengaruh.
- [ ] M04: Duplicate dan out-of-order pending/expire setelah settlement tidak menurunkan status; webhook valid duplicate mendapat 200.
- [ ] M05: Timeout sebelum/sesudah provider create, crash sebelum simpan Snap token dan lease kadaluarsa pulih dengan reference sama, tanpa alokasi/charge kedua. Ketidakpastian menghasilkan review dan alarm.
- [ ] M06: Expiry terjadwal memeriksa provider; release hanya nonpaid definitif. Status API offline tidak melepas stok; job restart memproses backlog dengan backoff.
- [ ] M07: Settlement setelah release menghasilkan REVIEW/CANCELLED, tidak fulfill atau mengalokasikan stok ulang. Operator dapat menuntaskan refund dengan bukti.
- [ ] M08: Fraud challenge/deny/unknown, refund/chargeback, amount/currency/environment mismatch masuk penanganan aman.
- [ ] M09: Webhook endpoint publik tetap memverifikasi signature + Status API; scheduler endpoint menolak caller tanpa secret; credentials sandbox tidak diterima sebagai production config.

## 4. UI, keamanan, dan kualitas

- [ ] U01: Seluruh route DESIGN berfungsi, bukan tautan dummy. Empty/loading/error/offline dan provider pending/review/expired terbaca. Checkout tanpa kalender/pilihan slot; PAID tidak ditampilkan sebagai READY atau janji waktu kedatangan.
- [ ] U02: Mobile 360/390/430, tablet 768, desktop 1280, zoom 200%, keyboard dan pembaca layar diuji; CTA sticky tidak menutup fokus/input; target 48px.
- [ ] U03: Kontras teks/hover/focus/disabled/control diukur; modal Escape/focus return dan reduced motion diuji. Status tidak hanya warna.
- [ ] U04: Informasi barang/sumber checklist benar, foto berizin; tidak ada testimoni/afiliasi/statistik palsu atau harga/lokasi simulasi di produksi.
- [ ] U05: CSP, redirect auth, SMTP/OTP, expiry/rate limit dan admin MFA diuji. Tidak ada Server Key/service-role/token pickup di bundle, URL atau log; signed webhook payload tidak dianggap trusted tanpa amount/reference checks.
- [ ] U06: Rate limit checkout 5/menit/user dan pickup lookup 30/menit/staf server-side teruji. Reset/pembobolan limit dan request paralel tidak melewati batas.
- [ ] U07: Pilot 20 checkout serentak, invariant benar. Ukur server p95 ≤2 detik di luar provider; katalog mobile 4G LCP ≤2,5 detik, CLS ≤0,1. Simpan profil perangkat/network dan hasil, perbaiki atau sepakati target baru secara eksplisit.

## 5. Operasi dan go-live

- [ ] O01: D01-D08 BRD memiliki nama penanggung jawab, bukti, tanggal dan persetujuan. Terms/privacy/refund/contact sudah dipublikasikan; keputusan pajak/retensi dikonfirmasi.
- [ ] O02: Hitung stok fisik vs DB, paket vs komponen, lokasi/jam layanan disahkan dan staf tersedia, tanpa pemesanan jadwal pelanggan. UAT pembeli/wali dan staf selesai dengan skenario bayar, packing, ready, pickup, salah kode dan refund.
- [ ] O03: Staging/produksi terpisah. Merchant production disetujui; key production hanya vault/secret, domain Snap dan webhook tepat. Jangan menyalin order sandbox ke produksi.
- [ ] O04: Backup sesuai paket hosting tersedia; restore terisolasi diuji dengan skenario order baru dan pickup sesudah titik backup. RPO/RTO disetujui pemilik berdasarkan paket nyata; belum ada angka yang dianggap aman otomatis. Bukti recovery harus mencakup snapshot item/komponen dan riwayat handover, bukan hanya status provider. Selama pilot, sebelum menyerahkan barang staf mencatat order_number, isi, waktu dan identitas staf ke register operasional terkontrol terpisah dari DB (akses minimum, retensi D06); jika register gagal dicatat, jangan menyerahkan. Setelah restore, pause checkout DAN pickup; rekonsiliasi provider, register handover dan stok fisik. Snapshot pesanan yang hilang tidak boleh direka dari katalog baru; masuk review/refund bila tidak dapat dipulihkan. Sistem hanya dibuka setelah setiap kasus terselesaikan dan pemilik menerima hasil pemulihan.
- [ ] O05: Alarm minimal: scheduler tidak sukses >5 menit, payment uncertain >5 menit, mismatch, oversell/counter drift dan webhook error berulang. Penerima alarm, jam jaga, kanal cadangan dan prosedur eskalasi ditetapkan; alarm pernah diuji diterima.
- [ ] O06: Pause checkout diuji tanpa menghentikan webhook/order access. Rollback frontend teruji; migrasi DB expand/contract kompatibel, tidak menjalankan down migration destruktif otomatis.
- [ ] O07: Pemulihan insiden terdokumentasi: pause checkout, periksa provider, cocokkan order/counter, catat koreksi, hubungi pembeli terdampak, baru buka lagi setelah verifikasi. Tidak menetapkan status PAID hanya dari screenshot transfer.
- [ ] O08: Akses staf individu, pencabutan akses diuji, tidak ada akun bersama. Secret rotation dan backup retention masuk prosedur pemilik.
- [ ] O09: Smoke test produksi terkendali memakai transaksi kecil yang disetujui pemilik, verifikasi settlement, pickup/refund sesuai kasus dan rekonsiliasi dashboard merchant. Bukti dicatat tanpa mengekspos data finansial.
- [ ] O10: Pemilik dan penanggung jawab teknis menandatangani keputusan go/no-go serta batas pilot berdasarkan kapasitas teruji.

## 6. Handoff

Dokumen dapat menjadi dasar rencana implementasi setelah scope disetujui. Aplikasi belum dapat diklaim siap produksi sebelum gerbang di atas terpenuhi. Untuk setiap bukti gunakan format: `ID | tanggal | environment/commit | penanggung jawab | perintah/skenario | hasil | lokasi bukti`.
