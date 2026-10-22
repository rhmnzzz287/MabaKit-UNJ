import { describe, expect, test } from "vitest";
import worker from "../../worker/index";
import type { Env } from "../../worker/http";

function env(assetBody = "<html>spa</html>"): Env {
  return {
    APP_MODE: "demo",
    DEMO_SECRET: "test-secret",
    DB: {} as D1Database,
    ASSETS: {
      fetch: async () => new Response(assetBody, { headers: { "content-type": "text/html" } }),
    } as unknown as Fetcher,
  };
}

describe("routing Worker", () => {
  test("API tak dikenal menghasilkan JSON 404, bukan SPA", async () => {
    const res = await worker.fetch(new Request("https://mabakit.test/api/nope"), env());
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toMatchObject({ error: "not_found" });
  });

  test("route UI diteruskan ke static assets", async () => {
    const res = await worker.fetch(new Request("https://mabakit.test/orders/123"), env("<html>spa</html>"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("spa");
  });
});
