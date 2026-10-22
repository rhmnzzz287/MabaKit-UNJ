import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import worker from "../../worker/index";
import { TestD1 } from "./d1";
import { seed } from "./db";

const NOW = new Date("2026-10-22T08:00:00Z");

type Env = {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  DB: TestD1;
  APP_MODE: string;
  DEMO_SECRET: string;
  STAFF_DEMO_CODE: string;
  ADMIN_DEMO_CODE: string;
};

let db: TestD1;
let env: Env;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  db = new TestD1();
  seed(db.raw(), NOW.getTime());
  env = {
    ASSETS: { fetch: async () => new Response("spa", { headers: { "content-type": "text/html" } }) },
    DB: db,
    APP_MODE: "demo",
    DEMO_SECRET: "test-secret",
    STAFF_DEMO_CODE: "staff-123",
    ADMIN_DEMO_CODE: "admin-123",
  };
});

afterEach(() => {
  vi.useRealTimers();
});

function call(path: string, init: RequestInit & { cookie?: string; csrf?: string; origin?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.csrf) headers.set("x-csrf", init.csrf);
  headers.set("origin", init.origin ?? "http://localhost");
  return worker.fetch(new Request(`http://localhost${path}`, { ...init, headers }), env as never);
}

async function newSession() {
  const response = await call("/api/demo/session", { method: "POST" });
  const body = (await response.json()) as { csrfToken: string };
  const cookies = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  const cookie = cookies.map((value) => value.split(";")[0]).join("; ");
  return { cookie, csrf: body.csrfToken, response };
}

const payload = (overrides: Record<string, unknown> = {}) => ({
  buyerName: "Siti Rahma",
  recipientName: "Siti Rahma",
  contactPhone: "081234567890",
  departmentId: null,
  method: "QRIS",
  idempotencyKey: "checkout-key-0001",
  items: [{ productId: "p-a", variantId: "v-a", quantity: 2 }],
  ...overrides,
});

async function checkout(session: { cookie: string; csrf: string }, overrides: Record<string, unknown> = {}) {
  return call("/api/checkout/create", {
    method: "POST",
    cookie: session.cookie,
    csrf: session.csrf,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload(overrides)),
  });
}

describe("API sesi & katalog", () => {
  test("membuat sesi demo dengan cookie HttpOnly dan token CSRF", async () => {
    const { response, cookie, csrf } = await newSession();
    expect(response.status).toBe(201);
    expect(cookie).toContain("mbk_sess=");
    expect(cookie).toContain("mbk_csrf=");
    const setCookie = (response.headers.getSetCookie?.() ?? []).join(";");
    expect(setCookie).toMatch(/mbk_sess=[^;]+;.*HttpOnly/i);
    expect(csrf).toHaveLength(32);
  });

  test("katalog publik berisi produk aktif dengan harga server", async () => {
    const response = await call("/api/catalog");
    const body = (await response.json()) as { products: { id: string; priceRp: number; stock: number }[] };
    expect(response.status).toBe(200);
    expect(body.products.map((product) => product.id)).toEqual(["p-a", "p-b", "p-paket"]);
    const paket = body.products.find((product) => product.id === "p-paket");
    expect(paket?.priceRp).toBe(30000);
  });

  test("mutasi tanpa CSRF ditolak", async () => {
    const session = await newSession();
    const response = await call("/api/checkout/create", {
      method: "POST",
      cookie: session.cookie,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload()),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "csrf_failed" });
  });

  test("checkout tanpa sesi ditolak", async () => {
    const response = await call("/api/checkout/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload()),
    });
    expect(response.status).toBe(401);
  });
});

