# Schema dan kontrak API: Cloudflare D1

Revisi: 22 Oktober 2026. Target aktif demo presentasi, bukan migrasi SQL siap jalan. Perilaku mengikuti [PRD.md](PRD.md). Semua transaksi pembayaran DEMO; booking/reservasi tidak ada.

## 1. Boundary dan tipe

Browser hanya mengakses `/api/*` melalui Worker; D1 binding `DB` hanya server. Tidak ada RLS, RPC database atau koneksi DB publik. Query prepared/parameterized, actor berasal dari sesi cookie, bukan body. Default deny untuk route baru.

ID TEXT UUID dibuat Worker, timestamp INTEGER Unix milidetik UTC (tampilan Asia/Jakarta), uang INTEGER rupiah dengan validasi safe integer dan batas total 10.000.000. Boolean INTEGER CHECK IN (0,1); enum CHECK; JSON TEXT dengan json_valid dan validasi shape Worker. Semua FK penting terindeks dan diuji; D1 memberlakukan FK. Jangan membawa tipe PostgreSQL, row/advisory locks atau transaksi interaktif ke D1.

## 2. Tabel target demo

Semua tabel mempunyai created_at; row mutable juga updated_at. Kolom tanpa `?` wajib kecuali dinyatakan lain. Constraint lintas tabel harus ditulis sebagai guard SQL/trigger yang benar-benar diuji, bukan hanya prose.

| Tabel | Kolom dan invariant |
|---|---|
| demo_sessions | id TEXT PK, token_hash UNIQUE, client_key_hash, expires_at; hash-only token cookie acak CSPRNG minimal 128 bit. Ini sesi tamu demo, bukan akun produksi |
| demo_operators | id PK, session_id FK demo_sessions UNIQUE, role CHECK staff/admin, expires_at; hanya provisioning operator terpercaya, tidak ada endpoint self-assign |
| faculties | id PK, name, active |
| departments | id PK, faculty_id FK, name, active; UNIQUE(id,faculty_id) |
| spec_checklists | id PK, department_id FK, academic_year, content, source_ref, verified_at?, published; published perlu sumber/tahun/verifikasi |
| products | id PK, kind CHECK single/bundle, title, description, image_path?, active, version >0, bundle_price_rp?; bundle harga positif, single null |
| variants | id PK, product_id FK, sku UNIQUE, attributes TEXT JSON object, price_rp >0, stock_on_hand >=0, stock_reserved >=0, active, version >0; reserved <= on_hand, induk single |
| bundle_components | bundle_product_id FK, variant_id FK, quantity 1..99, PK(bundle_product_id,variant_id); induk bundle, tidak bersarang; paket aktif 1..20 komponen |
| store_settings | id INTEGER PK CHECK(id=1), checkout_enabled, pickup_location_label, pickup_location_details, pickup_service_hours, pickup_version >0; instruksi lengkap sebelum checkout dibuka, tanpa slot/kapasitas |
| orders | id PK, order_number UNIQUE, session_id FK demo_sessions, checkout_key, request_hash, buyer_name, recipient_name, contact_phone, department_id? FK, pickup_instructions_snapshot JSON, total_rp 1..10000000, payment_status, fulfillment_status, stock_allocation_status, expires_at, paid_at?, ready_at?, picked_up_at?, picked_up_by? FK demo_operators; UNIQUE(session_id,checkout_key) |
| order_items | id PK, order_id FK, product_id FK, variant_id? FK, title_snapshot, attributes_snapshot JSON, catalog_version, quantity 1..99, unit_price_rp >0, line_total_rp; line_total = quantity × unit_price; bundle variant null, single variant wajib sesuai produk |
| order_components | order_item_id FK, variant_id FK, sku_snapshot, title_snapshot, attributes_snapshot JSON, quantity >0, PK(order_item_id,variant_id); quantity sudah dikalikan item.quantity, single juga membuat komponen |
| payments | order_id PK FK, mode CHECK(mode='DEMO'), method CHECK BANK_TRANSFER/EWALLET/QRIS, confirmed_at?; tidak menyimpan rekening, QR nyata, kredensial, gateway token atau settlement ID |
| invoices | id PK, order_id FK UNIQUE, invoice_number UNIQUE, mode CHECK(mode='DEMO'), issued_at; detail diambil dari snapshot order immutable, bukan katalog terkini |
| pickup_tickets | order_id PK FK, token_hash UNIQUE, issued_at, claimed_at?, claimed_by? FK demo_operators; token CSPRNG 128 bit minimum, Base32 26 karakter, plaintext tidak disimpan |
| audit_logs | id PK, actor_id?, action, entity_type, entity_id, safe_metadata JSON, request_id; append-only tanpa kontak/token/payload mentah |
| rate_limits | scope, actor_key_hash, window_start, count >=0, PRIMARY KEY(scope,actor_key_hash,window_start); update counter atomik dan expiry cleanup |

