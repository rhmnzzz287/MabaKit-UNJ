# Schema dan kontrak transaksi: MabaKit

Revisi: 22 Oktober 2026. Spesifikasi PostgreSQL Supabase, **bukan migrasi SQL siap dijalankan**. Implementer harus membuat migrasi, constraints, grants, RLS dan uji database nyata dari kontrak ini. Status bersama mengikuti [PRD.md](PRD.md).

Schema mendukung penjualan barang dari katalog sampai penyerahan, bukan booking/reservasi. Tidak ada tabel slot, kapasitas kunjungan atau jadwal yang dipilih pembeli. `stock_allocation_status` mencatat pengaman stok internal selama pembayaran, bukan hak memesan barang untuk nanti.

## 1. Konvensi dan invariant

- PK `uuid` dibuat server; waktu `timestamptz` UTC, tampilan `Asia/Jakarta` (WIB). Semua FK terindeks. Nominal `bigint` integer rupiah, tidak float; batas checkout Rp10.000.000. Quantity integer positif.
- Identitas akun dari `auth.users.id`; jangan menerima `user_id` aktor dari browser. Tidak ada penghapusan cascade dari akun ke pesanan finansial. Relasi akun pesanan boleh `SET NULL` lewat proses privasi terkontrol; snapshot mengikuti kebijakan retensi.
- SKU stok: `stock_on_hand >= 0`, `0 <= stock_reserved <= stock_on_hand`. Available = on_hand - reserved. Barang terjual dikurangi dari on_hand saat pembayaran dikonsumsi, bukan saat pickup.
- Satu order, satu payment attempt. Alokasi stok hanya HELD, CONSUMED, RELEASED; transisi keluar HELD sekali. Paket tidak memiliki stok sendiri.
- Lokasi dan jam pengambilan merupakan informasi operasional toko, disnapshot saat checkout tanpa counter atau penguncian kapasitas. Perubahan informasi tidak menimpa snapshot pesanan lama; operator memberi tahu pembeli terdampak.
- Tidak ada update langsung terhadap counter/status dari client. Seluruh mutasi sensitif lewat transaksi terpercaya. Snapshot finansial dan komponen tidak boleh diubah setelah checkout.

## 2. Tabel

Notasi `?` nullable; selain itu NOT NULL. Semua tabel memiliki `created_at`; tabel mutable juga `updated_at`. Hard delete katalog/order yang sudah dipakai dilarang.

