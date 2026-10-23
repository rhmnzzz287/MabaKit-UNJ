# MabaKit: revisi portal login, dashboard admin, dan izin tim

Status: DRAF untuk persetujuan owner. Dokumentasi saja, belum diimplementasikan.
Tanggal: 2026-10-23.
Baseline: [spec v2](2026-10-22-mabakit-business-website-v2-design.md), terutama bagian 6, 9, 10, 12 dan 13.

## 1. Tujuan dan prioritas

Pisahkan pengalaman pembeli dari operator, serta pengawasan admin dari pekerjaan tim. Admin mengawasi KPI, mengelola akun tim dan kewenangan. Tim memproses pesanan pembeli sesuai izin. Pembeli tidak dapat masuk menggunakan akun operator pada portal pembeli.

Dokumen ini mengusulkan pengganti kontrak v2 untuk topik tersebut. Sampai disetujui, kontrak aktif tidak berubah. Sesudah disetujui, sinkronkan PRD, SCHEMA, DESIGN, RELEASE dan rencana implementasi sebelum mengubah kode. Fitur katalog/paket, larangan tas putih, ownership pesanan, transaksi percobaan, dan aturan stok v2 tetap berlaku.

## 2. Pendekatan dan rekomendasi

| Pendekatan | Konsekuensi |
| --- | --- |
| Halaman berbeda, sesi bersama | Diff kecil, tetapi login operator dapat mengganti sesi pembeli; tidak memenuhi pemisahan sesi yang diminta |
| Portal dan sesi terpisah, role dengan izin operasional terbatas | Direkomendasikan: pemisahan jelas tanpa membuat pembangun role dinamis |
| Sistem role dan policy bebas | Fleksibel, tetapi terlalu besar untuk kebutuhan saat ini dan sulit diverifikasi |

Rekomendasi penulis: pilihan kedua. Owner meminta rekomendasi, tetapi detail rancangan ini masih memerlukan persetujuan. Tidak ada dependency, vendor, atau framework baru yang diasumsikan.

## 3. Portal dan sesi

| Portal | Role diterima | Tujuan setelah login |
| --- | --- | --- |
| `/login` | buyer saja | path buyer allowlisted, default `/orders` |
| `/operator/login` | staff dan admin | staff `/team/orders`, admin `/admin` |

Pembatasan wajib di server sebelum menerbitkan sesi autentikasi. Validasi frontend bukan kontrol keamanan. Login salah portal mengembalikan pesan umum yang mengarahkan penggunaan portal sesuai, tanpa mengungkap keberadaan akun atau role tersimpan. Gagal login tidak mengganti sesi valid yang sudah ada.

Gunakan namespace cookie buyer dan operator berbeda. Keduanya opaque, HttpOnly, SameSite, Secure pada HTTPS, token tersimpan sebagai hash. Token CSRF juga terpisah per portal. Endpoint buyer hanya membaca sesi buyer; endpoint operator hanya membaca sesi operator. Jangan fallback ke cookie portal lain. Kontrak endpoint/cookie final ditetapkan dalam rencana teknis, bukan menambah mekanisme hash baru.

Satu browser boleh memiliki sesi buyer dan operator bersamaan. Logout buyer tidak memutus operator, logout operator tidak memutus buyer. Login operator berikutnya mengganti sesi operator browser itu, bukan sesi buyer. Registrasi publik hanya membuat buyer; request tidak boleh memilih role atau izin.

`next` harus allowlisted per portal: buyer tidak diarahkan ke admin/team; operator tidak diarahkan ke checkout/profil buyer. Admin tidak diwarisi sebagai buyer. Staff tidak dapat membuka `/admin`. `/team`, `/admin`, dan alias `/staff` tetap dilindungi Worker sebelum assets; HTML/API privat memakai no-store dan noindex.

### Pemulihan sesi

