import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Env } from "../../src/http";
import { TestD1 } from "./d1";
import { batch, seedDemo } from "./db";
import { ADMIN, BUYER, type Call, type Session, checkoutBody, makeCall, mutate, signIn } from "./harness";

const NOW = new Date("2026-10-22T08:00:00Z");

let db: TestD1;
let env: Env;
let call: Call;
const objects = new Map<string, { bytes: Uint8Array; type: string }>();
const media = {
  put: async (key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }) => {
    objects.set(key, { bytes: value, type: options?.httpMetadata?.contentType ?? "application/octet-stream" });
  },
  get: async (key: string) => {
    const row = objects.get(key);
    return row ? { body: row.bytes, httpMetadata: { contentType: row.type }, httpEtag: `"${key}"` } : null;
  },
  delete: async (key: string) => {
    objects.delete(key);
  },
};

const png = (width = 1, height = 1) =>
  new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
    (width >>> 24) & 255, (width >>> 16) & 255, (width >>> 8) & 255, width & 255,
    (height >>> 24) & 255, (height >>> 16) & 255, (height >>> 8) & 255, height & 255,
    8, 6, 0, 0, 0,
  ]);

beforeEach(() => {
  objects.clear();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  db = new TestD1();
  seedDemo(db.raw());
  env = {
    ASSETS: { fetch: async () => new Response("spa", { headers: { "content-type": "text/html" } }) },
    DB: db as unknown as D1Database,
    APP_MODE: "demo",
    DEMO_SECRET: "test-secret",
    APP_ORIGIN: "https://mabakit.test",
    MEDIA: media as unknown as R2Bucket,
  };
  call = makeCall(env);
});

afterEach(() => {
  vi.useRealTimers();
});

async function signInAs(account: { email: string; password: string }): Promise<Session> {
  const { session, response } = await signIn(call, account);
  expect(response.status).toBe(200);
  return session;
}

/** Dua request paralel bisa sama-sama lolos read sebelum insert, jadi guard diuji langsung di transaksi. */
function insertFreeOrder(sequence: number): void {
  const id = `ord-free-${sequence}`;
  db.raw().exec(`
    INSERT INTO demo_sessions (id, user_id, token_hash, csrf_hash, client_key_hash, created_at, expires_at)
    VALUES ('s-free-${sequence}', 'usr-buyer', 'tok-free-${sequence}', 'csrf-free-${sequence}', 'ip-free-${sequence}', ${NOW.getTime()}, ${NOW.getTime() + 86_400_000});
  `);
  db.raw()
    .prepare(
      `INSERT INTO orders (id, order_number, session_id, user_id, checkout_key, request_hash, buyer_name,
         recipient_name, contact_phone, pickup_instructions_snapshot, total_rp, amount_due_rp,
         payment_status, fulfillment_status, stock_allocation_status, created_at, expires_at)
       VALUES (?, ?, ?, 'usr-buyer', ?, 'hash', 'Siti Rahma', 'Siti Rahma', '081234567890', '{}', 1, 0,
         'PAID', 'UNFULFILLED', 'CONSUMED', ?, ?)`,
    )
    .run(id, `MBK-FREE-${sequence}`, `s-free-${sequence}`, `free-key-${sequence}`, NOW.getTime(), NOW.getTime() + 1_800_000);
}

