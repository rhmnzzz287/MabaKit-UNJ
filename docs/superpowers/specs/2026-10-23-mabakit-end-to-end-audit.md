# Audit end-to-end MabaKit, 23 Oktober 2026

Status: temuan untuk diperbaiki, bukan klaim seluruh acceptance criteria lulus. Kode aplikasi tidak diubah dalam audit ini.

## Metode dan hasil verifikasi

- `npm test`: 21 frontend dan 130 backend test lulus.
- `npm run typecheck`: lulus.
- `npm run build`: lulus; JS 374.42 kB, gzip 104.76 kB.
- Worker lokal `http://localhost:8787`: HTTP 200.
- Smoke HTTP dengan cookie terpisah: buyer, staff, admin berhasil login. Buyer dapat membaca pesanan sendiri; tanpa cookie operator, API team/admin/export menolak 401. Staff dapat membaca team orders, ditolak 403 pada admin catalog dan ekspor. Admin mendapat 200 pada team orders, admin catalog dan CSV.
- Pembentukan sesi operator memakai body `{"portal":"operator"}` pada `/api/demo/session`, bukan query portal saja. Percobaan awal memakai query saja ditolak login 401; ini kesalahan probe, bukan temuan aplikasi.
- Dua review read-only memeriksa backend dan frontend serta kesesuaian spesifikasi. Pemeriksaan SQLite menemukan kegagalan FK saat menyimpan konfigurasi paket seed.
- Test hijau tidak menutup temuan di bawah. Mayoritas reproduksi berasal dari penelusuran kode; langkah yang belum dijalankan disebutkan eksplisit.

## Prioritas

P1: kerusakan pembelian/data atau autentikasi yang perlu didahulukan. P2: fungsi tidak sesuai atau risiko transaksi yang perlu perbaikan sebelum rilis. P3: inkonsistensi terbatas.

## Temuan backend

### B01 / P1: Paket tidak lengkap masih dapat dibeli
- Lokasi: `backend/src/checkout.ts:128-137`; pembanding `backend/src/catalog.ts:254-255`.
- Query checkout membuang komponen inactive/unsellable sebelum memvalidasi paket. Selama masih ada komponen tersisa, pembelian berlanjut dengan harga paket penuh.
- Reproduksi: nonaktifkan satu komponen paket published yang memiliki beberapa komponen; POST checkout langsung. Komponen tersebut tidak masuk snapshot, tetapi paket tetap diterima.
- Bukti: jalur kode terkonfirmasi; reproduksi HTTP belum dijalankan.
- Perbaikan: muat seluruh komponen konfigurasi, tolak jika salah satu tidak layak, validasi konfigurasi saat commit.
- Regresi: menonaktifkan satu komponen harus menolak quote dan checkout tanpa perubahan stok/order.
- Status 2026-10-23 (sudah diperbaiki): `backend/src/checkout.ts` memuat seluruh komponen config (tanpa filter `active/sellable` di SQL) dan menolak bila salah satu tidak layak. Regresi: `checkout paket ditolak bila satu komponen tidak layak (B01)` di `backend/test/worker/api.test.ts`.

### B02 / P1: Konfigurasi paket seed tidak dapat disimpan
- Lokasi: `backend/src/admin-catalog.ts:315-336`, `backend/db/seed.sql:86`.
- ID baru `cfg-${packageId}-${facultyId}` berbeda dari ID seed seperti `cfg-hemat-fbs`. Upsert mempertahankan ID lama; insert komponen memakai ID baru yang tidak ada.
- Reproduksi: simpan konfigurasi `p-paket-hemat` / `fac-fbs` dengan komponen valid.
- Bukti: SQLite menghasilkan `FOREIGN KEY constraint failed`; transaksi rollback.
- Perbaikan: gunakan ID row existing atau ID dari `RETURNING id` untuk seluruh penggantian komponen.
- Regresi: edit harga, komponen dan published pada setiap konfigurasi seed harus berhasil atomik.
- Status 2026-10-23 (sudah diperbaiki): `backend/src/admin-catalog.ts` membaca ID config existing lalu memakainya untuk upsert dan penggantian komponen. Regresi: `konfigurasi paket seed dapat disimpan ulang dengan ID existing (B02)` di `backend/test/worker/api.test.ts`.

