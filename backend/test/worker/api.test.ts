import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Env } from "../../src/http";
import { TestD1 } from "./d1";
import { seedDemo } from "./db";
import {
  ADMIN,
  BUYER,
  STAFF,
  type Call,
  type Session,
  checkoutBody,
  guestSession,
  makeCall,
  mutate,
  readSession,
  signIn,
} from "./harness";

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

type OrderBody = {
  order: {
    id: string;
    orderNumber: string;
    buyerName: string;
    recipientName: string;
    email: string | null;
    facultyId: string | null;
    totalRp: number;
    paymentStatus: string;
    fulfillmentStatus: string;
    method: string;
    createdAt: number;
    expiresAt: number;
    pickup: { label: string; details: string; hours: string; version: number };
    items: {
      id: string;
      title: string;
      attributes: Record<string, string>;
      quantity: number;
      unitPriceRp: number;
      lineTotalRp: number;
      components: { variantId: string; sku: string; quantity: number }[];
    }[];
    invoice: { invoiceNumber: string; issuedAt: number } | null;
    review: { rating: number; comment: string } | null;
    reviewEligible: boolean;
  };
};

async function createOrder(session: Session, overrides: Record<string, unknown> = {}): Promise<OrderBody["order"]> {
  const response = await call("/api/checkout/create", mutate(session, checkoutBody(overrides)));
  expect(response.status).toBe(201);
  return ((await response.json()) as OrderBody).order;
}

async function pay(session: Session, id: string): Promise<Response> {
  return call(`/api/demo/orders/${id}/check-payment`, mutate(session));
}

function stockOf(variantId: string): { stock_on_hand: number; stock_reserved: number } {
  return db.raw().prepare("SELECT stock_on_hand, stock_reserved FROM variants WHERE id = ?").get(variantId) as {
    stock_on_hand: number;
    stock_reserved: number;
  };
}

describe("sesi dan akun", () => {
  test("sesi tamu menghasilkan cookie HttpOnly dan token CSRF", async () => {
    const response = await call("/api/demo/session", { method: "POST" });
    expect(response.status).toBe(201);
    const cookies = response.headers.getSetCookie();
    expect(cookies.join(";")).toMatch(/mbk_sess=[^;]+;.*HttpOnly/i);
    const body = (await response.json()) as { csrfToken: string };
    expect(body.csrfToken).toHaveLength(32);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("sesi anonim melaporkan user null dan role buyer", async () => {
    const response = await call("/api/auth/session");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ session: null, user: null, role: "buyer", portal: "buyer" });
  });

  test("registrasi membuat akun buyer dan langsung memasang sesi", async () => {
    const guest = await guestSession(call);
    const response = await call(
      "/api/auth/register",
      mutate(guest, { name: "Rina Pratiwi", email: "Rina@Example.test", password: "rahasia-panjang-2026" }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      user: { email: string; role: string; name: string; facultyId: string | null };
    };
    expect(body.user).toMatchObject({ email: "rina@example.test", role: "buyer", name: "Rina Pratiwi", facultyId: null });

    const session = await call("/api/auth/session", { cookie: readSession(response).cookie });
    const sessionBody = (await session.json()) as { user: { email: string }; role: string };
    expect(sessionBody.user.email).toBe("rina@example.test");
    expect(sessionBody.role).toBe("buyer");
  });

  test("registrasi menolak email ganda, kata sandi lemah, dan field asing", async () => {
    const guest = await guestSession(call);
    const duplicate = await call(
      "/api/auth/register",
      mutate(guest, { name: "Siti", email: BUYER.email, password: "rahasia-panjang-2026" }),
    );
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({ error: "email_unavailable" });

    const short = await call(
      "/api/auth/register",
      mutate(guest, { name: "Siti", email: "baru@example.test", password: "pendek" }),
    );
    expect(short.status).toBe(400);
    expect(await short.json()).toMatchObject({ error: "invalid_password", field: "password" });

    const leaks = await call(
      "/api/auth/register",
      mutate(guest, { name: "Siti", email: "budi@example.test", password: "budi@example.test-2026" }),
    );
    expect(leaks.status).toBe(400);
    expect(await leaks.json()).toMatchObject({ error: "invalid_password" });

    const badEmail = await call(
      "/api/auth/register",
      mutate(guest, { name: "Siti", email: "bukan-email", password: "rahasia-panjang-2026" }),
    );
    expect(badEmail.status).toBe(400);
    expect(await badEmail.json()).toMatchObject({ error: "invalid_email", field: "email" });

    const extra = await call(
      "/api/auth/register",
      mutate(guest, { name: "Siti", email: "baru@example.test", password: "rahasia-panjang-2026", role: "admin" }),
    );
    expect(extra.status).toBe(400);
    expect(await extra.json()).toMatchObject({ error: "invalid_payload" });
  });

  test("login memakai akun seed dan merotasi token sesi", async () => {
    const guest = await guestSession(call);
    const response = await call("/api/auth/login", mutate(guest, BUYER));
    expect(response.status).toBe(200);
    const rotated = readSession(response);
    expect(rotated.cookie).not.toBe(guest.cookie);
    expect(rotated.csrf).not.toBe(guest.csrf);
    const body = (await response.json()) as { user: { email: string; role: string; facultyId: string } };
    expect(body.user).toMatchObject({ email: BUYER.email, role: "buyer", facultyId: "fac-ft" });

    const old = await call("/api/auth/session", { cookie: guest.cookie });
    expect(await old.json()).toMatchObject({ session: null, user: null });
    const fresh = await call("/api/auth/session", { cookie: rotated.cookie });
    const freshBody = (await fresh.json()) as { session: { expiresAt: number }; role: string };
    expect(freshBody.session.expiresAt).toBe(NOW.getTime() + 86_400_000);
    expect(freshBody.role).toBe("buyer");
  });

  test("login menolak kata sandi salah dan email tidak dikenal", async () => {
    const guest = await guestSession(call);
    const wrong = await call("/api/auth/login", mutate(guest, { email: BUYER.email, password: "salah-sekali-2026" }));
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toMatchObject({ error: "invalid_credentials" });

    const unknown = await call(
      "/api/auth/login",
      mutate(guest, { email: "tidak-ada@mabakit.demo", password: "mabakit-demo-2026" }),
    );
    expect(unknown.status).toBe(401);
    expect(await unknown.json()).toMatchObject({ error: "invalid_credentials" });
  });

  test("logout mencabut sesi sehingga tidak bisa dipakai lagi", async () => {
    const session = await signInAs(BUYER);
    const response = await call("/api/auth/logout", mutate(session));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: null });

    const rotated = readSession(response);
    const after = await call("/api/auth/session", { cookie: rotated.cookie });
    expect(await after.json()).toMatchObject({ session: null, user: null, role: "buyer" });
    const stale = await call("/api/orders", { cookie: session.cookie });
    expect(stale.status).toBe(401);
  });

  test("mutasi akun wajib lolos CSRF dan origin", async () => {
    const guest = await guestSession(call);
    const noCsrf = await call("/api/auth/login", {
      method: "POST",
      cookie: guest.cookie,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(BUYER),
    });
    expect(noCsrf.status).toBe(403);
    expect(await noCsrf.json()).toMatchObject({ error: "csrf_failed" });

    const crossSite = await call("/api/auth/login", {
      ...mutate(guest, BUYER),
      origin: "https://situs-lain.example",
    });
    expect(crossSite.status).toBe(403);
    expect(await crossSite.json()).toMatchObject({ error: "origin_rejected" });

    const noSession = await call("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify(BUYER),
    });
    expect(noSession.status).toBe(401);
    expect(await noSession.json()).toMatchObject({ error: "session_required" });
  });
});