describe("B03 batas pesanan gratis atomik", () => {
  test("trigger menolak pesanan gratis ketiga pada jam yang sama", () => {
    insertFreeOrder(1);
    insertFreeOrder(2);
    expect(() => insertFreeOrder(3)).toThrow(/free_limit/);
    expect(
      db.raw().prepare("SELECT COUNT(*) AS n FROM orders WHERE user_id = 'usr-buyer' AND amount_due_rp = 0").get(),
    ).toEqual({ n: 2 });
  });

  test("checkout gratis melewati batas ditolak 429 dan replay tetap 200", async () => {
    const admin = await signInAs(ADMIN);
    const buyer = await signInAs(BUYER);
    await call("/api/admin/products/p-topi", mutate(admin, { discountBasisPoints: 10000 }, "PATCH"));
    const freeBody = checkoutBody({
      idempotencyKey: "checkout-free-replay",
      method: "QRIS",
      items: [{ productId: "p-topi", variantId: "v-topi-ft", quantity: 1 }],
    });

    expect((await call("/api/checkout/create", mutate(buyer, freeBody))).status).toBe(201);
    insertFreeOrder(1);

    // Replay key yang sudah ada tidak boleh terkena batas baru.
    expect((await call("/api/checkout/create", mutate(buyer, freeBody))).status).toBe(200);

    const third = await call(
      "/api/checkout/create",
      mutate(buyer, { ...freeBody, idempotencyKey: "checkout-free-0003" }),
    );
    expect(third.status).toBe(429);
    expect(await third.json()).toMatchObject({ error: "free_limit" });
    expect(
      db.raw().prepare("SELECT COUNT(*) AS n FROM orders WHERE user_id = 'usr-buyer' AND amount_due_rp = 0").get(),
    ).toEqual({ n: 2 });
  });

  test("replay idempotensi paralel tetap 200 walau trigger gratis sempat menolak", async () => {
    const admin = await signInAs(ADMIN);
    const buyer = await signInAs(BUYER);
    await call("/api/admin/products/p-topi", mutate(admin, { discountBasisPoints: 10000 }, "PATCH"));
    insertFreeOrder(1);
    const body = checkoutBody({
      idempotencyKey: "checkout-free-race",
      method: "QRIS",
      items: [{ productId: "p-topi", variantId: "v-topi-ft", quantity: 1 }],
    });

    // Dua request ini bisa sama-sama lolos read sebelum insert; yang kalah trigger
    // harus memutar ulang lewat hash idempotensi, bukan mengembalikan 429.
    const [first, second] = await Promise.all([
      call("/api/checkout/create", mutate(buyer, body)),
      call("/api/checkout/create", mutate(buyer, body)),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(
      db.raw()
        .prepare("SELECT COUNT(*) AS n FROM orders WHERE user_id = 'usr-buyer' AND checkout_key = 'checkout-free-race'")
        .get(),
    ).toEqual({ n: 1 });
  });
});

describe("B05/B07 batas body dan tanggal ekspor", () => {
  test("body JSON di atas 32 KB ditolak", async () => {
    const buyer = await signInAs(BUYER);
    const huge = await call("/api/profile", mutate(buyer, { name: "x".repeat(40_000) }, "PATCH"));
    expect(huge.status).toBe(400);
    expect(await huge.json()).toMatchObject({ error: "invalid_payload" });
  });

  test("unggahan di atas 5 MiB ditolak sebelum dibuffer penuh", async () => {
    const admin = await signInAs(ADMIN);
    const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
    const response = await call("/api/admin/products/p-topi/photos", {
      method: "POST",
      cookie: admin.cookie,
      csrf: admin.csrf,
      headers: { "content-type": "image/png" },
      body: oversized,
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_payload", field: "file" });
  });

  test("tanggal ekspor tak nyata ditolak", async () => {
    const admin = await signInAs(ADMIN);
    const response = await call("/api/admin/export/sales.csv?from=2026-02-30", {
      cookie: admin.cookie,
      csrf: admin.csrf,
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_payload" });
  });
});

describe("B06 sampul dari foto pertama", () => {
  test("unggah kedua tidak menggantikan sampul pertama", async () => {
    const admin = await signInAs(ADMIN);
    const first = await call("/api/admin/products/p-topi/photos", {
      method: "POST",
      cookie: admin.cookie,
      csrf: admin.csrf,
      headers: { "content-type": "image/png" },
      body: png(4, 3),
    });
    expect(first.status).toBe(201);
    await call("/api/admin/products/p-topi/photos", {
      method: "POST",
      cookie: admin.cookie,
      csrf: admin.csrf,
      headers: { "content-type": "image/png" },
      body: png(2, 2),
    });

    const catalog = (await (await call("/api/admin/catalog", { cookie: admin.cookie })).json()) as {
      products: { id: string; imagePath: string | null; photos: { url: string }[] }[];
    };
    const topi = catalog.products.find((product) => product.id === "p-topi");
    expect(topi?.photos).toHaveLength(2);
    expect(topi?.imagePath).toBe(topi?.photos[0]?.url);
  });
});

describe("B04 versi konfigurasi paket", () => {
  test("checkout menyimpan versi konfigurasi dan batch menolak versi basi", async () => {
    const admin = await signInAs(ADMIN);
    const buyer = await signInAs(BUYER);

    const created = await call(
      "/api/checkout/create",
      mutate(buyer, checkoutBody({ items: [{ productId: "p-paket-fip", facultyId: "fac-fip", quantity: 1 }] })),
    );
    expect(created.status).toBe(201);
    const orderId = ((await created.json()) as { order: { id: string } }).order.id;
    const captured = db.raw()
      .prepare(
        `SELECT oi.bundle_config_version, c.version AS current_version
         FROM order_items oi JOIN bundle_configs c ON c.bundle_product_id = oi.product_id AND c.faculty_id = 'fac-fip'
         WHERE oi.order_id = ?`,
      )
      .get(orderId) as { bundle_config_version: number; current_version: number };
    expect(captured.bundle_config_version).toBe(captured.current_version);

    const saved = await call(
      "/api/admin/packages/p-paket-fip/configs/fac-fip",
      mutate(admin, { priceRp: 32000, published: true, components: [{ variantId: "v-kauskaki", quantity: 1 }] }, "PUT"),
    );
    expect(saved.status).toBe(200);
    const current = db.raw().prepare("SELECT version FROM bundle_configs WHERE id = 'cfg-p-paket-fip-fac-fip'").get() as {
      version: number;
    };
    expect(current.version).toBe(captured.current_version + 1);

    // Simulasikan checkout yang membaca versi lama lalu commit setelah admin menyimpan konfigurasi baru.
    const productVersion = (
      db.raw().prepare("SELECT version FROM products WHERE id = 'p-paket-fip'").get() as { version: number }
    ).version;
    db.raw().exec(`
      INSERT INTO demo_sessions (id, user_id, token_hash, csrf_hash, client_key_hash, created_at, expires_at)
      VALUES ('s-stale', 'usr-buyer', 'tok-stale', 'csrf-stale', 'ip-stale', ${NOW.getTime()}, ${NOW.getTime() + 86_400_000});
    `);
    const stalePrice = 30000;
    expect(() =>
      batch(db.raw(), [
        {
          sql: `INSERT INTO orders (id, order_number, session_id, user_id, checkout_key, request_hash, buyer_name,
                  recipient_name, contact_phone, pickup_instructions_snapshot, total_rp, amount_due_rp,
                  payment_status, fulfillment_status, stock_allocation_status, created_at, expires_at)
                VALUES ('ord-stale', 'MBK-STALE-0001', 's-stale', 'usr-buyer', 'stale-key', 'hash',
                  'Siti Rahma', 'Siti Rahma', '081234567890', '{}', ?, ?, 'PENDING', 'UNFULFILLED', 'HELD', ?, ?)`,
          params: [stalePrice, stalePrice, NOW.getTime(), NOW.getTime() + 1_800_000],
        },
        {
          sql: `INSERT INTO order_items (id, order_id, product_id, variant_id, title_snapshot, attributes_snapshot,
                  catalog_version, variant_version, bundle_config_version, quantity, unit_price_rp, line_total_rp,
                  base_unit_price_rp, discount_basis_points, charged_unit_price_rp, charged_line_total_rp)
                VALUES ('oi-stale', 'ord-stale', 'p-paket-fip', NULL, 'Paket', '{}', ?, NULL, ?, 1, ?, ?, ?, 0, ?, ?)`,
          params: [productVersion, captured.bundle_config_version, stalePrice, stalePrice, stalePrice, stalePrice, stalePrice],
        },
      ]),
    ).toThrow(/catalog_changed/);
    expect(db.raw().prepare("SELECT COUNT(*) AS n FROM orders WHERE id = 'ord-stale'").get()).toEqual({ n: 0 });
  });
});