### B03 / P2: Batas pesanan gratis tidak atomik
- Lokasi: `backend/src/checkout.ts:175-182`, `backend/src/checkout.ts:267`.
- Cek dua pesanan gratis per akun per jam dilakukan sebelum transaksi. Request paralel dengan key berbeda dapat melewati batas.
- Reproduksi yang perlu dijalankan: satu order gratis sudah ada; kirim dua checkout gratis paralel dari akun sama.
- Perbaikan: batas akun/jam ditegakkan dalam transaksi atau trigger; replay idempotensi tetap diproses lebih dulu.
- Regresi: hanya satu request tambahan berhasil; stok tidak berkurang untuk request tertolak.
- Status 2026-10-23 (sudah diperbaiki): migration `backend/db/migrations/0013_audit_hardening.sql` menambah trigger `trg_free_order_limit` pada INSERT `orders` yang abort `free_limit` (429) bila akun sudah punya 2 pesanan `amount_due_rp = 0` dalam satu jam. Cek sebelum transaksi di `backend/src/checkout.ts` dihapus agar batas hanya ditegakkan di database; replay idempotensi tetap dikembalikan sebelum insert. Regresi: `trigger menolak pesanan gratis ketiga pada jam yang sama`, `checkout gratis melewati batas ditolak 429 dan replay tetap 200`, dan `replay idempotensi paralel tetap 200 walau trigger gratis sempat menolak` di `backend/test/worker/audit-hardening.test.ts`. Replay kini dicari untuk kode error apa pun, karena SQLite menjalankan trigger BEFORE INSERT sebelum UNIQUE idempotensi. Uji paralel D1 staging belum dijalankan.

### B04 / P2: Konfigurasi paket dapat berubah di antara pembacaan dan commit
- Lokasi: `backend/src/checkout.ts:128-145`, `backend/src/checkout.ts:267`, `backend/src/admin-catalog.ts:318-336`.
- Harga/komponen dibaca terpisah; perubahan konfigurasi tidak menaikkan versi produk yang diperiksa trigger item.
- Risiko: komponen lama dengan harga baru, atau checkout setelah unpublish.
- Bukti: guard transaksi tidak ada; interleaving belum dijalankan.
- Perbaikan: versi konfigurasi, naikkan pada setiap perubahan, periksa versi dan published dalam batch checkout.
- Status 2026-10-23 (sudah diperbaiki): migration `0013_audit_hardening.sql` menambah `bundle_configs.version` dan `order_items.bundle_config_version`; `adminSavePackageConfig` menaikkan versi pada setiap simpan; checkout membaca harga, versi, dan komponen konfigurasi dalam satu SELECT lalu trigger `trg_item_bundle_config_guard` memvalidasi versi + `published = 1` saat baris item ditulis. Regresi: `checkout menyimpan versi konfigurasi dan batch menolak versi basi` di `backend/test/worker/audit-hardening.test.ts`.

### B05 / P2: Batas body diperiksa setelah buffering
- Lokasi: `backend/src/admin-media.ts:51-54`, `backend/src/http.ts:147-150`.
- Upload tanpa Content-Length dibaca seluruhnya sebelum batas 5 MiB diperiksa. JSON dibuffer sebelum batas 32 KB, dihitung sebagai panjang string bukan byte.
- Perbaikan: pembacaan stream dibatasi byte dan dibatalkan saat melewati limit.
- Bukti: buffering terkonfirmasi; kehabisan memori Worker belum dibuktikan. Upload memerlukan admin.
- Status 2026-10-23 (sudah diperbaiki): `readBytesLimited` di `backend/src/http.ts` menolak `content-length` di atas batas sebelum membaca, lalu membaca stream per chunk dan membatalkan reader begitu total byte melewati batas; `readJsonLimited` memakai helper itu sehingga batas 32 KB dihitung dalam byte, bukan panjang string UTF-16. `backend/src/admin-media.ts` memakai helper yang sama dengan batas 5 MiB. `backend/src/session.ts` memakai `readJsonLimited(ctx.request, 1024)` untuk `POST /api/demo/session` sehingga endpoint tanpa autentikasi itu juga terbatas. Regresi: `body JSON di atas 32 KB ditolak` dan `unggahan di atas 5 MiB ditolak sebelum dibuffer penuh` di `backend/test/worker/audit-hardening.test.ts`.

