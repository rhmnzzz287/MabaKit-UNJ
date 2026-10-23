import worker from "../../src/index";
import type { Env } from "../../src/http";

export type Session = { cookie: string; csrf: string; portal: "buyer" | "operator" };

export type CallInit = RequestInit & { cookie?: string; csrf?: string; origin?: string };

export type Call = (path: string, init?: CallInit) => Promise<Response>;

export const BUYER = { email: "pembeli@demo.mabakit", password: "buyermabakit123" };
export const STAFF = { email: "tim@demo.mabakit", password: "staffmabakit123" };
export const ADMIN = { email: "mabakita@admin", password: "admin123" };

/** Pemanggil route dengan origin default same-origin, seperti browser. */
export function makeCall(env: Env): Call {
  return (path, init = {}) => {
    const headers = new Headers(init.headers);
    if (init.cookie) headers.set("cookie", init.cookie);
    if (init.csrf) headers.set("x-csrf", init.csrf);
    if (init.origin) headers.set("origin", init.origin);
    else if (!headers.has("origin")) headers.set("origin", "http://localhost");
    return worker.fetch(new Request(`http://localhost${path}`, { ...init, headers }), env);
  };
}

/** Ambil pasangan cookie sesi dari respons (login merotasi keduanya). */
export function readSession(response: Response): Session {
  const jar = new Map<string, string>();
  for (const line of response.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const index = pair.indexOf("=");
    jar.set(pair.slice(0, index).trim(), pair.slice(index + 1));
  }
  const portal = jar.has("mbk_op_sess") ? "operator" : "buyer";
  const tokenName = portal === "operator" ? "mbk_op_sess" : "mbk_sess";
  const csrfName = portal === "operator" ? "mbk_op_csrf" : "mbk_csrf";
  const token = jar.get(tokenName) ?? "";
  const csrf = jar.get(csrfName) ?? "";
  return { cookie: `${tokenName}=${token}; ${csrfName}=${csrf}`, csrf, portal };
}

export async function guestSession(call: Call, portal: "buyer" | "operator" = "buyer"): Promise<Session> {
  const response = await call("/api/demo/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ portal }),
  });
  const session = readSession(response);
  return { ...session, portal };
}

export async function signIn(
  call: Call,
  account: { email: string; password: string } = BUYER,
  portal?: "buyer" | "operator",
): Promise<{ session: Session; response: Response }> {
  const resolved = portal ?? (account.email === STAFF.email || account.email === ADMIN.email ? "operator" : "buyer");
  const guest = await guestSession(call, resolved);
  const suffix = resolved === "operator" ? "?portal=operator" : "";
  const response = await call(`/api/auth/login${suffix}`, {
    method: "POST",
    cookie: guest.cookie,
    csrf: guest.csrf,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(account),
  });
  return { session: readSession(response), response };
}

/** Init request bermutasi: cookie sesi + header CSRF, body JSON opsional. */
export function mutate(session: Session, body?: unknown, method = "POST"): CallInit {
  const init: CallInit = { method, cookie: session.cookie, csrf: session.csrf };
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return init;
}

export function checkoutBody(overrides: Record<string, unknown> = {}) {
  return {
    buyerName: "Siti Rahma",
    contactPhone: "081234567890",
    email: "pembeli@demo.mabakit",
    method: "QRIS",
    idempotencyKey: "checkout-key-000001",
    items: [{ productId: "p-topi", variantId: "v-topi-ft", quantity: 1 }],
    ...overrides,
  };
}