describe("katalog publik", () => {
  test("katalog memisahkan produk satuan dan paket fakultas", async () => {
    const response = await call("/api/catalog");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      faculties: { id: string; name: string; aliases: string[] }[];
      packages: { id: string; priceRp: number; variants: unknown[]; facultyOptions: { facultyId: string }[] }[];
      products: { id: string; kind: string; priceRp: number; variants: { id: string; faculties: string[] }[] }[];
    };
    expect(body.faculties).toHaveLength(8);
    expect(body.faculties.find((faculty) => faculty.id === "fac-fik")?.aliases).toEqual(
      expect.arrayContaining(["FIK", "FIKK"]),
    );
    expect(body.products.map((product) => product.id).sort()).toEqual(
      ["p-gesper", "p-kauskaki", "p-kipas", "p-rok", "p-slayer", "p-topi"].sort(),
    );
    expect(body.packages.map((item) => item.id).sort()).toEqual(
      ["p-paket-hemat", "p-paket-praktis", "p-paket-starter"].sort(),
    );
    const topi = body.products.find((product) => product.id === "p-topi");
    expect(topi?.priceRp).toBe(35000);
    expect(topi?.variants).toHaveLength(8);
    expect(topi?.variants.find((variant) => variant.id === "v-topi-ft")?.faculties).toEqual(["fac-ft"]);
    const hemat = body.packages.find((item) => item.id === "p-paket-hemat");
    expect(hemat).toMatchObject({ priceRp: 30000, variants: [] });
    expect(hemat?.facultyOptions).toHaveLength(8);
  });

  test("produk yang dikecualikan tidak pernah muncul di katalog", async () => {
    const body = (await (await call("/api/catalog")).json()) as {
      packages: { id: string }[];
      products: { id: string }[];
    };
    const ids = [...body.products, ...body.packages].map((item) => item.id);
    expect(ids).not.toContain("p-goodie");
    expect(ids).not.toContain("p-paket");
    const detail = await call("/api/catalog/p-goodie");
    expect(detail.status).toBe(404);
    expect(await detail.json()).toMatchObject({ error: "not_found" });
  });

  test("detail produk mengembalikan satu produk atau 404", async () => {
    const found = await call("/api/catalog/p-kauskaki");
    expect(found.status).toBe(200);
    expect(await found.json()).toMatchObject({ product: { id: "p-kauskaki", kind: "single" } });
    const missing = await call("/api/catalog/p-tidak-ada");
    expect(missing.status).toBe(404);
  });
});

describe("quote paket fakultas", () => {
  test("quote menghitung harga, komponen, dan stok dari server", async () => {
    const response = await call("/api/packages/p-paket-hemat/quote?faculty=fac-ft");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      package: { id: string };
      faculty: { id: string; name: string };
      components: { variantId: string; quantity: number; unitPriceRp: number; lineTotalRp: number; stock: number }[];
      priceRp: number;
      unitTotalRp: number;
      savingsRp: number;
      stock: number;
      available: boolean;
    };
    expect(body.package.id).toBe("p-paket-hemat");
    expect(body.faculty).toMatchObject({ id: "fac-ft", name: "Fakultas Teknik" });
    expect(body.components.map((component) => component.variantId).sort()).toEqual(["v-kauskaki", "v-kipas-ft"]);
    expect(body.priceRp).toBe(30000);
    expect(body.unitTotalRp).toBe(30000);
    expect(body.savingsRp).toBe(0);
    expect(body.stock).toBe(20);
    expect(body.available).toBe(true);
  });

  test("quote menolak permintaan tanpa fakultas dan fakultas tanpa konfigurasi", async () => {
    const missing = await call("/api/packages/p-paket-hemat/quote");
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ error: "faculty_required" });

    const unavailable = await call("/api/packages/p-paket-hemat/quote?faculty=fac-tidak-ada");
    expect(unavailable.status).toBe(409);
    expect(await unavailable.json()).toMatchObject({ error: "package_unavailable" });

    const retired = await call("/api/packages/p-paket/quote?faculty=fac-ft");
    expect(retired.status).toBe(404);
  });

  test("quote menghitung sisa stok dari reservasi berjalan", async () => {
    const session = await signInAs(BUYER);
    await createOrder(session, {
      items: [{ productId: "p-paket-hemat", facultyId: "fac-ft", quantity: 3 }],
    });
    const body = (await (await call("/api/packages/p-paket-hemat/quote?faculty=fac-ft")).json()) as {
      stock: number;
      available: boolean;
    };
    expect(body.stock).toBe(17);
    expect(body.available).toBe(true);
  });
});

describe("checkout", () => {
  test("checkout anonim ditolak sebelum menyentuh katalog", async () => {
    const response = await call("/api/checkout/create", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify(checkoutBody()),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "session_required" });
    expect(db.raw().prepare("SELECT COUNT(*) AS n FROM orders").get()).toEqual({ n: 0 });
  });

  test("checkout satuan menyimpan snapshot dan total dari server", async () => {
    const session = await signInAs(BUYER);
    const order = await createOrder(session, {
      items: [{ productId: "p-topi", variantId: "v-topi-ft", quantity: 2 }],
    });
    expect(order.totalRp).toBe(70000);
    expect(order.paymentStatus).toBe("PENDING");
    expect(order.fulfillmentStatus).toBe("UNFULFILLED");
    expect(order.method).toBe("QRIS");
    expect(order.facultyId).toBe("fac-ft");
    expect(order.recipientName).toBe("Siti Rahma");
    expect(order.expiresAt).toBe(NOW.getTime() + 30 * 60_000);
    expect(order.invoice).toBeNull();
    expect(order.reviewEligible).toBe(false);
    expect(order.items[0]).toMatchObject({
      title: "Topi Fakultas",
      attributes: { fakultas: "FT" },
      quantity: 2,
      unitPriceRp: 35000,
      lineTotalRp: 70000,
    });
    expect(order.items[0].components).toEqual([
      expect.objectContaining({ variantId: "v-topi-ft", sku: "TOPI-FT", quantity: 2 }),
    ]);
    expect(order.pickup).toMatchObject({ label: "Kampus A, Lobi Gedung B", version: 1 });
    expect(stockOf("v-topi-ft")).toEqual({ stock_on_hand: 10, stock_reserved: 2 });
  });

  test("checkout paket memakai fakultas pilihan dan menyimpan komponen", async () => {
    const session = await signInAs(BUYER);
    const order = await createOrder(session, {
      items: [{ productId: "p-paket-hemat", facultyId: "fac-fip", quantity: 1 }],
    });
    expect(order.totalRp).toBe(30000);
    expect(order.facultyId).toBe("fac-fip");
    expect(order.items[0].attributes).toEqual({ fakultas: "Fakultas Ilmu Pendidikan", fakultasId: "fac-fip" });
    expect(order.items[0].components.map((component) => component.sku).sort()).toEqual(["KAUS-01", "KIPAS-FIP"]);
    expect(stockOf("v-kipas-fip").stock_reserved).toBe(1);
    expect(stockOf("v-kauskaki").stock_reserved).toBe(1);
  });

  test("bentuk item satuan dan paket tidak boleh tertukar", async () => {
    const session = await signInAs(BUYER);
    const singleWithFaculty = await call(
      "/api/checkout/create",
      mutate(
        session,
        checkoutBody({ items: [{ productId: "p-topi", variantId: "v-topi-ft", facultyId: "fac-ft", quantity: 1 }] }),
      ),
    );
    expect(singleWithFaculty.status).toBe(400);
    expect(await singleWithFaculty.json()).toMatchObject({ error: "invalid_item" });

    const packageWithVariant = await call(
      "/api/checkout/create",
      mutate(
        session,
        checkoutBody({ items: [{ productId: "p-paket-hemat", variantId: "v-kauskaki", quantity: 1 }] }),
      ),
    );
    expect(packageWithVariant.status).toBe(400);
    expect(await packageWithVariant.json()).toMatchObject({ error: "invalid_item" });

    const packageWithoutFaculty = await call(
      "/api/checkout/create",
      mutate(session, checkoutBody({ items: [{ productId: "p-paket-hemat", quantity: 1 }] })),
    );
    expect(packageWithoutFaculty.status).toBe(409);
    expect(await packageWithoutFaculty.json()).toMatchObject({ error: "catalog_changed" });
  });

  test("produk nonaktif tidak bisa dibeli lewat rute mana pun", async () => {
    const session = await signInAs(BUYER);
    for (const items of [
      [{ productId: "p-goodie", variantId: "v-goodie", quantity: 1 }],
      [{ productId: "p-paket", facultyId: "fac-ft", quantity: 1 }],
    ]) {
      const response = await call("/api/checkout/create", mutate(session, checkoutBody({ items })));
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ error: "catalog_changed" });
    }
    expect(db.raw().prepare("SELECT COUNT(*) AS n FROM orders").get()).toEqual({ n: 0 });
  });

  test("replay idempotensi mengembalikan order yang sama", async () => {
    const session = await signInAs(BUYER);
    const first = await createOrder(session);
    const replay = await call("/api/checkout/create", mutate(session, checkoutBody()));
    expect(replay.status).toBe(200);
    expect(((await replay.json()) as OrderBody).order.id).toBe(first.id);
    expect(db.raw().prepare("SELECT COUNT(*) AS n FROM orders").get()).toEqual({ n: 1 });
  });

  test("kunci idempotensi sama dengan isi berbeda ditolak konflik", async () => {
    const session = await signInAs(BUYER);
    await createOrder(session);
    const changed = await call("/api/checkout/create", mutate(session, checkoutBody({ buyerName: "Budi Lain" })));
    expect(changed.status).toBe(409);
    expect(await changed.json()).toMatchObject({ error: "conflict" });
  });

  test("stok kurang menghasilkan 409 tanpa meninggalkan order", async () => {
    const session = await signInAs(BUYER);
    const response = await call(
      "/api/checkout/create",
      mutate(session, checkoutBody({ items: [{ productId: "p-rok", variantId: "v-rok", quantity: 99 }] })),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "stock_unavailable" });
    expect(db.raw().prepare("SELECT COUNT(*) AS n FROM orders").get()).toEqual({ n: 0 });
    expect(stockOf("v-rok")).toEqual({ stock_on_hand: 12, stock_reserved: 0 });
  });

  test("maksimum dua draft HELD per sesi", async () => {
    const session = await signInAs(BUYER);
    await createOrder(session, { items: [{ productId: "p-topi", variantId: "v-topi-ft", quantity: 1 }] });
    await createOrder(session, {
      idempotencyKey: "checkout-key-000002",
      items: [{ productId: "p-kipas", variantId: "v-kipas-ft", quantity: 1 }],
    });
    const third = await call(
      "/api/checkout/create",
      mutate(
        session,
        checkoutBody({
          idempotencyKey: "checkout-key-000003",
          items: [{ productId: "p-slayer", variantId: "v-slayer", quantity: 1 }],
        }),
      ),
    );
    expect(third.status).toBe(409);
    expect(await third.json()).toMatchObject({ error: "hold_limit" });
  });

  test("checkout yang ditutup admin mengembalikan 503", async () => {
    db.raw().exec("UPDATE store_settings SET checkout_enabled = 0 WHERE id = 1");
    const session = await signInAs(BUYER);
    const response = await call("/api/checkout/create", mutate(session, checkoutBody()));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "checkout_disabled" });
  });

  test("metode pembayaran di luar daftar ditolak", async () => {
    const session = await signInAs(BUYER);
    const response = await call("/api/checkout/create", mutate(session, checkoutBody({ method: "TUNAI" })));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_method" });
  });
});

