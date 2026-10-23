import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ensureSession } from "./api";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

let calls: string[];

function stub(routes: Record<string, () => Response>) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(`${init?.method ?? "GET"} ${url}`);
      return routes[`${init?.method ?? "GET"} ${url}`]?.() ?? json({ error: "not_found" }, 404);
    }),
  );
}

describe("ensureSession", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "mbk_csrf=; path=/; max-age=0";
    stub({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("membuat sesi tamu saat cookie CSRF belum ada", async () => {
    stub({ "POST /api/demo/session": () => json({ csrfToken: "baru" }, 201) });
    await ensureSession();
    expect(calls).toEqual(["POST /api/demo/session"]);
  });

  test("cookie CSRF tertinggal dari sesi yang hilang diganti sesi tamu baru", async () => {
    document.cookie = "mbk_csrf=usang; path=/";
    stub({
      "GET /api/auth/session": () => json({ session: null, user: null, role: "buyer" }),
      "POST /api/demo/session": () => json({ csrfToken: "baru" }, 201),
    });
    await ensureSession();
    expect(calls).toEqual(["GET /api/auth/session", "POST /api/demo/session"]);
  });

  test("sesi yang masih hidup tidak diganti", async () => {
    document.cookie = "mbk_csrf=hidup; path=/";
    stub({
      "GET /api/auth/session": () => json({ session: { expiresAt: Date.now() + 60_000 }, user: null, role: "buyer" }),
    });
    await ensureSession();
    expect(calls).toEqual(["GET /api/auth/session"]);
  });
});

describe("authenticate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("mengulang login sekali setelah sesi kedaluwarsa di tengah jalan", async () => {
    document.cookie = "mbk_csrf=usang; path=/";
    let loginAttempts = 0;
    calls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        calls.push(`${method} ${url}`);
        if (url === "/api/auth/session") return json({ session: { expiresAt: Date.now() + 60_000 }, user: null, role: "buyer" });
        if (url === "/api/demo/session" && method === "POST") return json({ csrfToken: "baru" }, 201);
        if (url === "/api/auth/login" && method === "POST") {
          loginAttempts += 1;
          if (loginAttempts === 1) return json({ error: "session_required", message: "Sesi berakhir." }, 401);
          return json({ user: { id: "usr-buyer", email: "pembeli@demo.mabakit", role: "buyer", name: "Siti" } });
        }
        return json({ error: "not_found" }, 404);
      }),
    );
    const { authenticate } = await import("./api");
    const body = await authenticate<{ user: { name: string } }>("/api/auth/login", { email: "a", password: "b" });
    expect(body.user.name).toBe("Siti");
    expect(loginAttempts).toBe(2);
    expect(calls).toContain("POST /api/demo/session");
  });
});
