# Schema dan kontrak API: Cloudflare D1

Revisi v2: 22 Oktober 2026. Target aktif demo presentasi, bukan migrasi SQL siap jalan. Perilaku mengikuti [PRD.md](PRD.md). Semua transaksi pembayaran DEMO; booking/reservasi tidak ada.

## 1. Boundary dan tipe

Browser hanya mengakses `/api/*` melalui Worker; D1 binding `DB` hanya server. Tidak ada RLS, RPC database atau koneksi DB publik. Query prepared/parameterized, actor berasal dari sesi cookie, bukan body. Default deny untuk route baru.

ID TEXT UUID dibuat Worker, timestamp INTEGER Unix milidetik UTC (tampilan Asia/Jakarta), uang INTEGER rupiah dengan validasi safe integer dan batas total 10.000.000. Boolean INTEGER CHECK IN (0,1); enum CHECK; JSON TEXT dengan json_valid dan validasi shape Worker. Semua FK penting terindeks dan diuji; D1 memberlakukan FK. Jangan membawa tipe PostgreSQL, row/advisory locks atau transaksi interaktif ke D1.

## 2. Tabel target demo

Semua tabel mempunyai created_at; row mutable juga updated_at. Kolom tanpa `?` wajib kecuali dinyatakan lain. Constraint lintas tabel harus ditulis sebagai guard SQL/trigger yang benar-benar diuji, bukan hanya prose.

