# Design dan arsitektur: MabaKit

Revisi: 22 Oktober 2026. Arah desain melanjutkan draf hijau kampus; bukan klaim identitas resmi UNJ. Kontrak perilaku [PRD.md](PRD.md), data [SCHEMA.md](SCHEMA.md). Semua ketentuan visual di sini masih target implementasi, belum bukti audit UI.

Tujuan layar: membantu pembeli menemukan perlengkapan PKKMB, memeriksa harga/spesifikasi, membeli dan mengikuti status penyerahan. Tidak ada antarmuka booking/reservasi, kalender, pilihan slot, kuota kunjungan atau reschedule. Pengambilan adalah pemenuhan pembelian, bukan layanan janji temu.

## 1. Arsitektur minimum

```text
Browser: React + TypeScript + Vite + Tailwind CSS
  Supabase Auth email OTP
  Katalog publik dan baca order sendiri melalui SDK + RLS
  Keranjang lokal; pembayaran melalui Midtrans Snap
           |
Supabase: PostgreSQL + RLS + transactional RPC + Storage foto
  Edge create-payment: JWT owner, checkout server, request Snap
  Edge payment-webhook: signature, Status API, transisi atomik
  Scheduled reconcile-payments: status provider, expiry, recovery
           |
Midtrans: satu merchant, satu environment per deployment
```

Tiga entrypoint server cukup: dua endpoint interaktif/provider dan satu job terjadwal. Fungsi bisnis atomik tinggal di PostgreSQL, bukan diduplikasi di browser dan Edge. Cron memanggil Edge job dengan secret dari vault/scheduler; service-role dan Server Key tidak tersedia melalui URL publik, build client atau log.

Hosting SPA di Vercel dengan fallback route, TLS, CSP yang sesuai domain Snap sandbox/production, dan redirect auth allowlist. Staging memakai Supabase dan merchant sandbox terpisah. Tidak ada Express/NestJS perantara, Realtime, Redis, queue broker, maupun microservices. Panggilan browser ke DB hanya untuk data yang memang boleh dibaca/diubah aktornya.

## 2. Design read dan alasan

Audience: mahasiswa baru yang ingin melihat barang, harga dan cara pengambilan, juga wali/koordinator yang belum punya identitas mahasiswa. ENERGY 2, RHYTHM 2, MOTION 1. Bahasa Indonesia langsung dan operasional.

Identitas: foto barang asli berizin, spesifikasi bahan/warna/ukuran terlihat, isi paket menjadi daftar packing yang bisa diperiksa. Hijau digunakan untuk aksi dan identitas toko, bukan seluruh permukaan. Aksen emas hanya untuk informasi yang perlu perhatian. Tidak membuat halaman marketing panjang yang menunda katalog.

| Keputusan | Alasan |
|---|---|
| Fakultas/prodi opsional, bukan gerbang wajib | Wali/koordinator dapat berbelanja; data tak terverifikasi tidak dipaksakan |
| Foto dan spesifikasi dekat harga | Pembeli perlu membandingkan barang nyata, bukan janji kesesuaian tanpa bukti |
| Paket menampilkan setiap komponen | Menghindari membeli paket yang isinya tidak dibutuhkan |
| Satu CTA utama per tahap | Bedakan tambah keranjang, bayar, dan penyerahan fisik |
| Snap resmi, bukan layar QRIS buatan sendiri | Biarkan provider menangani instruksi channel dan QR; kurangi duplikasi expiry/UI pembayaran |
| Kode pickup lebih dulu daripada kamera | Tetap bekerja pada perangkat yang menolak izin kamera dan tanpa library scanner tambahan |

Tidak membuat ilustrasi, logo, foto, video atau testimoni sintetis. Aset baru memerlukan persetujuan dan sumber/izin. Tanpa aset valid, halaman development memakai placeholder berlabel, tidak dianggap siap publikasi.

## 3. Token visual

| Token | Nilai dan pemakaian |
|---|---|
| Brand utama | `#047857`, CTA dengan teks putih; hover `#064e3b` |
| Brand tint | `#f0fdf4`, latar penjelasan, tidak menggantikan label |
| Accent text / background | `#92400e` pada `#fef3c7`, peringatan dengan ikon/teks |
| Surface | `#ffffff`, latar halaman `#f8fafc` |
| Text utama / sekunder | `#0f172a` / `#475569` pada permukaan terang |
| Input boundary | `#64748b` pada putih untuk batas kontrol penting; `#cbd5e1` hanya pemisah dekoratif |
| Error | `#b91c1c` pada putih, selalu disertai pesan |
| Focus | outline `#0f172a` 2px, offset 3px; pastikan tidak terpotong |
| Typography | Satu keluarga Plus Jakarta Sans self-host jika izin/asset tersedia; fallback `system-ui, sans-serif`. Body/input minimal 16px, line-height 1.5. Kode memakai `ui-monospace` saja |
| Shape / spacing | Radius kontrol 8px, kartu 12px; spacing kelipatan 4px. Tidak semua elemen menjadi kartu |

Seluruh pasangan aktual termasuk disabled/hover/focus harus diukur saat UI tersedia: teks normal ≥4,5:1, teks besar dan batas kontrol penting ≥3:1. Nilai hex bukan bukti semua layar lolos AA.

## 4. Layar dan kontrak interaksi