describe("pembayaran, invoice, dan kepemilikan", () => {
  test("konfirmasi pembayaran mengonsumsi stok dan membuat satu invoice", async () => {
    const session = await signInAs(BUYER);
    const order = await createOrder(session, { items: [{ productId: "p-topi", variantId: "v-topi-ft", quantity: 2 }] });
    const paid = await pay(session, order.id);
    expect(paid.status).toBe(200);
    const paidOrder = ((await paid.json()) as OrderBody).order;
    expect(paidOrder.paymentStatus).toBe("PAID");
    expect(paidOrder.invoice?.invoiceNumber).toBe(`INV-${order.orderNumber}`);

    const again = await pay(session, order.id);
    expect(again.status).toBe(200);
    expect(((await again.json()) as OrderBody).order.paymentStatus).toBe("PAID");
    expect(db.raw().prepare("SELECT COUNT(*) AS n FROM invoices").get()).toEqual({ n: 1 });
    expect(stockOf("v-topi-ft")).toEqual({ stock_on_hand: 8, stock_reserved: 0 });
  });

  test("invoice memakai snapshot pickup dan watermark simulasi", async () => {
    const session = await signInAs(BUYER);
    const order = await createOrder(session);

    const early = await call(`/api/orders/${order.id}/invoice`, { cookie: session.cookie });
    expect(early.status).toBe(409);
    expect(await early.json()).toMatchObject({ error: "order_not_payable" });

    await pay(session, order.id);
    db.raw().exec("UPDATE store_settings SET pickup_location_label = 'Lokasi Baru', pickup_version = 2 WHERE id = 1");
    const response = await call(`/api/orders/${order.id}/invoice`, { cookie: session.cookie });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      invoice: { mode: string; watermark: string; order: { pickup: { label: string }; items: { title: string }[] } };
    };
    expect(body.invoice.mode).toBe("DEMO");
    expect(body.invoice.watermark).toBe("SIMULASI: bukan bukti pembayaran nyata");
    expect(body.invoice.order.pickup.label).toBe("Kampus A, Lobi Gedung B");
    expect(body.invoice.order.items[0].title).toBe("Topi Fakultas");
  });

  test("pratinjau email hanya untuk order PAID dan tidak mengirim apa pun", async () => {
    const session = await signInAs(BUYER);
    const order = await createOrder(session);

    const early = await call(`/api/orders/${order.id}/email-preview`, { cookie: session.cookie });
    expect(early.status).toBe(409);
    expect(await early.json()).toMatchObject({ error: "order_not_payable" });

    await pay(session, order.id);
    const response = await call(`/api/orders/${order.id}/email-preview`, { cookie: session.cookie });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { recipient: string; simulated: boolean; body: string };
    expect(body.recipient).toBe(BUYER.email);
    expect(body.simulated).toBe(true);
    expect(body.body).toContain("Ini simulasi: tidak ada email yang dikirim.");
  });

  test("draft kedaluwarsa melepas stok dan tidak bisa dibayar", async () => {
    const session = await signInAs(BUYER);
    const order = await createOrder(session, { items: [{ productId: "p-topi", variantId: "v-topi-ft", quantity: 2 }] });
    vi.setSystemTime(new Date(NOW.getTime() + 31 * 60_000));
    const response = await pay(session, order.id);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "order_expired" });
    expect(stockOf("v-topi-ft")).toEqual({ stock_on_hand: 10, stock_reserved: 0 });
    const catalog = (await (await call("/api/catalog")).json()) as { products: { id: string; stock: number }[] };
    expect(catalog.products.find((product) => product.id === "p-topi")?.stock).toBe(80);
  });

  test("pembeli lain tidak bisa membaca order, invoice, atau daftar order", async () => {
    const owner = await signInAs(BUYER);
    const order = await createOrder(owner);
    await pay(owner, order.id);

    const guest = await guestSession(call);
    const registered = await call(
      "/api/auth/register",
      mutate(guest, { name: "Budi Santoso", email: "budi@example.test", password: "rahasia-panjang-2026" }),
    );
    expect(registered.status).toBe(201);
    const other = readSession(registered);

    for (const path of [`/api/orders/${order.id}`, `/api/orders/${order.id}/invoice`, `/api/orders/${order.id}/email-preview`]) {
      const response = await call(path, { cookie: other.cookie });
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ error: "not_found" });
    }
    const list = (await (await call("/api/orders", { cookie: other.cookie })).json()) as { orders: unknown[] };
    expect(list.orders).toEqual([]);

    const mine = (await (await call("/api/orders", { cookie: owner.cookie })).json()) as { orders: { id: string }[] };
    expect(mine.orders.map((entry) => entry.id)).toEqual([order.id]);
  });
});