| Tabel | Kolom utama dan constraint |
|---|---|
| `profiles` | `user_id uuid PK FK auth.users`, `display_name text?` maksimal 100; tidak menyimpan role atau NIM |
| `user_roles` | `user_id uuid PK FK auth.users`, `role text CHECK IN ('staff','admin')`; tidak ada row berarti customer. Hanya operasi admin terpercaya dapat assign; bootstrap admin lewat SQL terkontrol dan audit |
| `faculties` | `id`, `name`, `active boolean`; nama aktual diisi setelah verifikasi |
| `departments` | `id`, `faculty_id FK`, `name`, `active`; unique `(id,faculty_id)` untuk validasi pasangan |
| `spec_checklists` | `id`, `department_id FK`, `academic_year text`, `content text`, `source_ref text`, `verified_at timestamptz?`, `published boolean`; published mensyaratkan verified_at, source_ref dan tahun nonkosong. Ini panduan bersumber, bukan bukti otorisasi kampus |
| `products` | `id`, `kind text CHECK IN ('single','bundle')`, `title`, `description`, `image_path?`, `active`, `version integer > 0`, `bundle_price_rp bigint?`; single memiliki price null, bundle price >0 |
| `variants` | `id`, `product_id FK`, `sku text UNIQUE`, `attributes jsonb object`, `price_rp bigint >0`, `stock_on_hand integer >=0`, `stock_reserved integer >=0`, `active`, `version integer >0`; hanya milik single; reserved <= on_hand |
| `bundle_components` | `bundle_product_id FK products`, `variant_id FK variants`, `quantity integer 1..99`, PK `(bundle_product_id,variant_id)`; induk wajib bundle, komponen wajib single. Paket published punya 1..20 komponen. Constraint lintas tabel melalui trigger/mutator terpercaya |
| `orders` | `id`, `order_number text UNIQUE`, `user_id uuid? FK auth.users`, `checkout_key uuid`, `request_hash text`, `buyer_name`, `recipient_name`, `contact_phone`, `department_id? FK`, `pickup_instructions_snapshot jsonb`, `total_rp bigint CHECK BETWEEN 1 AND 10000000`, `payment_status`, `fulfillment_status`, `stock_allocation_status`, `expires_at`, `paid_at?`, `ready_at?`, `picked_up_at?`, `picked_up_by uuid?`; UNIQUE `(user_id,checkout_key)`; snapshot lokasi dan jam layanan WIB wajib, tanpa waktu pesanan individual |
| `order_items` | `id`, `order_id FK`, `product_id FK`, `variant_id? FK`, `title_snapshot`, `attributes_snapshot jsonb`, `catalog_version integer`, `quantity integer 1..99`, `unit_price_rp bigint >0`, `line_total_rp bigint`; CHECK line_total = quantity × unit_price; single wajib variant sesuai product; bundle variant null. Immutable |
| `order_components` | `order_item_id FK`, `variant_id FK`, `sku_snapshot`, `title_snapshot`, `attributes_snapshot jsonb`, `quantity integer >0`, PK `(order_item_id,variant_id)`; quantity sudah dikalikan jumlah order_item. Single juga menghasilkan komponen. Dipakai packing dan agregasi stok. Immutable |
| `payments` | `order_id uuid PK FK orders`, `gateway_order_id text UNIQUE`, `provider_transaction_id text? UNIQUE`, `snap_token text?`, `redirect_url text?`, `provider_status text?`, `provider_fraud_status text?`, `creation_state text CHECK IN ('CREATING','AVAILABLE','UNCERTAIN','CLOSED')`, `next_check_at`, `check_attempts integer DEFAULT 0`, `lease_until?`, `last_checked_at?`, `last_error_code?`; token dibatasi server, bukan tabel publik |
| `pickup_tickets` | `order_id uuid PK FK orders`, `token_hash text UNIQUE`, `issued_at`, `claimed_at?`, `claimed_by uuid?`; token acak CSPRNG 128 bit minimum, kode tampilan Base32 26 karakter. Simpan hash; plaintext tidak dicatat dalam log |
| `refunds` | `id`, `order_id FK`, `amount_rp bigint >0`, `reason`, `status text CHECK IN ('REQUESTED','CONFIRMED','FAILED')`, `provider_ref text?`, `evidence_ref text?` (reference terlindungi, bukan bucket publik), `requested_by uuid`, `confirmed_by uuid?`, `confirmed_at?`; satu refund CONFIRMED penuh per order melalui unique partial index. Jumlah wajib = total untuk rilis pertama |
| `audit_logs` | `id`, `actor_id uuid?`, `action`, `entity_type`, `entity_id uuid`, `safe_metadata jsonb`, `request_id`; append-only, tanpa token/kontak/payload provider mentah |
| `store_settings` | satu row `id boolean PK CHECK(id)`, `checkout_enabled boolean DEFAULT false`, `pickup_location_label text`, `pickup_location_details text`, `pickup_service_hours text`, `pickup_version integer >0`; informasi nonkosong wajib sebelum checkout dibuka. Admin saja mengubah; version naik ketika instruksi berubah; tidak menyimpan secret gateway |

Untuk pemulihan token pickup: token plaintext tidak perlu disimpan. Pemilik order dapat meminta penerbitan ulang saat READY; hash lama diganti atomik dan tiket lama tidak berlaku. Endpoint menerbitkan token saat pertama READY hanya ketika pemilik meminta; staf menandai READY tidak perlu mengetahui token. Jika sudah claimed, penerbitan ulang ditolak. ID order/nomor order bukan bukti hak pickup.

### Constraint lintas row/tabel

Mutator DB terpercaya dan trigger penjaga memastikan:

