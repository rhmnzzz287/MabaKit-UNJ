import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// getBuiltinModule menghindari bundler Vite mencoba me-resolve node:sqlite.
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");
type DatabaseSync = InstanceType<typeof DatabaseSync>;

export function openDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  const dir = path.resolve(import.meta.dirname, "../../db/migrations");
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) {
    db.exec(readFileSync(path.join(dir, file), "utf8"));
  }
  return db;
}

/** Emulasi D1 DB.batch(): satu transaksi, rollback penuh bila satu statement gagal. */
export function batch(db: DatabaseSync, statements: { sql: string; params?: unknown[] }[]): void {
  db.exec("BEGIN");
  try {
    for (const statement of statements) {
      const prepared = db.prepare(statement.sql);
      if (statement.params) prepared.run(...(statement.params as never[]));
      else prepared.run();
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** Kata sandi ketiga akun seed, sama dengan backend/db/seed.sql. */
export const SEED_ADMIN_PASSWORD = "admin123";
export const SEED_STAFF_PASSWORD = "staffmabakit123";
export const SEED_BUYER_PASSWORD = "buyermabakit123";

/**
 * Fixture v2: akun (admin/staff/pembeli), katalog fakultas, produk tunggal, dan
 * satu paket dengan konfigurasi fakultas. Harga paket diambil dari bundle_configs,
 * jadi bundle_price_rp sengaja berbeda agar test bisa membedakan sumber harganya.
 */
/**
 * Fixture demo lengkap dari backend/db/seed.sql (akun, paket per fakultas, produk nonaktif).
 * seed.sql masih merujuk id varian yang tidak ada (v-topi-fppsi dan v-topi-fish), jadi FK
 * dimatikan saat menyalin lalu referensinya dibetulkan ke varian yang dimaksud.
 */
export function seedDemo(db: DatabaseSync): void {
  const sql = readFileSync(path.resolve(import.meta.dirname, "../../db/seed.sql"), "utf8");
  db.exec(sql);
  try {
  } finally {
    db.exec("PRAGMA foreign_keys = ON;");
  }
  const broken = db.prepare("PRAGMA foreign_key_check").all();
  if (broken.length > 0) throw new Error(`seed demo tidak konsisten: ${JSON.stringify(broken[0])}`);
}

export function seed(db: DatabaseSync, now = 1_700_000_000_000): void {
  db.exec(`
    INSERT INTO faculties (id, name) VALUES
      ('fac-ft', 'Fakultas Teknik'),
      ('fac-feb', 'Fakultas Ekonomi dan Bisnis');
    INSERT INTO faculty_aliases (alias, faculty_id) VALUES
      ('FT', 'fac-ft'), ('FEB', 'fac-feb');

    INSERT INTO users (id, email, password_hash, role, name, whatsapp, faculty_id, created_at, updated_at) VALUES
      ('usr-admin', 'mabakita@admin', 'pbkdf2$100000$4ca1dcbc8e70a4c8b460eb1a42c6f9ee$2b29c13d5878281b79f270444c281ad3bcd2b77120417bbe6f5efd8892f4e274', 'admin', 'Admin MabaKit', '', NULL, ${now}, ${now}),
      ('usr-staff', 'tim@demo.mabakit', 'pbkdf2$100000$c1bc4b1f53db529f2f382d98578ae49d$ab74eec07b69a714be6ea4d2bd0c82505e139e72d45a974c3ea32dbaaacaee58', 'staff', 'Tim MabaKit', '', NULL, ${now}, ${now}),
      ('usr-buyer', 'pembeli@demo.mabakit', 'pbkdf2$100000$9a93fd26b379403af23ee8d39cdfea0d$9247db6014e90192b3f5e7fc7f6fbc6e3c2af67ca843227f71e6a0903d2ca936', 'buyer', 'Siti Rahma', '081234567890', 'fac-ft', ${now}, ${now});

    INSERT INTO products (id, kind, title, description, active, version, bundle_price_rp, created_at, updated_at)
    VALUES ('p-a', 'single', 'Kaos PKKMB', 'Katun combed 24s', 1, 1, NULL, ${now}, ${now}),
           ('p-b', 'single', 'Topi PKKMB', 'Twill', 1, 1, NULL, ${now}, ${now}),
           ('p-paket', 'bundle', 'Paket Dasar', 'Kaos dan topi', 1, 1, 99000, ${now}, ${now});
    INSERT INTO variants (id, product_id, sku, attributes, price_rp, stock_on_hand, stock_reserved, active, version, created_at, updated_at)
    VALUES ('v-a', 'p-a', 'KAOS-01', '{"ukuran":"M","foto":"/products/kaos.jpg"}', 15000, 2, 0, 1, 1, ${now}, ${now}),
           ('v-b', 'p-b', 'TOPI-01', '{"warna":"Hijau"}', 20000, 2, 0, 1, 1, ${now}, ${now});
    INSERT INTO variant_faculties (variant_id, faculty_id) VALUES
      ('v-a', 'fac-ft'), ('v-a', 'fac-feb'), ('v-b', 'fac-ft');

    INSERT INTO bundle_configs (id, bundle_product_id, faculty_id, price_rp, published, created_at, updated_at)
    VALUES ('cfg-paket-ft', 'p-paket', 'fac-ft', 30000, 1, ${now}, ${now});
    INSERT INTO bundle_config_components (config_id, variant_id, quantity) VALUES
      ('cfg-paket-ft', 'v-a', 1), ('cfg-paket-ft', 'v-b', 2);

    INSERT INTO demo_sessions (id, user_id, token_hash, csrf_hash, client_key_hash, created_at, expires_at)
    VALUES ('s-1', NULL, 'tok1', 'csrf1', 'ip1', ${now}, ${now + 86_400_000});

    INSERT INTO store_settings (id, checkout_enabled, pickup_location_label, pickup_location_details, pickup_service_hours, pickup_version, updated_at)
    VALUES (1, 1, 'Kampus A Rawamangun', 'Gedung Serbaguna, lantai 1', 'Senin-Jumat 09.00-16.00 WIB', 1, ${now});
  `);
}