| Tabel | Kolom dan invariant |
|---|---|
| users | id TEXT PK, email TEXT UNIQUE (huruf kecil, unik tanpa membedakan kapital), password_hash TEXT (PBKDF2-SHA256 bergaram, format `pbkdf2$iterasi$salt$hash`), role CHECK buyer/staff/admin, permissions TEXT JSON array (default staf `orders.view`, `orders.ready`, `orders.complete`), disabled 0/1, name 1..80, whatsapp, faculty_id? FK faculties, created_at, updated_at; admin terakhir tidak boleh dinonaktifkan; registrasi publik hanya role buyer, role lain lewat provisioning admin. Password tidak pernah plaintext dan tidak dikembalikan API |
| demo_sessions | id PK, token_hash UNIQUE, csrf_hash, client_key_hash, user_id? FK users, portal CHECK buyer/operator, created_at, expires_at; token opaque acak CSPRNG minimal 128 bit disimpan sebagai hash. Sesi tamu hanya untuk CSRF katalog/keranjang; transaksi wajib `user_id`. Sesi kedaluwarsa/dicabut tidak menghapus users atau orders; tidak ada jalur yang mengubah sesi akun kedaluwarsa menjadi sesi tamu |
| faculties | id PK, name, active |
| faculty_aliases | label TEXT PK, faculty_id FK faculties, source_ref, confirmed 0/1; FIS/FISH, FIK/FIKK, FPPsi/FPSI/FPsi memetakan satu fakultas internal tanpa duplikasi stok; label `FEG` disimpan confirmed=0 dan tidak dipetakan ke FEB |
| departments | id PK, faculty_id FK, name, active; UNIQUE(id,faculty_id) |
| spec_checklists | id PK, department_id FK, academic_year, content, source_ref, verified_at?, published; published perlu sumber/tahun/verifikasi |
| products | id PK, kind CHECK single/bundle, title, description, image_path?, discount_basis_points 0..10000, active, version >0; harga bundle tidak di tabel ini. Diskon hanya untuk produk satuan; harga dasar varian tetap positif. Kolom admin: title, description, image_path, discount_basis_points, active, version |
| variants | id PK, product_id FK, sku UNIQUE, attributes TEXT JSON object, price_rp >0, stock_on_hand >=0, stock_reserved >=0, active, sellable 0/1, image_path?, version >0; reserved <= on_hand, induk single. Kolom admin: price_rp, stock_on_hand, active, sellable, image_path, version. Tas putih/natural, termasuk totebag FIKK putih, wajib sellable=0 dan active=0, ditolak server walau SKU diminta langsung |
| bundle_slots | id PK, bundle_product_id FK products, slot_key, component_kind CHECK common/faculty, quantity 1..99, variant_id? FK variants; UNIQUE(bundle_product_id,slot_key). Slot common menunjuk SKU umum; slot faculty diisi per fakultas, tanpa fallback ke fakultas lain |
| bundle_configs | id PK, bundle_product_id FK products, faculty_id FK faculties, price_rp?, status CHECK draft/published, version >0, UNIQUE(bundle_product_id,faculty_id); publish ditolak bila slot belum lengkap, harga belum ditetapkan, atau stok tidak cukup. price_rp null berarti belum tersedia, bukan nol |
| bundle_config_slots | bundle_config_id FK bundle_configs, slot_key, variant_id FK variants, quantity 1..99, PK(bundle_config_id,slot_key); variant harus sesuai component_kind slot dan fakultas konfigurasi |
| store_settings | id INTEGER PK CHECK(id=1), checkout_enabled, pickup_location_label, pickup_location_details, pickup_service_hours, pickup_version >0; instruksi lengkap sebelum checkout dibuka, tanpa slot/kapasitas |
| orders | id PK, order_number UNIQUE, user_id FK users, legacy_session_id? FK demo_sessions, checkout_key, request_hash, buyer_name, contact_phone, email snapshot, faculty_id? FK, department_id? FK, pickup_instructions_snapshot JSON, total_rp 1..10000000, payment_status, fulfillment_status, stock_allocation_status, expires_at, paid_at?, ready_at?, picked_up_at?, picked_up_by dicatat di audit_logs, bukan kolom orders; UNIQUE(user_id,checkout_key). Order baru wajib account-owned; order legacy tetap legacy_session_id dan read-only |
| order_items | id PK, order_id FK, product_id FK, variant_id? FK, bundle_config_id? FK, faculty_label_snapshot, title_snapshot, attributes_snapshot JSON, catalog_version, quantity 1..99, unit_price_rp >0 (harga dasar, memenuhi trigger katalog), line_total_rp, base_unit_price_rp, discount_basis_points, charged_unit_price_rp, charged_line_total_rp; charged_* adalah nilai tagihan sebenarnya (boleh 0). line_total = quantity × unit_price. Snapshot diskon tidak berubah setelah checkout |
| order_components | order_item_id FK, variant_id FK, sku_snapshot, title_snapshot, attributes_snapshot JSON, quantity >0, PK(order_item_id,variant_id); quantity sudah dikalikan item.quantity, single juga membuat komponen |
| payments | order_id PK FK, mode CHECK(mode='DEMO'), method CHECK BANK_TRANSFER/EWALLET/QRIS/FREE, confirmed_at?; FREE berarti pesanan 100% diskon dan langsung lunas tanpa aksi bayar. Tidak menyimpan rekening, QR nyata, kredensial, gateway token atau settlement ID |
| invoices | id PK, order_id FK UNIQUE, invoice_number UNIQUE, mode CHECK(mode='DEMO'), issued_at; detail diambil dari snapshot order immutable, bukan katalog terkini |
| reviews | id PK, order_id? FK orders UNIQUE, user_id? FK users, display_name, rating 1..5, comment 10..1000, is_example 0/1, created_at; ulasan asli wajib order PAID+PICKED_UP milik akun, contoh tidak ditampilkan sebagai testimoni |
| audit_logs | id PK, actor_id? FK users, action, entity_type, entity_id, safe_metadata JSON, request_id; append-only tanpa kontak/token/payload mentah |
| rate_limits | scope, actor_key_hash, window_start, count >=0, PRIMARY KEY(scope,actor_key_hash,window_start); update counter atomik; jendela >1 jam dibuang `pruneRateLimits` |