describe("checkout", () => {
  test("membuat draft PENDING + reservasi stok, total dihitung server", async () => {
    const session = await newSession();
    const response = await checkout(session, { totalRp: 1, items: [{ productId: "p-a", variantId: "v-a", quantity: 2 }] });
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      order: { id: string; totalRp: number; paymentStatus: string; expiresAt: number; invoice: null };
    };
    expect(body.order.totalRp).toBe(30000);
    expect(body.order.paymentStatus).toBe("PENDING");
    expect(body.order.expiresAt).toBe(NOW.getTime() + 30 * 60 * 1000);
    expect(body.order.invoice).toBeNull();
    const variant = db.raw().prepare("SELECT stock_reserved FROM variants WHERE id = 'v-a'").get() as {
      stock_reserved: number;
    };
    expect(variant.stock_reserved).toBe(2);
  });

  test("retry dengan idempotency key sama mengembalikan order yang sama", async () => {
    const session = await newSession();
    const first = (await (await checkout(session)).json()) as { order: { id: string } };
    const second = await checkout(session);
    expect(second.status).toBe(200);
    const body = (await second.json()) as { order: { id: string } };
    expect(body.order.id).toBe(first.order.id);
    const count = db.raw().prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number };
    expect(count.n).toBe(1);
  });

  test("stok tidak cukup menghasilkan 409 dan tidak meninggalkan order", async () => {
    const session = await newSession();
    const response = await checkout(session, { items: [{ productId: "p-a", variantId: "v-a", quantity: 5 }] });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "stock_unavailable" });
    const count = db.raw().prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number };
    expect(count.n).toBe(0);
  });

  test("draft HELD ketiga ditolak 409 hold_limit", async () => {
    const session = await newSession();
    expect((await checkout(session, { idempotencyKey: "checkout-key-0001" })).status).toBe(201);
    expect(
      (await checkout(session, { idempotencyKey: "checkout-key-0002", items: [{ productId: "p-b", variantId: "v-b", quantity: 1 }] }))
        .status,
    ).toBe(201);
    const third = await checkout(session, { idempotencyKey: "checkout-key-0003" });
    expect(third.status).toBe(409);
    expect(await third.json()).toMatchObject({ error: "hold_limit" });
  });

  test("checkout ditutup administrator", async () => {
    db.raw().exec("UPDATE store_settings SET checkout_enabled = 0 WHERE id = 1");
    const session = await newSession();
    const response = await checkout(session);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "checkout_disabled" });
  });

  test("bundle memesan komponen dan menolak bila salah satu komponen habis", async () => {
    const session = await newSession();
    db.raw().exec("UPDATE variants SET stock_on_hand = 1 WHERE id = 'v-b'");
    const response = await checkout(session, {
      items: [{ productId: "p-paket", variantId: null, quantity: 1 }],
    });
    expect(response.status).toBe(409);
    db.raw().exec("UPDATE variants SET stock_on_hand = 2 WHERE id = 'v-b'");
    const ok = await checkout(session, {
      idempotencyKey: "checkout-key-0002",
      items: [{ productId: "p-paket", variantId: null, quantity: 1 }],
    });
    expect(ok.status).toBe(201);
    const body = (await ok.json()) as { order: { totalRp: number } };
    expect(body.order.totalRp).toBe(30000);
  });
});

