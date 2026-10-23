import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { authSnapshot, refreshAuth } from "./auth-store";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

const guest = { session: { expiresAt: Date.now() + 60_000 }, user: null, role: "buyer" };
const buyer = {
  session: { expiresAt: Date.now() + 60_000 },
  user: { id: "usr-buyer", email: "pembeli@demo.mabakit", role: "buyer", name: "Siti" },
  role: "buyer",
};

type Deferred = { resolve: (data: Response) => void; reject: (error: unknown) => void };

function stubFetch(): Deferred[] {
  const pending: Deferred[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          pending.push({ resolve, reject });
        }),
    ),
  );
  return pending;
}

beforeEach(() => {
  document.cookie = "mbk_csrf=csrf; path=/";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("refreshAuth versi request", () => {
  test("respons tamu yang terlambat tidak menimpa snapshot sesi pembeli yang lebih baru", async () => {
    const pending = stubFetch();
    const first = refreshAuth();
    const second = refreshAuth();
    expect(pending).toHaveLength(2);

    pending[1].resolve(json(buyer));
    expect(await second).toEqual({ state: "ready", role: "buyer", user: buyer.user, error: null });

    pending[0].resolve(json(guest));
    await first;
    expect(authSnapshot("buyer")).toEqual({ state: "ready", role: "buyer", user: buyer.user, error: null });
  });

  test("respons terbalik tetap menghasilkan snapshot terbaru", async () => {
    const pending = stubFetch();
    const first = refreshAuth();
    const second = refreshAuth();

    pending[0].resolve(json(guest));
    await first; // versi 1 diungguli versi 2: hasil tamu dibuang, tidak tersimpan
    expect(authSnapshot("buyer")).not.toMatchObject({ user: guest.user });

    pending[1].resolve(json(buyer));
    await second;
    expect(authSnapshot("buyer").user).toEqual(buyer.user);
  });

  test("kegagalan request yang tertinggal tidak menandai snapshot error", async () => {
    const pending = stubFetch();
    const first = refreshAuth();
    const second = refreshAuth();

    pending[1].resolve(json(buyer));
    await second;

    pending[0].reject(new TypeError("gagal jaringan"));
    await first;
    expect(authSnapshot("buyer")).toEqual({ state: "ready", role: "buyer", user: buyer.user, error: null });
  });
});