### B06 / P3: Foto baru selalu menjadi sampul
- Lokasi: `backend/src/admin-media.ts:64-86`, `backend/src/admin-media.ts:102-110`.
- Upload A lalu B membuat sampul B meskipun urutan galeri A/B. Delete/reorder mengikuti foto pertama.
- Perbaikan: setelah insert, pilih sampul melalui `ORDER BY position, id`.
- Regresi: upload kedua tidak mengubah sampul pertama; reorder eksplisit mengubahnya.
- Status 2026-10-23 (sudah diperbaiki): `backend/src/admin-media.ts` memilih sampul dari `product_photos` dengan `ORDER BY position, id LIMIT 1` setelah insert, sama dengan delete/reorder. Regresi: `unggah kedua tidak menggantikan sampul pertama` di `backend/test/worker/audit-hardening.test.ts`.

### B07 / P3: Filter CSV menerima tanggal mustahil
- Lokasi: `backend/src/admin-export.ts:27-30`.
- `2026-02-30` dapat dinormalisasi menjadi Maret oleh Date.parse.
- Perbaikan: round-trip tanggal WIB dan cocokkan persis input; tolak tanggal invalid.
- Status 2026-10-23 (sudah diperbaiki): `backend/src/admin-export.ts` menormalkan `Date.parse` ke kalender WIB lalu membandingkan hasil round-trip dengan input; tanggal yang bergeser (mis. `2026-02-30`) menghasilkan `invalid_payload`. Regresi: `tanggal ekspor tak nyata ditolak` di `backend/test/worker/audit-hardening.test.ts`.

## Temuan frontend

Semua langkah frontend berikut berasal dari penelusuran kode, belum click-through browser.