Indeks: orders(session_id,created_at), orders(payment_status,expires_at), orders(fulfillment_status,created_at), order_items(order_id), order_components(variant_id), audit_logs(entity_id,created_at). Snapshot/items/components tidak diedit setelah checkout. Hapus katalog yang sudah dipakai dilarang; nonaktifkan. Sesi expired tidak menghapus cascade pesanan; kebijakan cleanup demo harus mempertahankan integritas sampai reset operator.

Akun pelanggan permanen, user_roles produksi, MFA, refunds dan provider references ditunda. Bukan tabel pura-pura dengan keamanan produksi yang belum ada.

## 3. Kontrak API

```ts
type CheckoutInput = {
  checkout_key: string;
  items: {
    product_id: string;
    variant_id: string | null;
    quantity: number;
    product_version: number;
    variant_version: number | null;
  }[];
  expected_total_rp: number;
  pickup_version: number;
  buyer_name: string;
  recipient_name: string;
  contact_phone: string;
  department_id: string | null;
  method: 'BANK_TRANSFER' | 'EWALLET' | 'QRIS';
};
type CheckoutResult = {
  order_id: string;
  order_number: string;
  total_rp: number;
  expires_at: number;
  mode: 'DEMO';
  payment_status: 'PENDING' | 'PAID' | 'EXPIRED';
};
```

Retry checkout mengembalikan status order terkini, termasuk PAID/EXPIRED, bukan selalu PENDING. expected_total adalah consent guard, bukan otoritas harga. Versi produk/SKU untuk perubahan relevan, bukan counter stok. Perubahan komponen SKU menaikkan versi paket terkait. pickup_version berubah saat instruksi berubah.