describe("profil akun", () => {
  test("profil mengikuti akun, bukan sesi", async () => {
    const session = await signInAs(BUYER);
    const initial = (await (await call("/api/profile", { cookie: session.cookie })).json()) as {
      profile: { name: string; whatsapp: string; email: string; facultyId: string };
    };
    expect(initial.profile).toMatchObject({
      name: "Siti Rahma",
      whatsapp: "081234567890",
      email: BUYER.email,
      facultyId: "fac-ft",
    });

    const patched = await call(
      "/api/profile",
      mutate(session, { name: "Siti  Rahma Putri", whatsapp: "0812 3456 7891", facultyId: "fac-fpsi" }, "PATCH"),
    );
    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({
      profile: { name: "Siti Rahma Putri", whatsapp: "+6281234567891", facultyId: "fac-fpsi" },
    });

    const secondSession = await signInAs(BUYER);
    const reread = (await (await call("/api/profile", { cookie: secondSession.cookie })).json()) as {
      profile: { name: string; facultyId: string };
    };
    expect(reread.profile).toMatchObject({ name: "Siti Rahma Putri", facultyId: "fac-fpsi" });
  });

  test("profil menolak field asing, nomor salah, dan fakultas tidak dikenal", async () => {
    const session = await signInAs(BUYER);
    const foreign = await call(
      "/api/profile",
      mutate(session, { name: "Siti", whatsapp: "081234567890", email: "lain@example.test" }, "PATCH"),
    );
    expect(foreign.status).toBe(400);
    expect(await foreign.json()).toMatchObject({ error: "invalid_payload" });

    const badPhone = await call(
      "/api/profile",
      mutate(session, { name: "Siti", whatsapp: "12345", facultyId: null }, "PATCH"),
    );
    expect(badPhone.status).toBe(400);
    expect(await badPhone.json()).toMatchObject({ error: "invalid_phone", field: "whatsapp" });

    const badFaculty = await call(
      "/api/profile",
      mutate(session, { name: "Siti", whatsapp: "081234567890", facultyId: "fac-ghost" }, "PATCH"),
    );
    expect(badFaculty.status).toBe(400);
    expect(await badFaculty.json()).toMatchObject({ error: "invalid_payload", field: "facultyId" });

    const emptyName = await call(
      "/api/profile",
      mutate(session, { name: "   ", whatsapp: "081234567890", facultyId: null }, "PATCH"),
    );
    expect(emptyName.status).toBe(400);
    expect(await emptyName.json()).toMatchObject({ error: "invalid_name", field: "name" });
  });

  test("profil butuh sesi dan CSRF", async () => {
    const anonymous = await call("/api/profile");
    expect(anonymous.status).toBe(401);
    const session = await signInAs(BUYER);
    const noCsrf = await call("/api/profile", {
      method: "PATCH",
      cookie: session.cookie,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Siti", whatsapp: "081234567890", facultyId: null }),
    });
    expect(noCsrf.status).toBe(403);
  });
});

describe("ulasan", () => {
  test("daftar publik hanya memuat nama tampilan dan menandai ulasan contoh", async () => {
    const response = await call("/api/reviews");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      reviews: { displayName: string; isExample: boolean; rating: number; comment: string }[];
    };
    expect(body.reviews).toHaveLength(3);
    for (const review of body.reviews) {
      expect(review.isExample).toBe(true);
      expect(Object.keys(review).sort()).toEqual(["comment", "createdAt", "displayName", "isExample", "rating"]);
    }
  });

  test("ulasan hanya setelah order diterima dan satu per order", async () => {
    const buyer = await signInAs(BUYER);
    const staff = await signInAs(STAFF);
    const order = await createOrder(buyer);

    const tooEarly = await call(
      `/api/orders/${order.id}/review`,
      mutate(buyer, { rating: 5, comment: "Pelayanan cepat dan rapi." }),
    );
    expect(tooEarly.status).toBe(409);
    expect(await tooEarly.json()).toMatchObject({ error: "review_not_allowed" });

    await pay(buyer, order.id);
    expect((await call(`/api/team/orders/${order.id}/ready`, mutate(staff))).status).toBe(200);
    expect((await call(`/api/team/orders/${order.id}/complete`, mutate(staff))).status).toBe(200);

    const created = await call(
      `/api/orders/${order.id}/review`,
      mutate(buyer, { rating: 5, comment: "Pelayanan cepat dan rapi." }),
    );
    expect(created.status).toBe(201);
    const review = ((await created.json()) as { review: { displayName: string; isExample: boolean; createdAt: number } })
      .review;
    expect(review).toMatchObject({ displayName: "Siti", isExample: false });
    expect(review.createdAt).toBe(NOW.getTime());

    const duplicate = await call(
      `/api/orders/${order.id}/review`,
      mutate(buyer, { rating: 3, comment: "Ulasan kedua tidak boleh masuk." }),
    );
    expect(duplicate.status).toBe(200);
    expect(((await duplicate.json()) as { review: { rating: number; createdAt: number } }).review).toMatchObject({
      rating: 5,
      createdAt: review.createdAt,
    });

    const listed = (await (await call("/api/reviews")).json()) as { reviews: { displayName: string }[] };
    expect(listed.reviews[0].displayName).toBe("Siti");
  });

  test("ulasan menolak komentar pendek dan order milik pembeli lain", async () => {
    const buyer = await signInAs(BUYER);
    const staff = await signInAs(STAFF);
    const order = await createOrder(buyer);
    await pay(buyer, order.id);
    await call(`/api/team/orders/${order.id}/ready`, mutate(staff));
    await call(`/api/team/orders/${order.id}/complete`, mutate(staff));

    const short = await call(`/api/orders/${order.id}/review`, mutate(buyer, { rating: 5, comment: "oke" }));
    expect(short.status).toBe(400);
    expect(await short.json()).toMatchObject({ error: "invalid_payload", field: "comment" });

    const badRating = await call(
      `/api/orders/${order.id}/review`,
      mutate(buyer, { rating: 6, comment: "Ulasan dengan rating di luar batas." }),
    );
    expect(badRating.status).toBe(400);
    expect(await badRating.json()).toMatchObject({ error: "invalid_payload", field: "rating" });

    const guest = await guestSession(call);
    const registered = await call(
      "/api/auth/register",
      mutate(guest, { name: "Budi Santoso", email: "budi@example.test", password: "rahasia-panjang-2026" }),
    );
    const other = readSession(registered);
    const foreign = await call(
      `/api/orders/${order.id}/review`,
      mutate(other, { rating: 5, comment: "Order orang lain tidak boleh diulas." }),
    );
    expect(foreign.status).toBe(404);
  });
});

describe("workspace tim", () => {
  test("ringkasan tim memisahkan peran pembeli dan operator", async () => {
    const anonymous = await call("/api/team/summary");
    expect(anonymous.status).toBe(401);

    const buyer = await signInAs(BUYER);
    const forbidden = await call("/api/team/summary", { cookie: buyer.cookie });
    expect(forbidden.status).toBe(401);
    expect(await forbidden.json()).toMatchObject({ error: "session_required" });

    const staff = await signInAs(STAFF);
    const response = await call("/api/team/summary?period=today", { cookie: staff.cookie });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      period: string;
      rangeStart: number;
      sales: { paidValueRp: number; paidOrders: number; simulated: boolean };
      counts: { pending: number; preparing: number; ready: number; completed: number };
    };
    expect(body.period).toBe("today");
    expect(body.rangeStart).toBe(new Date("2026-10-21T17:00:00Z").getTime());
    expect(body.sales).toEqual({ paidValueRp: 0, paidOrders: 0, simulated: true });
    expect(body.counts).toEqual({ pending: 0, preparing: 0, ready: 0, completed: 0 });
  });

  test("antrean tim memfilter status dan menolak filter asing", async () => {
    const buyer = await signInAs(BUYER);
    const staff = await signInAs(STAFF);
    const order = await createOrder(buyer);

    const pending = (await (await call("/api/team/orders?payment=PENDING", { cookie: staff.cookie })).json()) as {
      orders: { id: string; paymentStatus: string }[];
      nextCursor: string | null;
    };
    expect(pending.orders.map((entry) => entry.id)).toEqual([order.id]);
    expect(pending.nextCursor).toBeNull();

    const badPayment = await call("/api/team/orders?payment=LUNAS", { cookie: staff.cookie });
    expect(badPayment.status).toBe(400);
    const badFulfillment = await call("/api/team/orders?fulfillment=DIKIRIM", { cookie: staff.cookie });
    expect(badFulfillment.status).toBe(400);
    const badCursor = await call("/api/team/orders?cursor=bukan-cursor", { cookie: staff.cookie });
    expect(badCursor.status).toBe(400);

    const detail = await call(`/api/team/orders/${order.id}`, { cookie: staff.cookie });
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ order: { id: order.id, facultyId: "fac-ft" } });
    const missing = await call("/api/team/orders/tidak-ada", { cookie: staff.cookie });
    expect(missing.status).toBe(404);
  });

  test("staff menandai READY lalu menyelesaikan pickup secara idempoten", async () => {
    const buyer = await signInAs(BUYER);
    const staff = await signInAs(STAFF);
    const order = await createOrder(buyer);

    const early = await call(`/api/team/orders/${order.id}/ready`, mutate(staff));
    expect(early.status).toBe(409);
    expect(await early.json()).toMatchObject({ error: "not_ready_transition" });

    await pay(buyer, order.id);
    const ready = await call(`/api/team/orders/${order.id}/ready`, mutate(staff));
    expect(ready.status).toBe(200);
    expect(((await ready.json()) as OrderBody).order.fulfillmentStatus).toBe("READY");

    const summary = (await (await call("/api/team/summary", { cookie: staff.cookie })).json()) as {
      counts: { ready: number };
      sales: { paidOrders: number; paidValueRp: number };
    };
    expect(summary.counts.ready).toBe(1);
    expect(summary.sales).toMatchObject({ paidOrders: 1, paidValueRp: 35000 });

    const done = await call(`/api/team/orders/${order.id}/complete`, mutate(staff));
    expect(done.status).toBe(200);
    const doneBody = (await done.json()) as { order: { fulfillmentStatus: string; reviewEligible: boolean } };
    expect(doneBody.order.fulfillmentStatus).toBe("PICKED_UP");
    expect(doneBody.order.reviewEligible).toBe(true);

    const twice = await call(`/api/team/orders/${order.id}/complete`, mutate(staff));
    expect(twice.status).toBe(200);
    expect(await twice.json()).toMatchObject({ replayed: true });
    expect(
      db.raw().prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'pickup_claimed'").get(),
    ).toEqual({ n: 1 });
  });

  test("route staf lama tetap dijaga operator", async () => {
    const buyer = await signInAs(BUYER);
    const staff = await signInAs(STAFF);
    const order = await createOrder(buyer);

    const forbidden = await call("/api/staff/orders", { cookie: buyer.cookie });
    expect(forbidden.status).toBe(401);
    const list = await call("/api/staff/orders", { cookie: staff.cookie });
    expect(list.status).toBe(200);

    await pay(buyer, order.id);
    const ready = await call(`/api/staff/orders/${order.id}/ready`, mutate(staff));
    expect(ready.status).toBe(200);
    const viaGet = await call(`/api/staff/orders/${order.id}/ready`, { cookie: staff.cookie });
    expect(viaGet.status).toBe(404);
  });
});

