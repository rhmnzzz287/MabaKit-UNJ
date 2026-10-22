import { adminAudit, adminSettings, adminStock, adminSummary } from "./admin";
import { catalog, productDetail } from "./catalog";
import { createCheckout } from "./checkout";
import {
  type Ctx,
  type Env,
  fail,
  json,
  loadSession,
  requireMutation,
  requireOperator,
  requireSession,
} from "./http";
import { checkPayment, getOrder, invoice, issuePickupToken, listOrders } from "./orders";
import { createSession, registerOperator } from "./session";
import { staffClaim, staffLookup, staffOrders, staffReady } from "./staff";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const ctx: Ctx = { request, env, url, now: Date.now(), requestId: crypto.randomUUID() };

    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (url.pathname.startsWith("/api/demo/") && env.APP_MODE !== "demo") return fail("not_found");

    const parts = url.pathname.split("/").filter(Boolean);
    const method = request.method.toUpperCase();

    try {
      return await route(ctx, parts, method);
    } catch (error) {
      console.error("api_error", { path: url.pathname, message: error instanceof Error ? error.message : String(error) });
      return fail("internal");
    }
  },
} satisfies { fetch: (request: Request, env: Env) => Promise<Response> };

async function route(ctx: Ctx, parts: string[], method: string): Promise<Response> {
  const [, area, ...rest] = parts;

  if (area === "health" && method === "GET") return json({ ok: true, mode: ctx.env.APP_MODE });

  if (area === "demo" && rest[0] === "session" && method === "POST") return createSession(ctx);

  if (area === "demo" && rest[0] === "operator" && method === "POST") {
    const session = await requireSession(ctx);
    if (session instanceof Response) return session;
    const blocked = await requireMutation(ctx, session);
    return blocked ?? registerOperator(ctx, session);
  }

  if (area === "catalog") {
    if (!rest[0] && method === "GET") return catalog(ctx);
    if (rest[0] && method === "GET" && rest.length === 1) return productDetail(ctx, rest[0]);
  }

  if (area === "checkout" && rest[0] === "create" && method === "POST") {
    const session = await requireSession(ctx);
    if (session instanceof Response) return session;
    const blocked = await requireMutation(ctx, session);
    return blocked ?? createCheckout(ctx, session);
  }

  if (area === "orders" && method === "GET" && !rest[0]) {
    const session = await requireSession(ctx);
    if (session instanceof Response) return session;
    return listOrders(ctx, session);
  }

  if (area === "orders" && rest[0]) {
    const session = await requireSession(ctx);
    if (session instanceof Response) return session;
    const [id, action] = rest;
    if (!action && method === "GET") return getOrder(ctx, session, id);
    if (action === "invoice" && method === "GET") return invoice(ctx, session, id);
    if (action === "pickup-token" && method === "POST") {
      const blocked = await requireMutation(ctx, session);
      return blocked ?? issuePickupToken(ctx, session, id);
    }
  }

  if (area === "demo" && rest[0] === "orders" && rest[1] && rest[2] === "check-payment" && method === "POST") {
    const session = await requireSession(ctx);
    if (session instanceof Response) return session;
    const blocked = await requireMutation(ctx, session);
    return blocked ?? checkPayment(ctx, session, rest[1]);
  }

  if (area === "staff") {
    const session = await requireSession(ctx);
    if (session instanceof Response) return session;
    const operator = await requireOperator(ctx, session, ["staff", "admin"]);
    if (operator instanceof Response) return operator;

    if (rest[0] === "orders" && !rest[1] && method === "GET") return staffOrders(ctx);
    if (rest[0] === "orders" && rest[2] === "ready" && method === "POST") {
      const blocked = await requireMutation(ctx, session);
      return blocked ?? staffReady(ctx, operator, rest[1]);
    }
    if (rest[0] === "pickup" && rest[1] === "lookup" && method === "POST") {
      const blocked = await requireMutation(ctx, session);
      return blocked ?? staffLookup(ctx, operator);
    }
    if (rest[0] === "pickup" && rest[1] === "claim" && method === "POST") {
      const blocked = await requireMutation(ctx, session);
      return blocked ?? staffClaim(ctx, operator);
    }
  }

  if (area === "admin") {
    const session = await requireSession(ctx);
    if (session instanceof Response) return session;
    const operator = await requireOperator(ctx, session, ["admin"]);
    if (operator instanceof Response) return operator;

    if (rest[0] === "summary" && method === "GET") return adminSummary(ctx);
    if (rest[0] === "audit" && method === "GET") return adminAudit(ctx);
    if (rest[0] === "settings" && method === "PATCH") {
      const blocked = await requireMutation(ctx, session);
      return blocked ?? adminSettings(ctx, operator);
    }
    if (rest[0] === "variants" && rest[2] === "stock" && method === "POST") {
      const blocked = await requireMutation(ctx, session);
      return blocked ?? adminStock(ctx, operator, rest[1]);
    }
  }

  const session = await loadSession(ctx);
  if (session && ctx.url.pathname === "/api/demo/session" && method === "GET") {
    return json({ session: { expiresAt: session.expires_at } });
  }

  return fail("not_found");
}