| ID | Prioritas | Lokasi | Masalah dan reproduksi | Arah perbaikan |
| --- | --- | --- | --- | --- |
| F01 | P1 | `frontend/src/pages/CartPage.tsx:56-59` | Ubah fakultas langsung menghapus line; Back/batal menghilangkan konfigurasi dan quantity | Simpan line sampai penggantian dikonfirmasi; pertahankan quantity/fakultas |
| F02 | P1 | `frontend/src/lib/auth-store.ts:43-50`, `frontend/src/pages/LoginPage.tsx:25-27`, `frontend/src/pages/OperatorLoginPage.tsx:26-30` | Refresh setelah login dapat memakai request guest yang masih berjalan; hasil terlambat memulihkan guest, bahkan memicu logout operator | Invalidasi/versioning request; wajib fetch baru setelah login; test respons terbalik |
| F03 | P2 | `frontend/src/lib/workspace.ts:32-34`, `frontend/src/pages/OperatorLoginPage.tsx:17-19` | Admin default ke /team; staff next=/admin diarahkan ke halaman ditolak | Tentukan next setelah role diketahui; default staff /team/orders, admin /admin |
| F04 | P2 | `frontend/src/pages/CustomizePage.tsx:59-66`, `frontend/src/pages/CustomizePage.tsx:254-269` | Ganti fakultas saat jaringan lambat masih dapat menambah quote fakultas lama | Disable add saat loading; quote faculty wajib sama dengan pilihan |
| F05 | P2 | `frontend/src/pages/CustomizePage.tsx:42-47` | Package ID invalid/tanpa opsi fakultas meninggalkan loading tanpa akhir | State not-found/unavailable dengan tautan katalog |
| F06 | P2 | `frontend/src/pages/TeamPage.tsx:437-451` | Aksi gagal hanya menampilkan error; order/izin tetap stale setelah transisi lain atau pencabutan izin | Refetch order pada conflict; refresh auth pada penolakan izin |
| F07 | P2 | `frontend/src/pages/AdminPage.tsx:1683-1745` | Staff disabled tidak memiliki kontrol aktifkan kembali | Tambah enable eksplisit, pisahkan dari revoke sesi. Status 2026-10-23 (sudah diperbaiki): `frontend/src/pages/AdminPage.tsx` menampilkan tombol `Aktifkan akun` khusus `operator.disabled`, terpisah dari cabut sesi; `backend/src/admin-team.ts` `adminEnableStaff` mengaktifkan kembali staf target, menolak akun admin, dan menulis audit `staff_enabled`; route `POST /api/admin/operators/:id/enable` di `backend/src/index.ts`. Regresi: `admin mengaktifkan kembali staf yang dinonaktifkan` di `backend/test/worker/api.test.ts`; `tombol aktifkan memakai endpoint enable dan tidak memanggil revoke` di `frontend/src/audit-admin-a11y.test.tsx`. |
| F08 | P2 | `frontend/src/pages/ProductPage.tsx:99-108`, `backend/src/catalog.ts:116-129` | Galeri upload admin tidak diekspos ke detail pembeli; hanya satu foto | Response galeri publik dan pemilih foto accessible. Status 2026-10-23 (sudah diperbaiki): `backend/src/catalog.ts` mengirim `photos` urut `position, id` lewat `/media/` hanya untuk produk aktif; `frontend/src/pages/ProductPage.tsx` merender galeri dengan tombol `aria-pressed` 48px dan fallback foto tunggal. Regresi: `detail produk aktif memuat foto urut position lalu id lewat /media`, `foto produk nonaktif tidak bocor dan paket tetap tanpa galeri`, `berkas foto publik disajikan dari R2 dengan cache immutable` di `backend/test/worker/gallery-public.test.ts`; `foto pertama tampil dan tombol galeri bisa dipilih dengan keyboard`, `tanpa foto galeri memakai gambar varian sebagai cadangan` di `frontend/src/product-gallery.test.tsx`. |
| F09 | P2 | `frontend/src/pages/AdminPage.tsx:22-26` | Diskon 12.345 dibulatkan ke 12.35%; format 1e1 diterima | Validasi sintaks desimal maksimal dua angka sebelum konversi basis points. Status 2026-10-23 (sudah diperbaiki): `percentToBasisPoints` hanya menerima digit dengan maksimal dua angka desimal (koma atau titik), menolak `12.345`, `12,345`, `1e1`, dan `12.`; field diskon menampilkan error `Diskon harus angka 0 sampai 100 dengan maksimal dua angka desimal.` Regresi: `menolak desimal lebih dari dua angka dan notasi eksponen` di `frontend/src/audit-admin-a11y.test.tsx`. |
| F10 | P2 | `frontend/src/pages/CheckoutPage.tsx:222-245` | Keranjang gratis tetap meminta metode pembayaran | Setelah total server diverifikasi nol, sembunyikan metode dan jelaskan tanpa pembayaran. Status 2026-10-23 (sudah diperbaiki): `requote()` mengembalikan total server; efek checkout menyimpan total terverifikasi dan UI menyembunyikan fieldset metode serta menampilkan `Tidak perlu pembayaran karena total pesanan ini Rp 0.` saat total nol, tanpa mengubah submit yang sudah mengarah ke `/orders/:id` bila total order nol. Regresi: `total nol dari server menyembunyikan metode dan membuka detail pesanan` di `frontend/src/audit-admin-a11y.test.tsx`. |
| F11 | P2 | `frontend/src/components/ui.tsx:106-153`, `frontend/src/pages/CheckoutPage.tsx:152-194` | Hint/error Field tidak otomatis terhubung ke kontrol; aria-describedby/aria-invalid tidak konsisten | Hubungkan ID error/hint dan invalid state pada kontrol; test accessibility properties. Status 2026-10-23 (sudah diperbaiki): `Field` meng-clone satu child kontrol dengan `aria-describedby` berisi ID hint/error yang ada dan `aria-invalid` saat error, sambil mempertahankan label/`htmlFor`; field kontak checkout otomatis ikut terhubung. Regresi: `aria-describedby mengikuti hint atau error dan aria-invalid hanya saat error` dan `total nol dari server menyembunyikan metode dan membuka detail pesanan` (cek `contactPhone-hint`) di `frontend/src/audit-admin-a11y.test.tsx`. |

### Status perbaikan frontend 2026-10-23

- F03 (sudah diperbaiki): `operatorNext(raw, role)` di `frontend/src/lib/workspace.ts` menentukan tujuan setelah role diketahui; default staf `/team/orders`, default admin `/admin`, tujuan `/admin` ditolak untuk staf. `frontend/src/pages/OperatorLoginPage.tsx` memakai `operatorNext(rawNext, already)` pada efek dan `operatorNext(rawNext, body.role)` setelah login. Regresi: `staf default ke /team/orders dan tujuan /admin ditolak`, `admin default ke /admin dan tujuan portal dipertahankan`, `staf dengan next /admin diarahkan ke /team/orders setelah role diketahui` di `frontend/src/audit-flows.test.tsx`.
- F05 (sudah diperbaiki): `frontend/src/pages/CustomizePage.tsx` menambah state `missing`; katalog sukses tanpa paket atau tanpa fakultas layak berhenti pada pesan terminal + tautan `/catalog`, tanpa request quote. Regresi: `paket tidak dikenal menampilkan state tidak ditemukan dan tautan katalog`, `paket tanpa fakultas layak menampilkan state belum tersedia` di `frontend/src/audit-flows.test.tsx`.
- F06 (sudah diperbaiki): `frontend/src/pages/TeamPage.tsx` `act()` memuat ulang order setelah aksi gagal; pada 401/403 memanggil `refreshAuth("operator")` lalu menampilkan pesan izin, sementara jalur replay idempoten tetap. Regresi: `aksi gagal memuat ulang status pesanan`, `penolakan izin menyegarkan sesi operator dan menampilkan pesan izin`, `replay idempoten tetap menampilkan catatan tanpa perubahan ganda` di `frontend/src/audit-flows.test.tsx`.
- Verifikasi akhir: `npx vitest run --config frontend/vitest.config.ts` 44 test lulus; `npx vitest run --config backend/vitest.config.ts` 139 test lulus; `npm run typecheck` lulus.

