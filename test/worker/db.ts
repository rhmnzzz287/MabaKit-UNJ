import { readFileSync } from "node:fs";
import path from "node:path";

// getBuiltinModule menghindari bundler Vite mencoba me-resolve node:sqlite.
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");
type DatabaseSync = InstanceType<typeof DatabaseSync>;

export function openDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(path.resolve("db/migrations/0001_init.sql"), "utf8"));
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

export function seed(db: DatabaseSync, now = 1_700_000_000_000): void {
  db.exec(`
    INSERT INTO store_settings (id, checkout_enabled, pickup_location_label, pickup_location_details, pickup_service_hours, pickup_version, updated_at)
    VALUES (1, 1, 'Kampus A Rawamangun', 'Gedung Serbaguna, lantai 1', 'Senin-Jumat 09.00-16.00 WIB', 1, ${now});
    INSERT INTO products (id, kind, title, description, active, version, bundle_price_rp, created_at, updated_at)
    VALUES ('p-a', 'single', 'Kaos PKKMB', 'Katun combed 24s', 1, 1, NULL, ${now}, ${now}),
           ('p-b', 'single', 'Topi PKKMB', 'Twill', 1, 1, NULL, ${now}, ${now}),
           ('p-paket', 'bundle', 'Paket Dasar', 'Kaos dan topi', 1, 1, 30000, ${now}, ${now});
    INSERT INTO variants (id, product_id, sku, attributes, price_rp, stock_on_hand, stock_reserved, active, version, created_at, updated_at)
    VALUES ('v-a', 'p-a', 'KAOS-01', '{"ukuran":"M"}', 15000, 2, 0, 1, 1, ${now}, ${now}),
           ('v-b', 'p-b', 'TOPI-01', '{"warna":"Hijau"}', 20000, 2, 0, 1, 1, ${now}, ${now});
    INSERT INTO bundle_components (bundle_product_id, variant_id, quantity)
    VALUES ('p-paket', 'v-a', 1), ('p-paket', 'v-b', 2);
    INSERT INTO demo_sessions (id, token_hash, csrf_hash, client_key_hash, created_at, expires_at)
    VALUES ('s-1', 'tok1', 'csrf1', 'ip1', ${now}, ${now + 86_400_000}),
           ('s-2', 'tok2', 'csrf2', 'ip2', ${now}, ${now + 86_400_000});
  `);
}