| Route | Akses dan hasil |
|---|---|
| POST /api/demo/session | Buat sesi tamu demo, cookie aman dan token CSRF; 10/menit/IP hash sesuai PRD sebelum menerbitkan sesi; jangan membuat role staf |
| GET /api/catalog | Publik, projection katalog aktif |
| POST /api/checkout/create | Sesi+CSRF; hitung server, snapshot/alokasi atomik; 401 sesi, 422 invalid, 409 konflik, 503 DB gagal |
| POST /api/demo/orders/:id/check-payment | Pemilik sesi+CSRF, hanya DEMO environment dan row mode DEMO. PENDING/HELD belum expired menjadi PAID/CONSUMED dan satu invoice atomik; retry PAID mengembalikan hasil sama |
| GET /api/orders dan /api/orders/:id | Pemilik sesi, tidak bocor order sesi lain |
| GET /api/orders/:id/invoice | Pemilik sesi, invoice hanya setelah PAID; JSON projection atau HTML aman berlabel SIMULASI |
| POST /api/orders/:id/pickup-token | Owner, READY/PAID/unclaimed; issue/rotate hash atomik; tiket lama gugur |
| POST /api/staff/orders/:id/ready | Operator staff/admin, PAID/CONSUMED |
| POST /api/staff/pickup/lookup dan /claim | Staff/admin, minimum packing, rate limit; claim READY/PAID/CONSUMED sekali |
| /api/admin/* | Admin demo diprovisioning terpercaya; katalog/stok/settings/audit. Tidak ada SQL/tabel generik atau self-assign role |

Route simulasi tidak terdaftar jika mode bukan DEMO. Verifikasi mode server/config dan row, bukan input browser. Semua mutasi cookie memeriksa Origin+CSRF. API stale read terkait status tidak boleh menjadi otoritas mutasi; gunakan primary D1 untuk demo, read replication ditunda.

## 4. Transaksi D1 dan idempotency

Workers D1 menyediakan `DB.batch()` atomik, bukan transaksi JavaScript interaktif. Tidak memakai BEGIN/COMMIT manual atau menganggap nol row UPDATE sebagai rollback. Semua statement dalam batch disiapkan sebelum eksekusi. Query kandidat di luar batch bukan sumber snapshot final yang dipercaya.

Checkout:
1. Validasi/normalisasi, gabungkan duplicate baris sebelum batas (total tiap baris <=99), urutkan, hash request termasuk metode dan consent. Actor dari sesi.
2. Unique(session_id,checkout_key) menjaga satu draft. Pada concurrent conflict, baca pemenang dan cocokkan hash; berbeda 409, sama return order.
3. Batch memeriksa batas hold aktif (2/sesi, 10/IP hash) dan memvalidasi ulang versi/aktif/total/pickup_version/checkout_enabled serta komposisi, memasukkan snapshot dan komponen dari data yang valid dalam transaksi, mengalokasikan agregat SKU.
4. Guard SQL harus menggagalkan seluruh batch bila salah satu prasyarat gagal. Contoh teknik: trigger RAISE(ABORT, ...) untuk kegagalan guard. `UPDATE ... WHERE available >= need` dengan nol row tanpa error tidak cukup; memeriksa meta.changes sesudah commit tidak bisa membatalkan SKU sebelumnya.
5. Semua snapshot, counter, payment dan order rollback bersama. Uji perubahan versi serentak serta kegagalan komponen kedua wajib.

Konfirmasi demo: satu batch dengan guard owner, mode, PENDING/HELD, waktu < expires_at; kurangi reserved dan on_hand agregat komponen, set PAID/CONSUMED, insert invoice UNIQUE(order_id) dan audit. Duplikat/concurrent check mengembalikan invoice sama setelah membaca state pemenang, tanpa efek stok kedua. Invoice number dibuat server dan collision ditangani tanpa menduplikasi transaksi.

Expiry: routine Worker membatalkan PENDING/HELD yang melewati expires_at, melepaskan reserved sekali; on_hand tidak ditambah. Dipanggil sebelum checkout dan check-payment agar draft kedaluwarsa tidak menahan stok saat demo dipakai; batch terbatas, backlog diproses bertahap. Cron tidak diwajibkan demo. Race expiry vs konfirmasi hanya satu transisi terminal sah.

READY dan claim tidak mengurangi stok lagi. Race claim diserialisasi oleh SQL guards/batch, bukan lock aplikasi memory. Stock adjustment wajib on_hand baru >= reserved dan audit atomik.

## 5. Bukti wajib

Uji lokal SQLite/D1 lalu staging D1 nyata: foreign keys, constraint/trigger, rollback seluruh batch, race SKU terakhir, paket berbagi komponen, key sama/beda, duplicate check, expiry vs check, invoice unik/immutable, claim dua staf, akses sesi lain dan endpoint demo tertutup pada non-demo. Batas batch/query D1 diperiksa terhadap 20 baris × 20 komponen maksimum; jika batas tak cukup, kecilkan batas produk/checkout secara eksplisit, jangan memecah transaksi stok menjadi commit parsial.

Migrations di db/migrations/, versioned, seed SIMULASI terpisah. Wrangler environment/database terpisah. Backup/restore dan uji akses dibutuhkan sebelum demo publik yang menyimpan data; gerbang produksi tambahan di [RELEASE.md](RELEASE.md).