- Sesi yang kedaluwarsa tidak menjadi sesi tamu lalu meneruskan transaksi otomatis.
- Inisialisasi sesi dalam satu portal berbagi satu operasi in-flight agar respons tamu terlambat tidak menimpa login berhasil.
- Cookie CSRF yang hilang bukan bukti sesi akun hilang. Periksa sesi server dan pulihkan CSRF lewat mekanisme terikat sesi yang aman; jangan mengganti akun hidup dengan tamu.
- Retry login/registrasi maksimal sekali untuk `session_required`; jangan retry kredensial salah, CSRF gagal, atau network failure secara otomatis.
- Logout/revocation membuat request berikutnya ditolak. Perubahan izin diperiksa server pada request berikutnya, bukan dipercaya dari UI atau token lama.

## 4. Pembagian dashboard

### Admin: pengawasan dan administrasi

Beranda `/admin` menampilkan KPI dan antrean, bukan salinan dashboard kerja tim. Navigasi admin: Ringkasan, Kinerja tim, Akun dan izin tim, Katalog dan paket, Stok, Pengambilan, Audit.

Admin mempertahankan katalog, harga, paket, mapping fakultas, pickup settings dan pause checkout. Ini rekomendasi agar keputusan bisnis tidak diberikan ke semua staff. Admin bisa melihat detail pesanan read-only untuk pengawasan. Admin tidak memproses fulfillment lewat `/team`; kebutuhan override darurat bukan cakupan revisi ini.

### Tim: pekerjaan operasional

`/team` mengarah ke `/team/orders`. Daftar pesanan berisi nomor, item/komponen/fakultas, status pembayaran dan fulfillment, waktu serta snapshot kontak/pengambilan yang diperlukan. Filter dan pagination mencakup seluruh antrean, bukan hanya order baru di sesi operator.

Pesanan berasal dari akun buyer mana pun. Ownership buyer tidak membatasi operator berizin membaca antrean operasional. Operator tidak mendapat akses bebas ke profil buyer, password, hash, atau seluruh data akun.

Keluhan staff tidak bisa memproses order adalah gejala yang dilaporkan, bukan akar masalah terkonfirmasi. Implementasi harus mereproduksi dengan order buyer baru, lalu menelusuri auth, izin, state pembayaran, transisi DB dan respons UI sebelum memilih perbaikan.

## 5. Izin dan manajemen tim

Izin tetap dengan default-deny; tidak ada role builder bebas.

| Kemampuan | Buyer | Staff default | Admin |
| --- | --- | --- | --- |
| Pesanan buyer sendiri | Ya | Tidak | Tidak |
| Antrean/detail operasional | Tidak | `orders.view` | Read-only pengawasan |
| Tandai siap diambil | Tidak | `orders.ready` | Tidak |
| Konfirmasi sudah diterima | Tidak | `orders.complete` | Tidak |
| Koreksi stok | Tidak | Tidak, dapat diberi `stock.adjust` | Ya |
| Katalog/harga/paket/pickup | Tidak | Tidak | Ya |
| Akun tim, izin, KPI, audit | Tidak | Tidak | Ya |

`orders.ready` dan `orders.complete` mensyaratkan `orders.view`. Server menolak kombinasi izin tidak valid. Pencabutan izin menyembunyikan aksi UI dan menolak request langsung. Staff tidak dapat mengubah izin sendiri atau akun operator lain.

Admin dapat membuat akun staff, mengubah nama dan izin, menonaktifkan/mengaktifkan staff, serta mencabut seluruh sesi staff. Tidak ada pembuatan admin atau promosi role melalui fitur ini. Admin aktif terakhir tidak dapat dinonaktifkan lewat dashboard.

Provisioning staff: password awal dimasukkan admin, divalidasi kebijakan auth, langsung di-hash, tidak pernah dikembalikan lewat API/list/audit. Tidak ada pengiriman email atau reset lewat email. Owner menyerahkan kredensial melalui saluran privat. Penggantian password oleh admin harus mencabut sesi staff; tidak ada pembacaan password lama. Sebelum penggunaan nyata, mekanisme penggantian password awal dan recovery harus dikualifikasi, bukan diklaim production-ready.

Aksi akun/izin/stok/fulfillment diaudit dengan actor user ID stabil, target, jenis aksi, perubahan minimum dan waktu. Menonaktifkan staff tidak menghapus riwayat atau atribusi KPI.

## 6. Alur fulfillment dan KPI