| Route | Konten, fokus utama, dan states |
|---|---|
| `/` | Katalog langsung; pilih kategori/fakultas opsional. Foto, harga, ukuran/warna singkat, ketersediaan. Loading skeleton hanya saat memuat; empty filter dengan reset; error dengan coba lagi. Tidak ada fake stock countdown/testimoni. |
| `/products/:id` | Foto, bahan, ukuran, varian, harga final, komponen paket, sumber panduan bila verified. CTA “Tambah ke keranjang”. Pilihan tidak lengkap diberi error dekat input; varian habis tidak dapat ditambahkan. |
| `/cart` | Item dan jumlah, harga estimasi, komponen paket, total. CTA “Lanjut checkout”. Keranjang kosong menyediakan “Lihat katalog”; data lokal rusak dipulihkan dengan pesan. Menambah barang tidak mengalokasikan stok. |
| `/login` | Email OTP; petunjuk cek email, kirim ulang dengan cooldown, ubah email. Error kedaluwarsa dan jaringan jelas. Setelah login kembali ke checkout tanpa menaruh secret di URL. |
| `/checkout` | Nama pembeli/penerima, kontak, informasi lokasi/jam layanan WIB, kebijakan/total. Tidak ada pemilihan waktu. CTA “Konfirmasi dan bayar”. Sebut batas pembayaran 30 menit setelah order dibuat, bukan janji reservasi barang. Selama submit, cegah klik ganda dan pertahankan key. 409 menampilkan perubahan dan minta konfirmasi ulang. |
| Snap modal | UI provider. Tutup popup tidak berarti batal; kembali ke order PENDING dengan “Lanjutkan pembayaran”. Callback sukses menampilkan pemeriksaan server, tidak konfirmasi lunas lokal. |
| `/orders` dan `/orders/:id` | Order milik akun. Pisahkan status pembayaran dan fulfillment. PAID: “Pembayaran diterima. Pesanan sedang disiapkan.” READY: instruksi lokasi/jam layanan dari snapshot pesanan dan kode pickup dari endpoint owner. EXPIRED: instruksi order baru. REVIEW: “Pembayaran sedang diperiksa. Jangan bayar ulang.” Tombol bantuan terlihat. |
| `/staff/orders` | Daftar operasional, filter status, detail packing snapshot. CTA “Tandai siap diambil” hanya PAID. Tidak menampilkan data pribadi yang tidak diperlukan. |
| `/staff/pickup` | Input kode; lookup butuh login staf. Ringkasan penerima, barang/isi paket dan status. CTA “Konfirmasi penyerahan” dengan konfirmasi pemeriksaan barang/penerima serta pencatatan register handover pilot sesuai RELEASE. Sudah diambil menampilkan waktu dan staf, tanpa tombol penyerahan ulang. |
| `/admin` | Katalog/varian, paket tetap, stok, informasi pengambilan toko, pause checkout, review payment, refund dan audit. Aksi sensitif memerlukan admin MFA; tidak ada tombol set PAID atau akses rahasia gateway. |
| `/privacy`, `/terms`, `/help` | Kebijakan dan kontak yang disahkan D05-D06. Draft/konten dummy memblokir produksi, bukan disembunyikan di balik tautan mati. |

Snapshot contoh untuk QA (bukan harga publik): `2 × SKU A Rp15.000` + `1 × Paket P Rp30.000` = `Rp60.000`. Tidak ada diskon Rp5.000 tanpa aturan. Lokasi dan jam layanan menggunakan fixture berlabel SIMULASI sampai D04 disetujui. Informasi ini disnapshot saat checkout; perubahan versi sebelum submit menghasilkan 409 dan persetujuan ulang. Perubahan setelah pembelian memerlukan pemberitahuan operator kepada pembeli terdampak, bukan menimpa snapshot diam-diam. Status READY tetap syarat pengambilan; jam buka bukan janji waktu selesai per pesanan.

## 5. Mobile, keyboard dan kegagalan

- Mulai 360px, uji 390px, 430px, 768px dan desktop 1280px; no horizontal overflow. Form satu kolom; katalog menyesuaikan ruang dan panjang nama, bukan memaksa tiga kolom.
- CTA sticky memakai safe-area inset dan ruang bawah; jangan menutup input, error, fokus atau keyboard mobile. Target sentuh 48×48px termasuk hapus barang dan kontrol jumlah.
- Label selalu terlihat; placeholder bukan label. Error terkait via `aria-describedby`, ringkasan error fokus setelah submit gagal. Status jaringan/payment memakai live region tanpa mengumumkan timer tiap detik.
- Tombol/link semantik, urutan tab alami; dropdown native jika cukup. Modal mengunci fokus, Escape menutup bila aman, lalu fokus kembali. Jangan membuat modal nested di atas Snap.
- Zoom 200%, teks panjang, barang tanpa foto, harga besar, order kosong dan jaringan lambat tidak merusak layout. Status bukan warna saja. Hormati `prefers-reduced-motion`; animasi hanya feedback pendek.
- Refresh/putus internet saat bayar tidak menghasilkan order kedua; halaman memulihkan status dari server. Deadline ditampilkan dengan waktu absolut WIB; timer negatif tidak mengubah status DB.
- Kode pickup adalah bearer credential sensitif; hanya pemilik dapat menerbitkan ulang, pengguna diperingatkan agar tidak membagikan publik. Hilang kode memakai login pemilik untuk rotasi, bukan pencarian NIM terbuka.

## 6. Delivery gate

Belum ada UI yang dapat diaudit. Jangan menandai PASS. Bukti wajib: kontras per pasangan nyata, keyboard/reader, zoom/mobile, status error/loading/empty, asset provenance, bahasa tanpa klaim fiktif, serta perilaku Snap/checkout/pickup. Pelacakan di [RELEASE.md](RELEASE.md).