Indeks: sessions(user_id,expires_at), orders(user_id,created_at), orders(payment_status,expires_at), orders(fulfillment_status,created_at), order_items(order_id), order_components(variant_id), bundle_configs(faculty_id), audit_logs(entity_id,created_at), rate_limits(window_start). Snapshot/items/components tidak diedit setelah checkout. Hapus katalog yang sudah dipakai dilarang; nonaktifkan. Sesi expired tidak menghapus cascade pesanan; kebijakan cleanup demo harus mempertahankan integritas sampai reset operator.

Migrasi identitas: order dan profil lama masih session-owned. Jangan mengklaim kepemilikan berdasarkan kesamaan nama/email atau memasang order lama ke akun buyer seed. Order legacy tetap terisolasi sebagai data presentasi lama/read-only operasional dan tidak pernah di-attach ulang lewat pencocokan email. Order baru wajib account-owned dan dibuat lewat API akun. Backup sebelum migrasi; tanpa reset DB otomatis.

MFA, recovery password lewat email, refunds dan provider references ditunda. Bukan tabel pura-pura dengan keamanan produksi yang belum ada.

## 3. Kontrak API

```ts
type CheckoutInput = {
  buyerName: string;
  contactPhone: string;
  email: string;
  facultyId: string | null;
  departmentId: string | null;
  method: 'BANK_TRANSFER' | 'EWALLET' | 'QRIS';
  idempotencyKey: string;
  items: {
    productId: string;
    variantId: string | null;
    bundleConfigId: string | null;
    quantity: number;
  }[];
};
type CheckoutResult = {
  order: { id: string; orderNumber: string; totalRp: number; expiresAt: number };
};
```

Body maksimum 32 KB dan field asing ditolak. Server tetap menghitung harga, komponen, fakultas/varian yang diizinkan, total dan stok dari D1; `idempotencyKey` hanya kunci retry, bukan otoritas harga. `recipientName` dihapus; penerima adalah pembeli. Profil (`GET/PATCH /api/profile`) hanya prefill, bukan sumber snapshot. Body buyer tidak dapat mengubah harga, role, atau mapping fakultas.

Retry checkout mengembalikan status order terkini, termasuk PAID/EXPIRED, bukan selalu PENDING. Versi produk/SKU/bundle_config dipakai untuk perubahan relevan, bukan counter stok. Perubahan komponen slot menaikkan versi paket dan konfigurasi terkait. pickup_version berubah saat instruksi berubah.