- `orders.total_rp = SUM(order_items.line_total_rp)`, 1..20 baris, minimal satu komponen; perubahan child sesudah transaksi checkout ditolak.
- Snapshot komponen single sesuai variant; bundle sesuai komposisi/version yang dibaca checkout. Variant wajib aktif dan milik produk yang benar.
- Masuk READY dan klaim PICKED_UP memerlukan PAID dan CONSUMED. Setelah penyerahan, PICKED_UP dan claimed_at/by serta picked_up_at/by tetap sebagai sejarah meskipun pembayaran menjadi REVIEW/REFUNDED. Klaim baru tidak boleh berjalan jika refund/sengketa aktif. READY yang masuk REVIEW tidak dapat diklaim sampai masalah selesai.
- Pembayaran lunas setelah RELEASED hanya REVIEW dan tidak dapat fulfilled. REVIEW dari HELD menahan alokasi stok; REVIEW dari CONSUMED tidak mengulang konsumsi. Operator menyelesaikan REVIEW memakai hasil provider terverifikasi: PAID hanya jika HELD/CONSUMED dan dana sah, FAILED/EXPIRED hanya bila HELD serta nonpaid definitif, REFUNDED setelah bukti refund. REVIEW dari RELEASED tidak dapat menjadi PAID; refund terkonfirmasi tidak mengubah stok yang sudah dilepas. CHECK status/state ditambah fungsi transisi, bukan enum saja.
- Penyesuaian on_hand tidak boleh lebih rendah dari reserved; pembatalan/refund tidak memulihkan stok dua kali.

Indeks tambahan: `orders(user_id,created_at DESC)`, `orders(payment_status,expires_at)`, `orders(fulfillment_status,created_at)`, `payments(next_check_at)` untuk pekerjaan due, `order_items(order_id)`, `order_components(variant_id)`, `audit_logs(entity_id,created_at)`.

## 3. Boundary API dan fungsi

Type kontrak konseptual TypeScript berikut dipakai seluruh implementasi:

```ts
type CheckoutItem = {
  product_id: string;
  variant_id: string | null;
  quantity: number;
  product_version: number;
  variant_version: number | null;
};
type CheckoutInput = {
  checkout_key: string;
  items: CheckoutItem[];
  expected_total_rp: number;
  buyer_name: string;
  recipient_name: string;
  contact_phone: string;
  department_id: string | null;
  pickup_version: number;
};
type CheckoutResult = {
  order_id: string;
  order_number: string;
  total_rp: number;
  expires_at: string;
  state: 'PAYMENT_AVAILABLE' | 'PAYMENT_PROCESSING';
  snap_token: string | null;
};
```

`expected_total_rp` adalah consent guard, bukan harga otoritatif. Snapshot dari server menentukan total. Versi produk meningkat untuk perubahan informasi/harga/komposisi relevan; versi SKU untuk perubahan atribut/harga/aktif, **bukan** counter stok. `pickup_version` mencocokkan informasi pengambilan yang sudah dilihat pembeli dengan `store_settings`; bukan pilihan jadwal. Perubahan instruksi memerlukan persetujuan ulang seperti perubahan harga. Komposisi paket dikunci saat checkout terhadap edit admin serentak. Perubahan atribut/aktif SKU komponen yang memengaruhi pembelian juga menaikkan version seluruh paket terkait, sehingga perubahan isi dengan harga tetap tetap memerlukan persetujuan ulang. Mutator katalog mengunci semua produk induk terkait berurutan sebelum SKU, sama seperti checkout.

| Operasi | Boundary dan hasil |
|---|---|
| `create-payment(input: CheckoutInput): Promise<CheckoutResult>` | Edge Function JWT user; validasi, rate limit, panggil `begin_checkout`, kemudian Snap. 401 auth; 422 input; 409 stock/price/version/idempotency conflict; 503 provider ambigu disertai order_id aman untuk recovery |
| `begin_checkout(p_actor uuid, p_input jsonb) RETURNS uuid` | RPC hanya service_role; aktor hasil JWT terverifikasi. Validasi, snapshot, alokasi stok dalam satu transaksi; hasil order id |
| `apply_payment_result(p_order_id uuid, p_verified jsonb) RETURNS text` | RPC service_role saja; payload internal hasil Status API terverifikasi, bukan JSON browser. Lock order dan efek stok; idempotent |
| `reconcile-payments(): Promise<void>` | Job terjadwal server satu menit, memakai logika provider sama dengan webhook. Maksimum 50 due per batch. Endpoint job wajib secret scheduler, bukan JWT pelanggan |
| `mark_ready(p_order_id uuid) RETURNS void` | Authenticated RPC, actor `auth.uid()`, role staff/admin; cek PAID/CONSUMED, bukan cancelled/refund/review |
| `issue_pickup_token(p_order_id uuid) RETURNS text` | Authenticated RPC owner saja, READY/PAID/unclaimed. Menghasilkan token baru atau rotasi; audit, tidak mengungkap hash |
| `lookup_pickup(p_token text) RETURNS jsonb` | Authenticated staff/admin saja; hash token, return snapshot packing minimum. Rate limit server-side; tidak publik |
| `claim_pickup(p_order_id uuid, p_token text) RETURNS jsonb` | Authenticated staff/admin, token cocok dan READY/PAID/CONSUMED. Lock order/ticket; klaim sekali dan update status satu transaksi. Retry klaim yang sudah selesai memberi konflik dengan waktu/staf penyerahan, bukan sukses kedua |
| `record_refund(p_order_id uuid, p_status text, p_provider_ref text, p_reason text, p_evidence_ref text) RETURNS uuid` | Authenticated admin dengan MFA; bukti wajib untuk CONFIRMED, full refund saja, audit. Bukan pemanggil gateway otomatis |
| `adjust_stock(p_variant_id uuid, p_delta integer, p_reason text) RETURNS void` | Authenticated admin; lock row, cek on_hand baru >= reserved; audit delta dan alasan |