describe("admin katalog dan pengaturan", () => {
  test("admin saja yang boleh membuka ringkasan", async () => {
    const buyer = await signInAs(BUYER);
    const staff = await signInAs(STAFF);
    const admin = await signInAs(ADMIN);

    expect((await call("/api/admin/summary", { cookie: buyer.cookie })).status).toBe(401);
    expect((await call("/api/admin/summary", { cookie: staff.cookie })).status).toBe(403);
    const response = await call("/api/admin/summary", { cookie: admin.cookie });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      settings: { checkoutEnabled: boolean; pickup: { label: string; version: number } };
      variants: { id: string; stockOnHand: number; stockReserved: number; active: boolean }[];
      counts: Record<string, number>;
    };
    expect(body.settings).toMatchObject({ checkoutEnabled: true, pickup: { label: "Kampus A, Lobi Gedung B", version: 1 } });
    expect(body.variants.find((variant) => variant.id === "v-goodie")?.active).toBe(false);
    expect(body.variants.find((variant) => variant.id === "v-rok")).toMatchObject({
      stockOnHand: 12,
      stockReserved: 0,
    });
    expect(body.counts).toEqual({ pending: 0, paid: 0, expired: 0, ready: 0, pickedUp: 0 });
  });

  test("admin mengubah pengaturan toko dan menaikkan versi pickup", async () => {
    const admin = await signInAs(ADMIN);
    const off = await call(
      "/api/admin/settings",
      mutate(admin, { checkoutEnabled: false, pickupLabel: "Lobi Baru" }, "PATCH"),
    );
    expect(off.status).toBe(200);
    const body = (await off.json()) as {
      settings: { checkoutEnabled: boolean; pickup: { label: string; version: number } };
    };
    expect(body.settings.checkoutEnabled).toBe(false);
    expect(body.settings.pickup).toMatchObject({ label: "Lobi Baru", version: 2 });

    const buyer = await signInAs(BUYER);
    const blocked = await call("/api/checkout/create", mutate(buyer, checkoutBody()));
    expect(blocked.status).toBe(503);

    const invalid = await call("/api/admin/settings", mutate(admin, { pickupLabel: "" }, "PATCH"));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: "invalid_payload" });
  });

  test("admin menyesuaikan stok dan tidak boleh turun di bawah reservasi", async () => {
    const admin = await signInAs(ADMIN);
    const buyer = await signInAs(BUYER);
    const order = await createOrder(buyer, { items: [{ productId: "p-rok", variantId: "v-rok", quantity: 2 }] });

    const belowReserved = await call("/api/admin/variants/v-rok/stock", mutate(admin, { onHand: 1 }));
    expect(belowReserved.status).toBe(409);
    expect(await belowReserved.json()).toMatchObject({ error: "stock_below_reserved" });

    const adjusted = await call("/api/admin/variants/v-rok/stock", mutate(admin, { onHand: 20 }));
    expect(adjusted.status).toBe(200);
    expect(await adjusted.json()).toMatchObject({ variant: { id: "v-rok", stockOnHand: 20, stockReserved: 2 } });

    const negative = await call("/api/admin/variants/v-rok/stock", mutate(admin, { onHand: -1 }));
    expect(negative.status).toBe(400);
    const missing = await call("/api/admin/variants/v-ghost/stock", mutate(admin, { onHand: 3 }));
    expect(missing.status).toBe(404);

    const audit = (await (await call("/api/admin/audit", { cookie: admin.cookie })).json()) as {
      logs: { action: string; actorId: string; metadata: Record<string, unknown> }[];
    };
    expect(audit.logs.some((log) => log.action === "stock_adjusted" && log.actorId === "usr-admin")).toBe(true);
    expect(audit.logs.some((log) => log.action === "checkout_created" && log.actorId === "usr-buyer")).toBe(true);
    expect(order.id).toBeTruthy();
  });

  test("admin membuat produk dan varian yang langsung bisa dibeli", async () => {
    const admin = await signInAs(ADMIN);
    const created = await call(
      "/api/admin/products",
      mutate(admin, { kind: "single", title: "Pin Kampus", description: "Pin logam.", imagePath: null }),
    );
    expect(created.status).toBe(201);
    const product = ((await created.json()) as { product: { id: string; active: boolean } }).product;
    expect(product.active).toBe(false);

    const published = await call(
      `/api/admin/products/${product.id}`,
      mutate(admin, { title: "Pin Kampus", description: "Pin logam.", imagePath: null, active: true }, "PATCH"),
    );
    expect(published.status).toBe(200);
    expect(await published.json()).toEqual({ updated: true });

    const variant = await call(
      `/api/admin/products/${product.id}/variants`,
      mutate(admin, {
        sku: "pin-01",
        priceRp: 10000,
        stockOnHand: 5,
        attributes: { warna: "emas" },
        active: true,
        facultyId: "fac-ft",
      }),
    );
    expect(variant.status).toBe(201);
    const variantBody = ((await variant.json()) as { variant: { id: string; sku: string; active: boolean } }).variant;
    expect(variantBody).toMatchObject({ sku: "PIN-01", active: true });

    const catalog = (await (await call("/api/catalog")).json()) as {
      products: { id: string; variants: { id: string; faculties: string[] }[] }[];
    };
    const listed = catalog.products.find((item) => item.id === product.id);
    expect(listed?.variants[0]).toMatchObject({ id: variantBody.id, faculties: ["fac-ft"] });

    const buyer = await signInAs(BUYER);
    const order = await createOrder(buyer, {
      items: [{ productId: product.id, variantId: variantBody.id, quantity: 2 }],
    });
    expect(order.totalRp).toBe(20000);
  });

  test("admin memvalidasi SKU, tipe produk, dan field varian", async () => {
    const admin = await signInAs(ADMIN);
    const badSku = await call(
      "/api/admin/products/p-topi/variants",
      mutate(admin, { sku: "x", priceRp: 10000, stockOnHand: 1, attributes: {}, active: true }),
    );
    expect(badSku.status).toBe(400);
    expect(await badSku.json()).toMatchObject({ error: "invalid_payload" });

    const onBundle = await call(
      "/api/admin/products/p-paket-hemat/variants",
      mutate(admin, { sku: "BUNDLE-01", priceRp: 10000, stockOnHand: 1, attributes: {}, active: true }),
    );
    expect(onBundle.status).toBe(400);

    const unknownProduct = await call(
      "/api/admin/products/p-ghost/variants",
      mutate(admin, { sku: "GHOST-01", priceRp: 10000, stockOnHand: 1, attributes: {}, active: true }),
    );
    expect(unknownProduct.status).toBe(404);

    const badAttributes = await call(
      "/api/admin/products/p-topi/variants",
      mutate(admin, { sku: "TOPI-X", priceRp: 10000, stockOnHand: 1, attributes: { "bad key": "x" }, active: true }),
    );
    expect(badAttributes.status).toBe(400);
  });

  test("konfigurasi paket hanya tampil setelah dipublikasikan", async () => {
    const admin = await signInAs(ADMIN);
    // p-paket sudah ada di seed sebagai bundel tanpa konfigurasi fakultas.
    const packageId = "p-paket";
    const activated = await call(
      `/api/admin/products/${packageId}`,
      mutate(admin, { title: "Paket Uji", description: "Paket untuk pengujian.", imagePath: null, active: true }, "PATCH"),
    );
    expect(activated.status).toBe(200);

    const draft = await call(
      `/api/admin/packages/${packageId}/configs/fac-ft`,
      mutate(admin, { priceRp: 20000, published: false, components: [{ variantId: "v-kauskaki", quantity: 1 }] }, "PUT"),
    );
    expect(draft.status).toBe(200);
    const hidden = (await (await call("/api/catalog")).json()) as { packages: { id: string }[] };
    expect(hidden.packages.map((item) => item.id)).not.toContain(packageId);
    expect((await call(`/api/packages/${packageId}/quote?faculty=fac-ft`)).status).toBe(409);

    const published = await call(
      `/api/admin/packages/${packageId}/configs/fac-ft`,
      mutate(admin, { priceRp: 20000, published: true, components: [{ variantId: "v-kauskaki", quantity: 1 }] }, "PUT"),
    );
    expect(published.status).toBe(200);
    expect(await published.json()).toMatchObject({
      config: { id: `cfg-${packageId}-fac-ft`, priceRp: 20000, published: true },
    });

    const visible = (await (await call("/api/catalog")).json()) as { packages: { id: string; priceRp: number }[] };
    expect(visible.packages.find((item) => item.id === packageId)?.priceRp).toBe(20000);

    const quote = (await (await call(`/api/packages/${packageId}/quote?faculty=fac-ft`)).json()) as {
      priceRp: number;
      unitTotalRp: number;
      savingsRp: number;
      stock: number;
      available: boolean;
    };
    expect(quote).toMatchObject({ priceRp: 20000, unitTotalRp: 15000, savingsRp: 0, stock: 40, available: true });
  });

  test("paket tidak bisa dipublikasikan dengan varian nonaktif", async () => {
    const admin = await signInAs(ADMIN);
    const response = await call(
      "/api/admin/packages/p-paket-hemat/configs/fac-ft",
      mutate(admin, { priceRp: 20000, published: true, components: [{ variantId: "v-goodie", quantity: 1 }] }, "PUT"),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "package_not_publishable" });
  });

  test("tas putih tetap tidak dijual walau admin mencoba mengaktifkannya", async () => {
    const admin = await signInAs(ADMIN);
    const response = await call(
      "/api/admin/variants/v-goodie",
      mutate(admin, { sellable: true, active: true }, "PATCH"),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "white_bag_not_sellable" });

    const catalogBody = (await (await call("/api/catalog")).json()) as {
      products: { id: string; variants: { id: string }[] }[];
    };
    expect(catalogBody.products.some((product) => product.id === "p-goodie")).toBe(false);

    const buyer = await signInAs(BUYER);
    const buy = await call(
      "/api/checkout/create",
      mutate(buyer, checkoutBody({ items: [{ productId: "p-goodie", variantId: "v-goodie", quantity: 1 }] })),
    );
    expect(buy.status).toBe(409);
  });

  test("admin mengelola alias fakultas dan menolak bentrok antar fakultas", async () => {
    const admin = await signInAs(ADMIN);
    const saved = await call(
      "/api/admin/faculties/fac-fip/aliases",
      mutate(admin, { aliases: ["fip", "pendidikan"] }, "PUT"),
    );
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ aliases: ["FIP", "PENDIDIKAN"] });

    const conflict = await call("/api/admin/faculties/fac-fip/aliases", mutate(admin, { aliases: ["FT"] }, "PUT"));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ error: "conflict" });

    const invalid = await call("/api/admin/faculties/fac-fip/aliases", mutate(admin, { aliases: ["x"] }, "PUT"));
    expect(invalid.status).toBe(400);
    const missing = await call("/api/admin/faculties/fac-ghost/aliases", mutate(admin, { aliases: [] }, "PUT"));
    expect(missing.status).toBe(404);
  });

  test("admin melihat operator dan mencabut sesinya", async () => {
    const admin = await signInAs(ADMIN);
    const staff = await signInAs(STAFF);

    const list = (await (await call("/api/admin/operators", { cookie: admin.cookie })).json()) as {
      operators: { id: string; email: string; role: string; activeSessions: number }[];
    };
    expect(list.operators.map((operator) => operator.id).sort()).toEqual(["usr-admin", "usr-staff"]);
    expect(list.operators.find((operator) => operator.id === "usr-staff")?.activeSessions).toBe(1);

    const revoked = await call("/api/admin/operators/usr-staff/revoke", mutate(admin));
    expect(revoked.status).toBe(200);
    expect(await revoked.json()).toEqual({ revoked: true, disabled: true });

    const after = await call("/api/team/summary", { cookie: staff.cookie });
    expect(after.status).toBe(401);
    const missing = await call("/api/admin/operators/usr-buyer/revoke", mutate(admin));
    expect(missing.status).toBe(404);
  });

  test("katalog admin memuat produk, konfigurasi, dan alias", async () => {
    const admin = await signInAs(ADMIN);
    const response = await call("/api/admin/catalog", { cookie: admin.cookie });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      products: {
        id: string;
        active: boolean;
        variants: { id: string }[];
        configs: { facultyId: string; published: boolean; components: { variantId: string }[] }[];
      }[];
      faculties: { id: string; aliases: string[] }[];
    };
    const goodie = body.products.find((product) => product.id === "p-goodie");
    expect(goodie?.active).toBe(false);
    const hemat = body.products.find((product) => product.id === "p-paket-hemat");
    expect(hemat?.configs).toHaveLength(8);
    expect(hemat?.configs.find((config) => config.facultyId === "fac-ft")).toMatchObject({
      published: true,
      components: [{ variantId: "v-kipas-ft", quantity: 1 }, { variantId: "v-kauskaki", quantity: 1 }],
    });
    expect(body.faculties.find((faculty) => faculty.id === "fac-fik")?.aliases).toEqual(
      expect.arrayContaining(["FIK", "FIKK"]),
    );
  });

  test("mutasi admin butuh CSRF dan sesi admin", async () => {
    const admin = await signInAs(ADMIN);
    const noCsrf = await call("/api/admin/settings", {
      method: "PATCH",
      cookie: admin.cookie,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ checkoutEnabled: false }),
    });
    expect(noCsrf.status).toBe(403);

    const staff = await signInAs(STAFF);
    const staffTry = await call("/api/admin/settings", mutate(staff, { checkoutEnabled: false }, "PATCH"));
    expect(staffTry.status).toBe(403);
    const anonymous = await call("/api/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ checkoutEnabled: false }),
    });
    expect(anonymous.status).toBe(401);
  });
});

