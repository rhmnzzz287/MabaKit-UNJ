import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Env } from "../../src/http";
import { TestD1 } from "./d1";
import { seedDemo } from "./db";
import { type Call, makeCall } from "./harness";

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

function addPhoto(id: string, productId: string, key: string, position: number, width = 800, height = 600): void {
  db.raw()
    .prepare(
      `INSERT INTO product_photos (id, product_id, object_key, content_type, bytes, width, height, position, created_at)
       VALUES (?, ?, ?, 'image/jpeg', 2048, ?, ?, ?, ?)`,
    )
    .run(id, productId, key, width, height, position, NOW.getTime());
}

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

type GalleryPhoto = { id: string; url: string; width: number; height: number };

describe("galeri foto publik", () => {
  test("detail produk aktif memuat foto urut position lalu id lewat /media", async () => {
    addPhoto("ph-b", "p-topi", "products/topi-b.jpg", 2, 900, 700);
    addPhoto("ph-a", "p-topi", "products/topi-a.jpg", 0, 640, 480);
    addPhoto("ph-c", "p-topi", "products/topi-c.jpg", 0, 1024, 768);

    const response = await call("/api/catalog/p-topi");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { product: { id: string; photos?: GalleryPhoto[] } };

    expect(body.product.photos).toEqual([
      { id: "ph-a", url: "/media/products/topi-a.jpg", width: 640, height: 480 },
      { id: "ph-c", url: "/media/products/topi-c.jpg", width: 1024, height: 768 },
      { id: "ph-b", url: "/media/products/topi-b.jpg", width: 900, height: 700 },
    ]);

    const list = (await (await call("/api/catalog")).json()) as {
      products: { id: string; photos?: GalleryPhoto[] }[];
      packages: { id: string }[];
    };
    expect(list.products.find((product) => product.id === "p-topi")?.photos).toHaveLength(3);
  });

  test("foto produk nonaktif tidak bocor dan paket tetap tanpa galeri", async () => {
    addPhoto("ph-goodie", "p-goodie", "products/goodie.jpg", 0);

    const hidden = await call("/api/catalog/p-goodie");
    expect(hidden.status).toBe(404);
    expect(JSON.stringify(await (await call("/api/catalog")).json())).not.toContain("products/goodie.jpg");

    const paket = await call("/api/catalog/p-paket-hemat");
    expect(paket.status).toBe(200);
    const body = (await paket.json()) as { product: { priceRp: number; photos?: GalleryPhoto[] } };
    expect(body.product).not.toHaveProperty("photos");
    expect(body.product.priceRp).toBeGreaterThan(0);
  });

  test("berkas foto publik disajikan dari R2 dengan cache immutable", async () => {
    objects.set("products/topi-a.jpg", { bytes: new Uint8Array([1, 2, 3]), type: "image/jpeg" });

    const response = await call("/media/products/topi-a.jpg");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });
});