## Kesenjangan dokumen dan implementasi

1. Selesai: kedua spesifikasi sudah memakai status implementasi dengan tautan bukti dan audit ini; riwayat proposal tetap ada.
2. Diputuskan: segmen Indonesia adalah kontrak resmi (`/admin/ringkasan`, `/admin/pesanan`, `/admin/katalog`, `/admin/paket`, `/admin/fakultas`, `/admin/stok`, `/admin/pengambilan`, `/admin/tim`, `/admin/audit`). Nama Inggris pada rancangan refresh hanya alias desain. Segmen tak dikenal diarahkan ke `/admin/ringkasan`, bukan 404. Keputusan tercatat di spec refresh bagian 1.
3. Diterima untuk skala demo: section admin memuat ringkasan dan katalog sekaligus. Optimasi muat per-halaman ditunda, bukan cacat kontrak.
4. Revisi scope eksplisit: edit alt text, pengurutan arbitrer, pratinjau lokal, dan progres unggah ditunda. Kontrak galeri berlaku: maksimal lima foto unggah, sampul dari foto pertama, jadikan sampul, hapus. Keputusan tercatat di spec refresh bagian 1.
5. Selesai: rancangan refresh sudah berstatus IMPLEMENTED; sisa kesenjangan dipecah menjadi keputusan scope di atas dan temuan bernomor.

## Urutan perbaikan dan acceptance

1. Selesai: B01, B02 diperbaiki dengan regresi di `backend/test/worker/api.test.ts`.
2. Selesai: F01, F02, F04 diperbaiki dengan regresi di `frontend/src/lib/cart.test.ts`, `frontend/src/lib/auth-store.test.ts` dan `frontend/src/App.test.tsx`.
3. Sebagian: B03, B04 dijaga trigger/versi SQLite dengan regresi di `backend/test/worker/audit-hardening.test.ts`; uji paralel D1 staging masih perlu.
4. Selesai: F03, F05, F06, F07 diperbaiki dengan regresi di `frontend/src/audit-flows.test.tsx` dan `frontend/src/audit-admin-a11y.test.tsx`.
5. Selesai: F08, F09, F10, F11, B05, B06, B07 diperbaiki dengan regresi di `backend/test/worker/{gallery-public,audit-hardening}.test.ts`, `frontend/src/product-gallery.test.tsx` dan `frontend/src/audit-admin-a11y.test.tsx`.
6. Selesai: PRD, SCHEMA, DESIGN, RELEASE dan status kedua spesifikasi disinkronkan.
7. Selesai sebagian: `npm test` (44 frontend, 139 backend), `npm run typecheck` dan `npm run build` lulus. E2E browser nyata pada poin belum diverifikasi di bawah masih perlu.

## Belum diverifikasi; jangan dinyatakan lulus

- Browser nyata: desktop/mobile 360/768/1280px, zoom 200%, keyboard-only, screen reader, pengukuran kontras, reduced-motion dan print.
- Tidak ada Chromium/Playwright terpasang yang ditemukan pada pemeriksaan lingkungan; tidak memasang dependency baru dalam audit.
- D1 staging concurrency, race free-order/config, R2 failure injection dan upload paralel.
- Spreadsheet nyata untuk CSV, metadata/file gambar rusak dan beban body besar.
- Audit bukan pemeriksaan setiap baris seluruh form admin; tidak mengklaim bebas bug atau siap produksi.
- Tidak ada deploy, push, perubahan kode aplikasi, reset DB, atau pengujian destruktif dilakukan oleh audit ini.