describe("portal terpisah dan izin operator", () => {
  test("cookie pembeli tidak bisa membuka workspace operator", async () => {
    const buyer = await signInAs(BUYER);
    const summary = await call("/api/team/summary", { cookie: buyer.cookie });
    expect(summary.status).toBe(401);
    expect(await summary.json()).toMatchObject({ error: "session_required" });
  });

  test("kredensial operator ditolak di portal pembeli dan sebaliknya", async () => {
    const buyerGuest = await guestSession(call);
    const wrongOperator = await call("/api/auth/login", mutate(buyerGuest, ADMIN));
    expect(wrongOperator.status).toBe(403);
    expect(await wrongOperator.json()).toMatchObject({ error: "wrong_portal" });

    const operatorGuest = await guestSession(call, "operator");
    const wrongBuyer = await call("/api/auth/login?portal=operator", mutate(operatorGuest, BUYER));
    expect(wrongBuyer.status).toBe(403);
    expect(await wrongBuyer.json()).toMatchObject({ error: "wrong_portal" });
  });

  test("login operator tidak memutus sesi pembeli di browser yang sama", async () => {
    const buyer = await signInAs(BUYER);
    const operator = await signInAs(STAFF);
    const combined = `${buyer.cookie}; ${operator.cookie}`;

    const orders = await call("/api/orders", { cookie: combined });
    expect(orders.status).toBe(200);
    const summary = await call("/api/team/summary", { cookie: combined });
    expect(summary.status).toBe(200);
  });

  test("admin tidak menjalankan fulfillment, staff menjalankannya", async () => {
    const buyer = await signInAs(BUYER);
    const staff = await signInAs(STAFF);
    const admin = await signInAs(ADMIN);
    const order = await createOrder(buyer);
    await pay(buyer, order.id);

    const adminReady = await call(`/api/team/orders/${order.id}/ready`, mutate(admin));
    expect(adminReady.status).toBe(403);
    const adminComplete = await call(`/api/team/orders/${order.id}/complete`, mutate(admin));
    expect(adminComplete.status).toBe(403);

    const staffReady = await call(`/api/team/orders/${order.id}/ready`, mutate(staff));
    expect(staffReady.status).toBe(200);
    const staffComplete = await call(`/api/team/orders/${order.id}/complete`, mutate(staff));
    expect(staffComplete.status).toBe(200);
  });

  test("admin membuat staff, mengubah izin, dan mencabut akses", async () => {
    const admin = await signInAs(ADMIN);
    const created = await call(
      "/api/admin/operators",
      mutate(admin, {
        name: "Rani Operator",
        email: "rani@demo.mabakit",
        password: "ranirahasia123",
        permissions: ["orders.view"],
      }),
    );
    expect(created.status).toBe(201);
    const createdText = await created.text();
    expect(createdText).not.toContain("ranirahasia123");
    expect(createdText).not.toContain("pbkdf2");
    const staffId = (JSON.parse(createdText) as { staff: { id: string; permissions: string[] } }).staff.id;

    const staffLogin = await signIn(call, { email: "rani@demo.mabakit", password: "ranirahasia123" }, "operator");
    expect(staffLogin.response.status).toBe(200);
    const viewOnly = staffLogin.session;

    const order = await createOrder(await signInAs(BUYER));
    await pay(await signInAs(BUYER), order.id).catch(() => null);
    const allowed = await call("/api/team/orders", { cookie: viewOnly.cookie });
    expect(allowed.status).toBe(200);
    const readyBlocked = await call(`/api/team/orders/${order.id}/ready`, mutate(viewOnly));
    expect(readyBlocked.status).toBe(403);

    const patched = await call(
      `/api/admin/operators/${staffId}`,
      mutate(admin, { permissions: ["orders.view", "orders.ready", "orders.complete"] }, "PATCH"),
    );
    expect(patched.status).toBe(200);
    const stale = await call("/api/team/summary", { cookie: viewOnly.cookie });
    expect(stale.status).toBe(401);

    const relogin = await signIn(call, { email: "rani@demo.mabakit", password: "ranirahasia123" }, "operator");
    expect(relogin.response.status).toBe(200);
    const ready = await call(`/api/team/orders/${order.id}/ready`, mutate(relogin.session));
    expect(ready.status).toBe(200);

    const revoked = await call(`/api/admin/operators/${staffId}/revoke`, mutate(admin));
    expect(revoked.status).toBe(200);
    const afterRevoke = await call("/api/team/summary", { cookie: relogin.session.cookie });
    expect(afterRevoke.status).toBe(401);
    const loginAgain = await signIn(call, { email: "rani@demo.mabakit", password: "ranirahasia123" }, "operator");
    expect(loginAgain.response.status).toBe(401);
  });

  test("admin tidak dapat mengubah atau menonaktifkan akun admin", async () => {
    const admin = await signInAs(ADMIN);
    const list = (await (await call("/api/admin/operators", { cookie: admin.cookie })).json()) as {
      operators: { id: string; email: string }[];
    };
    const self = list.operators.find((entry) => entry.email === ADMIN.email);
    expect(self).toBeTruthy();
    const patch = await call(`/api/admin/operators/${self?.id}`, mutate(admin, { disabled: true }, "PATCH"));
    expect(patch.status).toBe(403);
    const revoke = await call(`/api/admin/operators/${self?.id}/revoke`, mutate(admin));
    expect(revoke.status).toBe(403);
  });

  test("KPI admin menghitung transisi per staff dan tidak menebak aktor", async () => {
    const admin = await signInAs(ADMIN);
    const staff = await signInAs(STAFF);
    const buyer = await signInAs(BUYER);
    const first = await createOrder(buyer);
    await pay(buyer, first.id);
    await call(`/api/team/orders/${first.id}/ready`, mutate(staff));
    await call(`/api/team/orders/${first.id}/complete`, mutate(staff));

    db.raw()
      .prepare("INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, safe_metadata, request_id, created_at) VALUES (?, NULL, 'order_ready', 'order', ?, '{}', ?, ?)")
      .run("audit-unattributed", first.id, "req-unattributed", NOW.getTime());

    const response = await call("/api/admin/kpi?period=all", { cookie: admin.cookie });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      sales: { paidOrders: number; simulated: boolean };
      staff: { email: string; readyCount: number; completeCount: number }[];
      unattributed: { readyCount: number; completeCount: number };
    };
    const staffRow = body.staff.find((entry) => entry.email === STAFF.email);
    expect(staffRow).toMatchObject({ readyCount: 1, completeCount: 1 });
    expect(body.unattributed).toEqual({ readyCount: 1, completeCount: 0 });
    expect(body.sales).toMatchObject({ paidOrders: 1, simulated: true });

    const staffKpi = await call("/api/admin/kpi?period=all", { cookie: staff.cookie });
    expect(staffKpi.status).toBe(403);
  });
});