1. Buyer membuat order: PENDING/UNFULFILLED, stok HELD.
2. Pembayaran percobaan sah: PAID/UNFULFILLED, stok CONSUMED satu kali.
3. Staff dengan `orders.ready`: PAID/UNFULFILLED menjadi READY.
4. Staff dengan `orders.complete`: PAID/READY menjadi PICKED_UP setelah konfirmasi.

PENDING/EXPIRED tidak boleh diproses. Penyelesaian sebelum READY ditolak. Transisi harus kondisional dan atomik; double click, retry dan dua staff bersamaan hanya menghasilkan satu transisi dan satu event sukses. Replay tidak menambah KPI atau memotong stok lagi. UI menampilkan alasan gagal dan refetch data, bukan sukses optimistis palsu. Buyer melihat status terbaru melalui refresh/refetch yang sudah ditentukan v2.

KPI admin:
- Nilai/jumlah pembayaran berdasarkan `paid_at`, diberi konteks transaksi percobaan, bukan laba atau penerimaan uang nyata.
- Antrean berdasarkan status order terkini; label periode menjelaskan penggunaan `created_at` sesuai v2.
- Per staff: jumlah transisi READY dan PICKED_UP berhasil, berdasarkan actor dan timestamp event, bukan pembuat order atau sesi buyer.
- Periode today/7d/30d/all memakai batas WIB dan agregat seluruh data, bukan halaman pertama.
- Event historis tanpa atribusi user yang dapat dipercaya diberi label tidak teratribusi; jangan ditebak atau dibagi ke staff seed.
- Durasi proses atau ranking tidak ditampilkan sebelum definisi dan data pendukung disepakati.

## 7. Acceptance criteria tambahan

| ID | Bukti wajib |
| --- | --- |
| RP-01 | Admin/staff pada login buyer ditolak server; buyer pada login operator ditolak; tidak ada sesi salah portal diterbitkan |
| RP-02 | Buyer dan operator login bersamaan dalam browser yang sama; logout salah satu tidak memutus lainnya; cookie/CSRF lintas portal ditolak |
| RP-03 | Staff hanya menuju `/team/orders`, admin `/admin`; bypass URL/API dan next lintas portal ditolak |
| RP-04 | Order buyer baru dibayar, terlihat oleh staff default, READY lalu PICKED_UP berhasil; buyer melihat perubahan |
| RP-05 | PENDING, EXPIRED, complete sebelum READY, dan aksi tanpa izin ditolak tanpa perubahan stok/status |
| RP-06 | Admin membuat staff, mengubah izin, menonaktifkan akun dan revoke sesi; request berikutnya ditolak sesuai perubahan; hash/password tidak bocor |
| RP-07 | Staff tidak dapat mengubah akun/izin sendiri, harga/paket/pickup, atau membuka admin; admin tidak menjalankan fulfillment |
| RP-08 | Dua staff memproses order sama secara bersamaan; satu transisi/event sukses, replay idempoten, KPI tidak ganda |
| RP-09 | KPI >50 order, batas WIB, aktor dinonaktifkan dan data tidak teratribusi diuji; angka cocok dengan data sumber |
| RP-10 | Startup/login bersamaan, CSRF hilang dengan sesi akun hidup, stale cookie, retry kedua gagal, network/CSRF/kredensial salah diuji |
| RP-11 | Cookie rotation dan header CSRF diuji dengan browser/cookie jar nyata; mock JSON saja tidak cukup |
| RP-12 | Mobile 360px, zoom 200%, keyboard, konfirmasi, empty/loading/error/retry diverifikasi; staging D1 concurrency sebelum klaim rilis publik |

## 8. Batas dan urutan pekerjaan berikutnya

Tidak ada kode aplikasi, migrasi atau reset DB yang diotorisasi oleh dokumen draf ini. Tidak ada deploy atau commit otomatis.

Setelah persetujuan: sinkronkan kontrak aktif, tulis rencana implementasi dengan pemetaan schema/API/tes dan migrasi aman, perbaiki isolasi sesi, pisahkan dashboard/izin, reproduksi dan perbaiki fulfillment, bangun KPI berbasis event, lalu verifikasi acceptance criteria. Pertahankan data dan backup sebelum migrasi; jangan menyelesaikan masalah dengan reset DB.