describe("pembayaran demo & invoice", () => {
  test("cek status membuat PAID + invoice sekali walau dipanggil dua kali", async () => {
    const session = await newSession();
    const created = (await (await checkout(session)).json()) as { order: { id: string } };
    const id = created.order.id;
    const paid = await call(`/api/demo/orders/${id}/check-payment`, {
      method: "POST",
      cookie: session.cookie,
      csrf: session.csrf,
    });
    expect(paid.status).toBe(200);
    const paidBody = (await paid.json()) as {
      order: { paymentStatus: string; invoice: { invoiceNumber: string } };
    };
    expect(paidBody.order.paymentStatus).toBe("PAID");
    expect(paidBody.order.invoice.invoiceNumber).toMatch(/^INV-/);

    const again = await call(`/api/demo/orders/${id}/check-payment`, {
      method: "POST",
      cookie: session.cookie,
      csrf: session.csrf,
    });
    expect(again.status).toBe(200);
    const invoices = db.raw().prepare("SELECT COUNT(*) AS n FROM invoices").get() as { n: number };
    expect(invoices.n).toBe(1);
    const stock = db.raw().prepare("SELECT stock_on_hand, stock_reserved FROM variants WHERE id = 'v-a'").get() as {
      stock_on_hand: number;
      stock_reserved: number;
    };
    expect(stock).toEqual({ stock_on_hand: 0, stock_reserved: 0 });
  });

  test("order milik sesi lain tidak bisa dibaca", async () => {
    const owner = await newSession();
    const other = await newSession();
    const created = (await (await checkout(owner)).json()) as { order: { id: string } };
    const response = await call(`/api/orders/${created.order.id}`, { cookie: other.cookie });
    expect(response.status).toBe(404);
  });

  test("invoice memakai snapshot dan watermark SIMULASI", async () => {
    const session = await newSession();
    const created = (await (await checkout(session)).json()) as { order: { id: string } };
    await call(`/api/demo/orders/${created.order.id}/check-payment`, {
      method: "POST",
      cookie: session.cookie,
      csrf: session.csrf,
    });
    db.raw().exec("UPDATE store_settings SET pickup_location_label = 'Lokasi Baru', pickup_version = 2 WHERE id = 1");
    const response = await call(`/api/orders/${created.order.id}/invoice`, { cookie: session.cookie });
    const body = (await response.json()) as {
      invoice: { watermark: string; mode: string; order: { pickup: { label: string }; items: { title: string }[] } };
    };
    expect(body.invoice.mode).toBe("DEMO");
    expect(body.invoice.watermark).toContain("SIMULASI");
    expect(body.invoice.order.pickup.label).toBe("Kampus A Rawamangun");
    expect(body.invoice.order.items[0].title).toBe("Kaos PKKMB");
  });

  test("draft kedaluwarsa melepas stok dan tidak bisa dibayar", async () => {
    const session = await newSession();
    const created = (await (await checkout(session)).json()) as { order: { id: string } };
    vi.setSystemTime(new Date(NOW.getTime() + 31 * 60 * 1000));
    const response = await call(`/api/demo/orders/${created.order.id}/check-payment`, {
      method: "POST",
      cookie: session.cookie,
      csrf: session.csrf,
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "order_expired" });
    const variant = db.raw().prepare("SELECT stock_reserved FROM variants WHERE id = 'v-a'").get() as {
      stock_reserved: number;
    };
    expect(variant.stock_reserved).toBe(0);
  });
});

describe("staff & admin", () => {
  async function operator(role: "staff" | "admin") {
    const session = await newSession();
    const response = await call("/api/demo/operator", {
      method: "POST",
      cookie: session.cookie,
      csrf: session.csrf,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role, code: role === "staff" ? "staff-123" : "admin-123" }),
    });
    expect(response.status).toBe(201);
    return session;
  }

  test("kode operator salah ditolak, kode benar memberi akses", async () => {
    const session = await newSession();
    const bad = await call("/api/demo/operator", {
      method: "POST",
      cookie: session.cookie,
      csrf: session.csrf,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "staff", code: "salah" }),
    });
    expect(bad.status).toBe(403);
    const staff = await operator("staff");
    const list = await call("/api/staff/orders", { cookie: staff.cookie });
    expect(list.status).toBe(200);
  });

  test("staff menandai READY lalu klaim pickup sekali", async () => {
    const staff = await operator("staff");
    const buyer = await newSession();
    const created = (await (await checkout(buyer, { idempotencyKey: "pickup-key-00001" })).json()) as {
      order: { id: string };
    };
    const id = created.order.id;

    const early = await call(`/api/orders/${id}/pickup-token`, {
      method: "POST",
      cookie: buyer.cookie,
      csrf: buyer.csrf,
    });
    expect(early.status).toBe(409);

    await call(`/api/demo/orders/${id}/check-payment`, { method: "POST", cookie: buyer.cookie, csrf: buyer.csrf });
    await call(`/api/staff/orders/${id}/ready`, { method: "POST", cookie: staff.cookie, csrf: staff.csrf });

    const tokenResponse = await call(`/api/orders/${id}/pickup-token`, {
      method: "POST",
      cookie: buyer.cookie,
      csrf: buyer.csrf,
    });
    expect(tokenResponse.status).toBe(201);
    const { token: code } = (await tokenResponse.json()) as { token: string };

    const other = await newSession();
    const hidden = await call(`/api/orders/${id}`, { cookie: other.cookie });
    expect(hidden.status).toBe(404);

    const claim = await call("/api/staff/pickup/claim", {
      method: "POST",
      cookie: staff.cookie,
      csrf: staff.csrf,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: code }),
    });
    expect(claim.status).toBe(200);
    const twice = await call("/api/staff/pickup/claim", {
      method: "POST",
      cookie: staff.cookie,
      csrf: staff.csrf,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: code }),
    });
    expect(twice.status).toBe(409);
  });

  test("admin dapat mengubah stok dan menonaktifkan checkout, audit tercatat", async () => {
    const admin = await operator("admin");
    const adjust = await call("/api/admin/variants/v-a/stock", {
      method: "POST",
      cookie: admin.cookie,
      csrf: admin.csrf,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ onHand: 7 }),
    });
    expect(adjust.status).toBe(200);
    const settings = await call("/api/admin/settings", {
      method: "PATCH",
      cookie: admin.cookie,
      csrf: admin.csrf,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ checkoutEnabled: false }),
    });
    expect(settings.status).toBe(200);
    const summary = (await (await call("/api/admin/summary", { cookie: admin.cookie })).json()) as {
      settings: { checkoutEnabled: boolean };
      variants: { id: string; stockOnHand: number }[];
    };
    expect(summary.settings.checkoutEnabled).toBe(false);
    expect(summary.variants.find((variant) => variant.id === "v-a")?.stockOnHand).toBe(7);
    const audit = (await (await call("/api/admin/audit", { cookie: admin.cookie })).json()) as { logs: { action: string }[] };
    expect(audit.logs.some((log) => log.action === "stock_adjusted")).toBe(true);
  });

  test("admin tidak bisa menurunkan stok di bawah reservasi", async () => {
    const session = await newSession();
    await checkout(session);
    const admin = await operator("admin");
    const response = await call("/api/admin/variants/v-a/stock", {
      method: "POST",
      cookie: admin.cookie,
      csrf: admin.csrf,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ onHand: 1 }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "stock_below_reserved" });
  });
});