describe("diskon persen dan pesanan gratis", () => {
  test("diskon 12,5 persen dihitung integer dan 100 persen membuat pesanan gratis", async () => {
    const admin = await signInAs(ADMIN);
    const buyer = await signInAs(BUYER);

    const discount = await call("/api/admin/products/p-topi", mutate(admin, { discountBasisPoints: 1250 }, "PATCH"));
    expect(discount.status).toBe(200);

    const catalog = (await (await call("/api/catalog")).json()) as {
      products: { id: string; basePriceRp: number; finalPriceRp: number; discountBasisPoints: number; variants: { priceRp: number }[] }[];
    };
    const item = catalog.products.find((product) => product.id === "p-topi");
    expect(item).toMatchObject({ basePriceRp: 35000, finalPriceRp: 30625, discountBasisPoints: 1250 });
    expect(item?.variants[0]?.priceRp).toBe(30625);

    const paid = await createOrder(buyer, { items: [{ productId: "p-topi", variantId: "v-topi-feb", quantity: 1 }] });
    expect(paid.totalRp).toBe(30625);
    expect(paid.items[0]).toMatchObject({ basePriceRp: 35000, unitPriceRp: 30625, discountBasisPoints: 1250 });

    const free = await call("/api/admin/products/p-topi", mutate(admin, { discountBasisPoints: 10000 }, "PATCH"));
    expect(free.status).toBe(200);
    const body = await createOrder(buyer, {
      idempotencyKey: "checkout-free-0001",
      method: "QRIS",
      items: [{ productId: "p-topi", variantId: "v-topi-feb", quantity: 2 }],
    });
    expect(body).toMatchObject({ totalRp: 0, paymentStatus: "PAID", method: "FREE" });
    expect(body.invoice?.invoiceNumber).toBeTruthy();
    expect(body.items[0]).toMatchObject({ basePriceRp: 35000, unitPriceRp: 0 });

    const stock = db.raw().prepare("SELECT stock_on_hand, stock_reserved FROM variants WHERE id = 'v-topi-feb'").get() as { stock_on_hand: number; stock_reserved: number };
    expect(stock).toEqual({ stock_on_hand: 8, stock_reserved: 1 });
  });
});