Operasi admin lain mengikuti aturan sama: role dari DB, MFA, transaksi, validasi dan audit; bukan fungsi generik menerima nama tabel bebas. `SECURITY DEFINER` hanya bila perlu, set search_path tetap, nama tabel schema-qualified, REVOKE EXECUTE dari PUBLIC/anon dan grant eksplisit per fungsi. P_actor tidak tersedia pada RPC pelanggan/staf. Service-role melewati RLS sehingga handler wajib cek aktor dan kepemilikan.

## 4. Transaksi checkout dan recovery

1. Validasi body, JWT, quantity, kontak dan key. Hash request yang dikanonisasi (baris duplicate digabung sebelum batas; urut berdasarkan product/variant; nama trim; telepon normal). Sama key + sama hash mengembalikan order lama, termasuk terminal; sama key + beda hash = 409. Total gabungan per baris tetap maksimal 99.
2. Serialisasi key menggunakan transaction advisory lock berdasarkan user/key ditambah UNIQUE constraint. Untuk checkout baru, lock row pengaturan toko sebelum produk/SKU agar penutupan checkout dan perubahan instruksi terserialisasi. Serialisasi katalog terhadap edit: lock produk berurutan UUID lalu SKU berurutan UUID; admin memakai urutan yang sama. Expand paket, jumlahkan kebutuhan SKU seluruh baris.
3. Lock SKU dan cek semuanya. Validasi active/version/expected_total serta pengaturan checkout aktif dengan instruksi pengambilan lengkap dan `pickup_version` cocok. `stock_reserved += need`; snapshot instruksi, insert order (alokasi HELD), item, component, payment. Jika satu cek gagal, rollback semua. Tidak melakukan panggilan gateway dalam transaksi ini.
4. Gateway_order_id unik ditentukan dari order UUID, dipakai terus untuk Snap dan lookup. Claim lease creation di DB mencegah dua request Snap serentak. Retry saat lease aktif hanya return state PROCESSING. Jika token sudah tersedia, kembalikan token lama ke pemilik.
5. Setelah respons Snap, simpan token sebagai server-only dan return ke pemilik. Jika timeout/crash, creation_state UNCERTAIN, worker memeriksa Status API sebelum retry. Bila status belum diketahui, jangan membuat reference baru atau melepas alokasi stok. Kasus yang tidak bisa dipulihkan otomatis masuk review operator.

## 5. Konsumsi dan pelepasan alokasi stok

Semua operasi lifecycle memakai urutan lock order, SKU berurutan, lalu ticket bila ada. Checkout baru belum mempunyai order bersama; admin katalog memakai produk lalu SKU, tanpa mengunci order lain sesudahnya. Checkout membaca satu versi pengaturan toko yang konsisten untuk flag buka/tutup dan snapshot instruksi; perubahan serentak terserialisasi pada row pengaturan sebelum lock produk/SKU. Mutator pengaturan tidak mengunci order. Uji deadlock dan retry transaksi serialization/deadlock secara terbatas dengan key yang sama, bukan efek baru.