| Route | Akses dan hasil |
|---|---|
| POST /api/auth/register | Publik; email+password, role selalu buyer, normalisasi email, validasi nama 1..80, password 8..128 tanpa pemotongan; tidak ada verifikasi email; sukses membuat sesi |
| POST /api/auth/login | Publik; email+password, error umum tanpa mengungkap akun, rate limit per sumber dan identitas; rotasi token sesi |
| POST /api/auth/logout | Sesi+CSRF; cabut baris sesi, hapus akses berikutnya |
| GET /api/auth/session | Status sesi dan role server `buyer`/`staff`/`admin`; tanpa data privat |
| GET/PATCH /api/profile | Pemilik akun; PATCH hanya name/whatsapp/faculty/department, body ketat <=32 KB, email login tidak dapat diubah di sini |
| GET /api/catalog, /api/catalog/:id | Publik, projection katalog aktif, tanpa SKU tas putih/natural |
| GET /api/packages/:id/quote?facultyId= | Publik; quote komponen, harga dan stok dari bundle_configs; 409 bila konfigurasi belum lengkap atau versi berubah |
| GET /api/reviews | Publik, maksimum 6 ulasan terbaru; nama depan saja, tanpa kontak/order; tanpa ulasan contoh sebagai testimoni |
| POST /api/checkout/create | Sesi+CSRF; hitung server, snapshot/alokasi atomik dalam satu batch; 400 invalid, 401 tanpa sesi, 409 konflik, 503 DB gagal |
| POST /api/orders/:id/check-payment | Pemilik akun+CSRF, hanya DEMO environment dan row mode DEMO. PENDING/HELD belum expired menjadi PAID/CONSUMED dan satu invoice atomik; retry PAID mengembalikan hasil sama; order expired ditolak |
| GET /api/orders dan /api/orders/:id | Pemilik akun; order akun lain 404, admin tidak melewati ownership endpoint buyer; detail memuat linimasa, invoice dan `reviewEligible` |
| GET /api/orders/:id/invoice | Pemilik akun, invoice hanya setelah PAID; projection memuat `Dokumen percobaan, bukan bukti pembayaran sah.` |
| POST /api/orders/:id/review | Pemilik akun+CSRF; hanya PAID+PICKED_UP, satu per order, rating 1..5, komentar 10..1000 |
| GET /api/team/summary | Staff/admin; periode today/7d/30d/all dengan batas tengah malam WIB; antrean dihitung dari `created_at`, nilai penjualan dari `paid_at`; agregat seluruh order, bukan 50 terakhir; menyapu hold kedaluwarsa lebih dulu; nilai diberi konteks `Transaksi percobaan` |
| GET /api/team/orders dan /api/team/orders/:id | Staff/admin; filter, cursor, detail + komponen + fakultas; 401/403 sebelum data |
| POST /api/team/orders/:id/ready | Staff/admin; PAID+CONSUMED+UNFULFILLED -> READY + audit |
| POST /api/team/orders/:id/complete | Staff/admin; READY -> PICKED_UP manual + audit, idempotent |
| /api/admin/* | Admin terverifikasi; CRUD produk/varian, draft/publish paket dan mapping fakultas, stok, settings, audit, daftar akun operator dan pencabutan sesi, galeri foto (maksimal 5 per produk, ke R2), CSV penjualan, KPI. Tidak mengembalikan hash/password; tanpa SQL/tabel generik atau self-assign role |

Halaman `/team*`, `/staff*`, `/admin*` melewati Worker sebelum Static Assets (`run_worker_first: true`, semua path masuk Worker lalu aset publik diteruskan): tanpa sesi 302 ke `/operator/login?next=...`; pembeli 403; staf hanya `/team*`; `/staff*` dialihkan ke `/team/orders`; admin boleh `/admin` dan `/team*`. Route privat buyer (`/profile`, `/checkout`, `/orders*`) juga melewati Worker dan mengarah ke `/login?next=...`. Respons privat `no-store` dan `x-robots-tag: noindex`.

Route simulasi tidak terdaftar jika mode bukan DEMO. Verifikasi mode server/config dan row, bukan input browser. Semua mutasi cookie memeriksa Origin+CSRF. API stale read terkait status tidak boleh menjadi otoritas mutasi; gunakan primary D1 untuk demo, read replication ditunda.

## 4. Transaksi D1 dan idempotency

Workers D1 menyediakan `DB.batch()` atomik, bukan transaksi JavaScript interaktif. Tidak memakai BEGIN/COMMIT manual atau menganggap nol row UPDATE sebagai rollback. Semua statement dalam batch disiapkan sebelum eksekusi. Query kandidat di luar batch bukan sumber snapshot final yang dipercaya.

Checkout:
1. Validasi/normalisasi, gabungkan duplicate baris sebelum batas (total tiap baris <=99), urutkan, hash request termasuk metode dan consent. Actor dari sesi akun.
2. Unique(user_id,checkout_key) menjaga satu draft. Pada concurrent conflict, baca pemenang dan cocokkan hash; berbeda 409, sama return order.
3. Batch memeriksa batas hold aktif (2/akun, 10/IP hash) dan memvalidasi ulang versi/aktif/harga/bundle_config/pickup_version/checkout_enabled serta komposisi, memasukkan snapshot dan komponen dari data yang valid dalam transaksi, mengalokasikan agregat SKU.
4. Guard SQL harus menggagalkan seluruh batch bila salah satu prasyarat gagal. Contoh teknik: trigger RAISE(ABORT, ...) untuk kegagalan guard. `UPDATE ... WHERE available >= need` dengan nol row tanpa error tidak cukup; memeriksa meta.changes sesudah commit tidak bisa membatalkan SKU sebelumnya.
5. Semua snapshot, counter, payment dan order rollback bersama. Uji perubahan versi serentak serta kegagalan komponen kedua wajib.

Konfirmasi demo: satu batch dengan guard owner, mode, PENDING/HELD, waktu < expires_at; kurangi reserved dan on_hand agregat komponen, set PAID/CONSUMED, insert invoice UNIQUE(order_id) dan audit. Duplikat/concurrent check mengembalikan invoice sama setelah membaca state pemenang, tanpa efek stok kedua. Invoice number dibuat server dan collision ditangani tanpa menduplikasi transaksi.

Expiry: routine Worker membatalkan PENDING/HELD yang melewati expires_at, melepaskan reserved sekali; on_hand tidak ditambah. Dipanggil sebelum checkout dan check-payment agar draft kedaluwarsa tidak menahan stok saat demo dipakai; batch terbatas, backlog diproses bertahap. Cron tidak diwajibkan demo. Race expiry vs konfirmasi hanya satu transisi terminal sah.

READY dan complete tidak mengurangi stok lagi. Complete hanya READY -> PICKED_UP, idempotent, dan diserialisasi SQL guard/batch, bukan lock aplikasi memory. Stock adjustment wajib on_hand baru >= reserved dan audit atomik.

## 5. Bukti wajib

Uji lokal SQLite/D1 lalu staging D1 nyata: foreign keys, constraint/trigger, rollback seluruh batch, race SKU terakhir, paket berbagi komponen, key sama/beda, duplicate check, expiry vs check, invoice unik/immutable, complete ganda dua staf, ulasan ganda, akses akun lain, SKU tas putih ditolak lewat API langsung, dan endpoint demo tertutup pada non-demo. Batas batch/query D1 diperiksa terhadap 20 baris × 20 komponen maksimum; jika batas tak cukup, kecilkan batas produk/checkout secara eksplisit, jangan memecah transaksi stok menjadi commit parsial.

Migrations di backend/db/migrations/ (`0001` init, `0002` profil/email/ulasan/operator, `0003` hapus pickup_tickets, `0004` akun persisten/paket fakultas, `0005` hapus picked_up_by, `0006` hapus tabel profiles v1, `0007` kolom variants.sellable dan trigger tas putih, `0008` indeks unik idempotensi per akun, `0009` trigger tas putih untuk INSERT dan UPDATE, `0010` portal operator, izin staf, status nonaktif, KPI dan audit actor, `0011` diskon produk/pesanan gratis/kolom tagihan, `0012` tabel product_photos dan trigger batas lima, `0013` trigger batas pesanan gratis, versi bundle_configs, dan guard versi konfigurasi paket; diskon hanya untuk produk satuan, paket memakai harga per fakultas), versioned, seed SIMULASI terpisah. Seed idempoten: admin `mabakita@admin` / `admin123`, staf `tim@demo.mabakit` / `staffmabakit123`, buyer `pembeli@demo.mabakit` / `buyermabakit123`; tidak menggandakan user, tidak mereset password yang sudah diganti, tidak menghapus pesanan, tidak menaikkan role akun buyer dengan email sama; konflik role gagal eksplisit. Password seed di-hash, tidak plaintext di tabel, migrasi, frontend atau bundle. Wrangler environment/database terpisah. Backup/restore dan uji akses dibutuhkan sebelum demo publik yang menyimpan data; gerbang produksi tambahan di [RELEASE.md](RELEASE.md).
