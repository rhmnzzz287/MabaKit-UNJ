import { beforeEach, describe, expect, test } from "vitest";
import worker from "../../src/index";
import type { Env } from "../../src/http";
import { TestD1 } from "./d1";
import { seedDemo } from "./db";
import { ADMIN, BUYER, STAFF, makeCall, signIn, type Call, type Session } from "./harness";

const ORIGIN = "https://mabakit.test";

function env(db: D1Database, assetBody = "<html>spa</html>"): Env {
  return {
    APP_MODE: "demo",
    DEMO_SECRET: "test-secret",
    DB: db,
    ASSETS: {
      fetch: async () => new Response(assetBody, { headers: { "content-type": "text/html" } }),
    } as unknown as Fetcher,
  };
}

describe("routing Worker", () => {
  test("API tak dikenal menghasilkan JSON 404, bukan SPA", async () => {
    const res = await worker.fetch(new Request(`${ORIGIN}/api/nope`), env({} as D1Database));
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toMatchObject({ error: "not_found" });
  });

  test("route UI diteruskan ke static assets", async () => {
    const res = await worker.fetch(new Request(`${ORIGIN}/orders/123`), env({} as D1Database, "<html>spa</html>"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("spa");
  });
});

describe("guard halaman privat", () => {
  let db: TestD1;
  let call: Call;
  let buyer: Session;
  let staff: Session;
  let admin: Session;

  beforeEach(async () => {
    db = new TestD1();
    seedDemo(db.raw());
    call = makeCall(env(db as unknown as D1Database));
    buyer = (await signIn(call, BUYER)).session;
    staff = (await signIn(call, STAFF)).session;
    admin = (await signIn(call, ADMIN)).session;
  });

  test.each(["/team", "/team/orders", "/admin", "/staff", "/staff/orders"])(
    "anonim di %s diarahkan ke halaman login operator",
    async (path) => {
      const response = await call(path);
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(
        `/operator/login?next=${encodeURIComponent(path === "/staff" || path === "/staff/orders" ? "/team/orders" : path)}`,
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    },
  );

  test("pembeli yang login ditolak dengan HTML 403 yang tidak di-cache", async () => {
    for (const path of ["/team", "/team/orders", "/admin", "/staff"]) {
      const response = await call(path, { cookie: buyer.cookie });
      expect(response.status).toBe(403);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(await response.text()).toContain("Akses terbatas");
    }
  });

  test("staf dan admin mendapat aset halaman privat dengan header no-store", async () => {
    const team = await call("/team", { cookie: staff.cookie });
    expect(team.status).toBe(200);
    expect(await team.text()).toContain("spa");
    expect(team.headers.get("cache-control")).toBe("no-store");
    expect(team.headers.get("x-robots-tag")).toBe("noindex, nofollow");

    const adminPage = await call("/admin", { cookie: admin.cookie });
    expect(adminPage.status).toBe(200);
    expect(adminPage.headers.get("cache-control")).toBe("no-store");
  });

  test("staf tidak boleh membuka halaman admin, tetapi diarahkan dari /staff ke /team/orders", async () => {
    const denied = await call("/admin", { cookie: staff.cookie });
    expect(denied.status).toBe(403);
    expect(await denied.text()).toContain("hanya untuk admin");

    for (const path of ["/staff", "/staff/orders", "/staff/pickup"]) {
      const response = await call(path, { cookie: staff.cookie });
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("/team/orders");
    }

    const unknown = await call("/staff/lainnya", { cookie: staff.cookie });
    expect(unknown.status).toBe(404);
  });

  test.each(["/Team", "/TEAM/orders", "/Admin", "/STAFF/orders", "//team//orders", "/team/../admin"])(
    "variasi penulisan %s tetap melewati guard",
    async (path) => {
      const anonymous = await call(path);
      expect(anonymous.status).toBe(302);
      expect(anonymous.headers.get("location") ?? "").toContain("/operator/login?next=");

      const asBuyer = await call(path, { cookie: buyer.cookie });
      expect(asBuyer.status).toBe(403);
    },
  );

  test("halaman publik tidak ikut dijaga", async () => {
    const response = await call("/");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBeNull();
  });
});