- PAID dari HELD: untuk setiap agregat komponen, `stock_reserved -= qty`, `stock_on_hand -= qty`; alokasi CONSUMED, payment PAID, paid_at. Semua satu transaksi.
- FAILED/EXPIRED definitif dari HELD: `stock_reserved -= qty`; alokasi RELEASED, fulfillment CANCELLED, payment terminal. Pemanggilan ulang no-op.
- PAID notification dari CONSUMED: no-op finansial; tidak mengubah fulfillment yang sudah READY/PICKED_UP.
- Settlement dari RELEASED: payment REVIEW; audit dan alarm; tidak mengalokasikan ulang stok.
- Refund CONFIRMED penuh dari HELD: kurangi stock_reserved sekali, set RELEASED/CANCELLED dan payment REFUNDED; jangan menambah on_hand. Dari RELEASED: cukup REFUNDED, tanpa efek counter.
- Refund CONFIRMED penuh sebelum pickup: jika CONSUMED dan fulfillment belum CANCELLED, kembalikan on_hand komponen sekali, fulfillment CANCELLED, payment REFUNDED. Alokasi tetap CONSUMED sebagai sejarah pembayaran. Guard transisi/audit mencegah restock ulang.
- Refund sesudah PICKED_UP: payment REFUNDED tetapi fulfillment tetap PICKED_UP dan counter stok tidak diubah. Barang yang benar-benar kembali diproses adjust_stock dengan bukti terpisah.
- Klaim pickup vs refund diserialisasi oleh lock order yang sama. REQUESTED refund memblokir klaim sampai FAILED atau CONFIRMED. Jika pemenuhan tidak memungkinkan, operator menghubungi pembeli untuk penyelesaian/refund sesuai kebijakan dan persetujuan pembeli.

Rekonsiliasi periodik membandingkan counter `stock_reserved` dengan agregat komponen order HELD. Perbedaan memicu alarm dan pause checkout; jangan memperbaiki counter otomatis tanpa investigasi.

## 6. Matriks akses

Semua tabel di atas RLS enabled, grants minimum, deny by default. Tidak ada policy customer `FOR ALL` untuk order/profil ber-role.

| Data / operasi | Anon | Customer | Staff | Admin |
|---|---|---|---|---|
| Katalog aktif, varian atribut/harga, instruksi pengambilan publik, checklist published | Read field publik | Read | Read | Mutator terkontrol |
| Jumlah stok internal, supplier/biaya | Tidak | Tidak | Read minimum operasional | Read + mutator |
| Profil | Tidak | Read/update display_name sendiri | Sendiri | Tidak otomatis semua profil |
| user_roles | Tidak | Tidak | Read role sendiri via helper | Assign/revoke server, MFA, audit |
| orders/items/components | Tidak | Read milik sendiri, tanpa secret | View operasional minimum | View operasional/admin |
| payments | Tidak | Tidak direct; status/snap hanya endpoint owner | Tidak | View status teredaksi |
| pickup_tickets | Tidak | Tidak direct; issue endpoint owner | Lookup/claim RPC | Lookup/claim RPC |
| refunds/audit_logs/settings internal | Tidak | Status refund order sendiri melalui projection | Tidak kecuali status operasional | View teredaksi + mutator |
| begin_checkout/apply_payment_result | Tidak | Tidak | Tidak | Tidak lewat client; service_role saja |

Gunakan view/projection field publik, bukan `SELECT *` yang membocorkan kolom. RLS membatasi row, **bukan** otomatis melindungi kolom. Revokasi base-table read yang tidak perlu dan view `security_invoker`/RPC terproteksi wajib diuji dengan JWT nyata. Staf tidak melihat semua nomor telepon secara default; kontak hanya operator/admin sesuai kebutuhan. Supabase Storage publik hanya foto produk berizin; tidak ada tiket atau dokumen pelanggan di bucket publik.

## 7. Migrasi dan bukti

Urutan implementasi: tabel/constraints/indexes, fungsi transactional, RLS/grants/views, seed simulasi terpisah, pengujian concurrency dan integrasi. Bukan menyalin SQL parsial draf lama. Versi migrasi dilacak, staging dan produksi terpisah, perubahan destruktif tidak otomatis.

[RELEASE.md](RELEASE.md) memuat uji keamanan dan race yang wajib. Tidak ada label PASS sebelum migrasi serta uji benar-benar dijalankan.