describe("batas waktu, replay, dan origin", () => {
  test("draft kedaluwarsa melepas stok untuk sesi lain", async () => {
    const owner = await newSession();
    const created = await checkout(owner, { items: [{ productId: "p-a", variantId: "v-a", quantity: 2 }] });
    expect(created.status).toBe(201);

    vi.setSystemTime(new Date(NOW.getTime() + 31 * 60 * 1000));
    const other = await newSession();
    const body = (await (await call("/api/catalog")).json()) as { products: { id: string; stock: number }[] };
    expect(body.products.find((product) => product.id === "p-a")?.stock).toBe(2);

    const again = await checkout(other, { idempotencyKey: "checkout-key-0002" });
    expect(again.status).toBe(201);
  });

  test("idempotency key sama dengan payload berbeda ditolak 409", async () => {
    const session = await newSession();
    expect((await checkout(session)).status).toBe(201);
    const changed = await checkout(session, { buyerName: "Budi Lain" });
    expect(changed.status).toBe(409);
    expect(await changed.json()).toMatchObject({ error: "conflict" });
  });

  test("dua checkout paralel dengan key sama menghasilkan satu order", async () => {
    const session = await newSession();
    const [first, second] = await Promise.all([checkout(session), checkout(session)]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    const a = (await first.json()) as { order: { id: string } };
    const b = (await second.json()) as { order: { id: string } };
    expect(a.order.id).toBe(b.order.id);
  });

  test("origin lintas situs ditolak", async () => {
    const session = await newSession();
    const response = await call("/api/checkout/create", {
      method: "POST",
      cookie: session.cookie,
      csrf: session.csrf,
      origin: "https://situs-lain.example",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload()),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "origin_rejected" });
  });

  test("kode operator salah dibatasi setelah percobaan berulang", async () => {
    const session = await newSession();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await call("/api/demo/operator", {
        method: "POST",
        cookie: session.cookie,
        csrf: session.csrf,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "admin", code: "kode-salah" }),
      });
      expect(response.status).toBe(403);
    }
    const blocked = await call("/api/demo/operator", {
      method: "POST",
      cookie: session.cookie,
      csrf: session.csrf,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "admin", code: "admin-123" }),
    });
    expect(blocked.status).toBe(429);
  });
});

test("endpoint demo tertutup pada mode non-demo", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/api/demo/session", { method: "POST", headers: { origin: "http://localhost" } }),
    { ...env, APP_MODE: "production" } as never,
  );
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ error: "not_found" });
});