describe("ekspor penjualan", () => {
  test("CSV admin memuat penjualan tanpa PII dan menetralkan formula", async () => {
    const { csvCell } = await import("../../src/admin-export");
    const admin = await signInAs(ADMIN);
    const buyer = await signInAs(BUYER);
    const order = await createOrder(buyer, {
      idempotencyKey: "checkout-export-001",
      items: [{ productId: "p-topi", variantId: "v-topi-feb", quantity: 1 }],
    });
    const paid = await call(`/api/demo/orders/${order.id}/check-payment`, mutate(buyer));
    expect(paid.status).toBe(200);

    const response = await call("/api/admin/export/sales.csv", { cookie: admin.cookie });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    const body = await response.text();
    expect(body.split("\r\n")[0]).toBe(
      "invoice,pesanan,dibayar_wib,fakultas,metode,subtotal_rp,diskon_rp,total_rp",
    );
    expect(body).toContain(order.orderNumber);
    expect(body).not.toContain(BUYER.email);
    expect(body).not.toContain("081234567890");

    const forbidden = await call("/api/admin/export/sales.csv", { cookie: buyer.cookie });
    expect([401, 403]).toContain(forbidden.status);
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });

  test("subtotal, diskon, dan total pada CSV memakai snapshot tagihan", async () => {
    const admin = await signInAs(ADMIN);
    const buyer = await signInAs(BUYER);
    const patched = await call("/api/admin/products/p-topi", mutate(admin, { discountBasisPoints: 1250 }, "PATCH"));
    expect(patched.status).toBe(200);
    const order = await createOrder(buyer, {
      idempotencyKey: "checkout-export-002",
      items: [{ productId: "p-topi", variantId: "v-topi-feb", quantity: 2 }],
    });
    await call(`/api/demo/orders/${order.id}/check-payment`, mutate(buyer));

    const body = await (await call("/api/admin/export/sales.csv", { cookie: admin.cookie })).text();
    const row = body.split("\r\n").find((line) => line.includes(order.orderNumber));
    // 2 x 35000 dasar, diskon 12,5 persen 8750, tagihan 61250.
    expect(row?.endsWith(",70000,8750,61250")).toBe(true);
  });
});

describe("galeri foto admin", () => {
  const png = (width = 1, height = 1) =>
    new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
      (width >>> 24) & 255, (width >>> 16) & 255, (width >>> 8) & 255, width & 255,
      (height >>> 24) & 255, (height >>> 16) & 255, (height >>> 8) & 255, height & 255,
      8, 6, 0, 0, 0,
    ]);

  const upload = async (admin: Session, bytes: Uint8Array) =>
    call("/api/admin/products/p-topi/photos", {
      method: "POST",
      cookie: admin.cookie,
      csrf: admin.csrf,
      headers: { "content-type": "image/png" },
      body: bytes,
    });

  test("maksimal lima foto, validasi gambar, dan penyajian media", async () => {
    const admin = await signInAs(ADMIN);
    for (let i = 0; i < 5; i += 1) expect((await upload(admin, png())).status).toBe(201);
    const full = await upload(admin, png());
    expect(full.status).toBe(409);
    expect(((await full.json()) as { error: string }).error).toBe("photo_limit");

    const list = (await (await call("/api/admin/products/p-topi/photos", { cookie: admin.cookie })).json()) as {
      photos: { url: string }[];
    };
    expect(list.photos).toHaveLength(5);
    const mediaResponse = await call(list.photos[0].url);
    expect(mediaResponse.status).toBe(200);
    expect(mediaResponse.headers.get("content-type")).toBe("image/png");

    const bad = await call("/api/admin/products/p-topi/photos", {
      method: "POST",
      cookie: admin.cookie,
      csrf: admin.csrf,
      headers: { "content-type": "text/plain" },
      body: "nope",
    });
    expect(bad.status).toBe(400);
  });
});

describe("perbaikan audit review", () => {
  const webp = (width: number, height: number, animated = false) => {
    const bytes = new Uint8Array(30);
    const ascii = (offset: number, text: string) => {
      for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i);
    };
    ascii(0, "RIFF");
    ascii(8, "WEBP");
    ascii(12, "VP8X");
    bytes[20] = animated ? 0x02 : 0;
    const w = width - 1;
    const h = height - 1;
    bytes[24] = w & 0xff;
    bytes[25] = (w >> 8) & 0xff;
    bytes[26] = (w >> 16) & 0xff;
    bytes[27] = h & 0xff;
    bytes[28] = (h >> 8) & 0xff;
    bytes[29] = (h >> 16) & 0xff;
    return bytes;
  };

  const png = (width = 2, height = 2) =>
    new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
      (width >>> 24) & 255, (width >>> 16) & 255, (width >>> 8) & 255, width & 255,
      (height >>> 24) & 255, (height >>> 16) & 255, (height >>> 8) & 255, height & 255,
      8, 6, 0, 0, 0,
    ]);

  const upload = (admin: Session, bytes: Uint8Array, type = "image/png") =>
    call("/api/admin/products/p-topi/photos", {
      method: "POST",
      cookie: admin.cookie,
      csrf: admin.csrf,
      headers: { "content-type": type },
      body: bytes,
    });

  test("WebP little-endian diterima dengan dimensi benar dan WebP animasi ditolak", async () => {
    const admin = await signInAs(ADMIN);
    const ok = await upload(admin, webp(480, 320), "image/webp");
    expect(ok.status).toBe(201);
    const body = (await ok.json()) as { photo: { width: number; height: number } };
    expect(body.photo).toMatchObject({ width: 480, height: 320 });

    const animated = await upload(admin, webp(480, 320, true), "image/webp");
    expect(animated.status).toBe(400);
  });

  test("hapus foto tengah lalu unggah lagi tetap berhasil", async () => {
    const admin = await signInAs(ADMIN);
    for (let i = 0; i < 5; i += 1) expect((await upload(admin, png())).status).toBe(201);
    const list = (await (await call("/api/admin/products/p-topi/photos", { cookie: admin.cookie })).json()) as {
      photos: { id: string }[];
    };
    const deleted = await call(`/api/admin/products/p-topi/photos/${list.photos[0].id}`, {
      method: "DELETE",
      cookie: admin.cookie,
      csrf: admin.csrf,
    });
    expect(deleted.status).toBe(200);
    const again = await upload(admin, png());
    expect(again.status).toBe(201);
  });

  test("unggah pertama menggantikan sampul lama produk seed", async () => {
    const admin = await signInAs(ADMIN);
    const before = await ctx_db_image_path();
    expect(before).not.toContain("/media/");
    const uploaded = await upload(admin, png());
    expect(uploaded.status).toBe(201);
    expect(await ctx_db_image_path()).toContain("/media/");
  });

  async function ctx_db_image_path() {
    const row = db.raw().prepare("SELECT image_path FROM products WHERE id = 'p-topi'").get() as { image_path: string | null };
    return row.image_path ?? "";
  }

  test("diskon paket ditolak, bukan disimpan tanpa efek", async () => {
    const admin = await signInAs(ADMIN);
    const response = await call("/api/admin/products/p-paket-starter", mutate(admin, { discountBasisPoints: 2000 }, "PATCH"));
    expect(response.status).toBe(400);
    expect(((await response.json()) as { field?: string }).field).toBe("discountBasisPoints");
  });

  test("pesanan gratis dibatasi per akun agar stok tidak terkuras", async () => {
    const admin = await signInAs(ADMIN);
    const buyer = await signInAs(BUYER);
    await call("/api/admin/products/p-topi", mutate(admin, { discountBasisPoints: 10000 }, "PATCH"));
    const statuses: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const response = await call("/api/checkout/create", {
        ...mutate(buyer, {
          buyerName: "Siti Rahma",
          contactPhone: "081234567890",
          email: "pembeli@demo.mabakit",
          method: "QRIS",
          idempotencyKey: `checkout-gratis-000${i}`,
          items: [{ productId: "p-topi", variantId: "v-topi-feb", quantity: 1 }],
        }),
      });
      statuses.push(response.status);
    }
    expect(statuses[0]).toBe(201);
    expect(statuses.filter((status) => status === 201).length).toBeLessThan(3);
    expect(statuses).toContain(429);
  });

  test("ekspor penjualan tercatat di audit", async () => {
    const admin = await signInAs(ADMIN);
    const response = await call("/api/admin/export/sales.csv", { cookie: admin.cookie });
    expect(response.status).toBe(200);
    const audit = (await (await call("/api/admin/audit", { cookie: admin.cookie })).json()) as {
      logs: { action: string }[];
    };
    expect(audit.logs.some((log) => log.action === "sales_exported")).toBe(true);
  });
});
