import { adminAudit, adminOperators, adminRevokeOperator, adminSettings, adminStock, adminSummary } from "./admin";
import {
  adminAliases,
  adminCatalog,
  adminCreateProduct,
  adminCreateVariant,
  adminSavePackageConfig,
  adminUpdateProduct,
  adminUpdateVariant,
} from "./admin-catalog";
import { authSession, login, logout, register } from "./auth";
import {
  adminCreateStaff,
  adminEnableStaff,
  adminKpi,
  adminUpdateStaff,
} from "./admin-team";
import { adminExportSales } from "./admin-export";
import { adminDeletePhoto, adminPhotos, adminReorderPhotos, adminUploadPhoto, mediaObject } from "./admin-media";
import { catalog, packageQuote, productDetail } from "./catalog";
import { createCheckout } from "./checkout";
import {
  type Ctx,
  type Env,
  fail,
  json,
  loadOperator,
  loadSession,
  requireMutation,
  requireOperator,
  requireSession,
} from "./http";
import { checkPayment, emailPreview, getOrder, invoice, listOrders } from "./orders";
import { guardPage } from "./pages";
import { getProfile, saveProfile } from "./profile";
import { createReview, listReviews } from "./reviews";
import { createSession } from "./session";
import { staffReady } from "./staff";
import { teamComplete, teamOrderDetail, teamOrders, teamSummary } from "./team";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const ctx: Ctx = { request, env, url, now: Date.now(), requestId: crypto.randomUUID() };

    if (!url.pathname.startsWith("/api/")) {
      if (url.pathname.startsWith("/media/") && request.method === "GET") {
        let key = url.pathname.slice("/media/".length);
        try {
          key = decodeURIComponent(key);
        } catch {
          return new Response("Not found", { status: 404 });
        }
        return mediaObject(ctx, key);
      }
      const guarded = await guardPage(ctx);
      return guarded ?? env.ASSETS.fetch(request);
    }
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

  if (area === "auth") {
    const portal = ctx.url.searchParams.get("portal") === "operator" ? "operator" : "buyer";
    if (rest[0] === "session" && !rest[1] && method === "GET") {
      const session = await loadSession(ctx, portal);
      if (!session) {
        return json({ session: null, user: null, role: portal === "operator" ? null : "buyer", portal });
      }
      return authSession(ctx, session);
    }
    if ((rest[0] === "register" || rest[0] === "login" || rest[0] === "logout") && !rest[1] && method === "POST") {
      const session = await requireSession(ctx, portal);
      if (session instanceof Response) return session;
      const blocked = await requireMutation(ctx, session);
      if (blocked) return blocked;
      if (rest[0] === "register") return register(ctx, session);
      if (rest[0] === "login") return login(ctx, session);
      return logout(ctx, session);
    }
  }

  if (area === "catalog") {
    if (!rest[0] && method === "GET") return catalog(ctx);
    if (rest[0] && method === "GET" && rest.length === 1) return productDetail(ctx, rest[0]);
  }

  if (area === "packages" && rest[0] && rest[1] === "quote" && method === "GET") {
    return packageQuote(ctx, rest[0], ctx.url.searchParams.get("faculty"));
  }

  if (area === "reviews" && !rest[0] && method === "GET") return listReviews(ctx);

  if (area === "checkout" && rest[0] === "create" && method === "POST") {
    const session = await requireSession(ctx, "buyer");
    if (session instanceof Response) return session;
    const blocked = await requireMutation(ctx, session);
    return blocked ?? createCheckout(ctx, session);
  }

  if (area === "profile") {
    const session = await requireSession(ctx, "buyer");
    if (session instanceof Response) return session;
    if (!rest[0] && method === "GET") return getProfile(ctx, session);
    if (!rest[0] && method === "PATCH") {
      const blocked = await requireMutation(ctx, session);
      return blocked ?? saveProfile(ctx, session);
    }
  }

  if (area === "orders" && method === "GET" && !rest[0]) {
    const session = await requireSession(ctx, "buyer");
    if (session instanceof Response) return session;
    return listOrders(ctx, session);
  }

  if (area === "orders" && rest[0]) {
    const session = await requireSession(ctx, "buyer");
    if (session instanceof Response) return session;
    const [id, action] = rest;
    if (!action && method === "GET") return getOrder(ctx, session, id);
    if (action === "invoice" && method === "GET") return invoice(ctx, session, id);
    if (action === "email-preview" && method === "GET") return emailPreview(ctx, session, id);
    if (action === "review" && method === "POST") {
      const blocked = await requireMutation(ctx, session);
      return blocked ?? createReview(ctx, session, id);
    }
  }

  if (area === "demo" && rest[0] === "orders" && rest[1] && rest[2] === "check-payment" && method === "POST") {
    const session = await requireSession(ctx, "buyer");
    if (session instanceof Response) return session;
    const blocked = await requireMutation(ctx, session);
    return blocked ?? checkPayment(ctx, session, rest[1]);
  }

  if (area === "team") return teamRoute(ctx, rest, method);

  if (area === "staff") {
    const isList = rest[0] === "orders" && !rest[1] && method === "GET";
    const isReady = rest[0] === "orders" && rest[1] && rest[2] === "ready" && method === "POST";
    if (!isList && !isReady) return fail("not_found");
    const session = await requireSession(ctx, "operator");
    if (session instanceof Response) return session;
    const operator = await requireOperator(ctx, session, ["staff"], isReady ? "orders.ready" : "orders.view");
    if (operator instanceof Response) return operator;
    if (isList) return teamOrders(ctx);
    const blocked = await requireMutation(ctx, session);
    return blocked ?? staffReady(ctx, operator, rest[1]);
  }

  if (area === "admin") {
    const isStock = rest[0] === "variants" && rest[2] === "stock" && method === "POST";
    if (isStock) {
      const session = await requireSession(ctx, "operator");
      if (session instanceof Response) return session;
      const operator = await requireOperator(ctx, session, ["admin"]);
      if (operator instanceof Response) return operator;
      const blocked = await requireMutation(ctx, session);
      return blocked ?? adminStock(ctx, operator, rest[1]);
    }
    return adminRoute(ctx, rest, method);
  }

  const session = await loadSession(ctx);
  if (ctx.url.pathname === "/api/demo/session" && method === "GET") {
    if (!session) return json({ session: null, role: "buyer" });
    const operator = await loadOperator(ctx, session);
    return json({ session: { expiresAt: session.expires_at }, role: operator?.role ?? "buyer" });
  }
  const operatorSession = await loadSession(ctx, "operator");
  if (ctx.url.pathname === "/api/demo/session" && method === "GET" && operatorSession) {
    const operator = await loadOperator(ctx, operatorSession);
    return json({ session: { expiresAt: operatorSession.expires_at }, role: operator?.role ?? null, portal: "operator" });
  }

  return fail("not_found");
}

async function teamRoute(ctx: Ctx, rest: string[], method: string): Promise<Response> {
  const known =
    (rest[0] === "summary" && method === "GET") ||
    (rest[0] === "orders" && !rest[1] && method === "GET") ||
    (rest[0] === "orders" && rest[1] && rest.length === 2 && method === "GET") ||
    (rest[0] === "orders" && rest[1] && rest[2] === "ready" && method === "POST") ||
    (rest[0] === "orders" && rest[1] && rest[2] === "complete" && method === "POST");
  if (!known) return fail("not_found");

  const permission = rest[2] === "ready" ? "orders.ready" : "orders.complete";
  const session = await requireSession(ctx, "operator");
  if (session instanceof Response) return session;
  const operator = await requireOperator(
    ctx,
    session,
    rest[0] === "orders" && rest[2] ? ["staff"] : ["staff", "admin"],
    rest[0] === "orders" && rest[2] ? permission : "orders.view",
  );
  if (operator instanceof Response) return operator;

  if (rest[0] === "summary" && method === "GET") return teamSummary(ctx);
  if (rest[0] === "orders" && !rest[1] && method === "GET") return teamOrders(ctx);
  if (rest[0] === "orders" && rest[1] && method === "GET") return teamOrderDetail(ctx, rest[1]);

  const blocked = await requireMutation(ctx, session);
  if (blocked) return blocked;
  if (rest[2] === "ready") return staffReady(ctx, operator, rest[1]);
  return teamComplete(ctx, operator, rest[1]);
}

async function adminRoute(ctx: Ctx, rest: string[], method: string): Promise<Response> {
  const known =
    (rest[0] === "summary" && method === "GET") ||
    (rest[0] === "kpi" && method === "GET") ||
    (rest[0] === "export" && rest[1] === "sales.csv" && method === "GET") ||
    (rest[0] === "audit" && method === "GET") ||
    (rest[0] === "catalog" && !rest[1] && method === "GET") ||
    (rest[0] === "products" && !rest[1] && method === "POST") ||
    (rest[0] === "products" && rest[1] && !rest[2] && method === "PATCH") ||
    (rest[0] === "products" && rest[1] && rest[2] === "variants" && method === "POST") ||
    (rest[0] === "products" && rest[1] && rest[2] === "photos" && !rest[3] && method === "GET") ||
    (rest[0] === "products" && rest[1] && rest[2] === "photos" && !rest[3] && method === "POST") ||
    (rest[0] === "products" && rest[1] && rest[2] === "photos" && rest[3] === "order" && method === "PUT") ||
    (rest[0] === "products" && rest[1] && rest[2] === "photos" && rest[3] && method === "DELETE") ||
    (rest[0] === "variants" && rest[1] && !rest[2] && method === "PATCH") ||
    (rest[0] === "packages" && rest[1] && rest[2] === "configs" && rest[3] && method === "PUT") ||
    (rest[0] === "faculties" && rest[1] && rest[2] === "aliases" && method === "PUT") ||
    (rest[0] === "settings" && method === "PATCH") ||
    (rest[0] === "operators" && !rest[1] && method === "GET") ||
    (rest[0] === "operators" && !rest[1] && method === "POST") ||
    (rest[0] === "operators" && rest[1] && !rest[2] && method === "PATCH") ||
    (rest[0] === "operators" && rest[1] && rest[2] === "revoke" && method === "POST") ||
    (rest[0] === "operators" && rest[1] && rest[2] === "enable" && method === "POST");
  if (!known) return fail("not_found");

  const session = await requireSession(ctx, "operator");
  if (session instanceof Response) return session;
  const operator = await requireOperator(ctx, session, ["admin"]);
  if (operator instanceof Response) return operator;

  if (rest[0] === "summary" && method === "GET") return adminSummary(ctx);
  if (rest[0] === "kpi" && method === "GET") return adminKpi(ctx);
  if (rest[0] === "export" && rest[1] === "sales.csv") return adminExportSales(ctx, operator);
  if (rest[0] === "operators" && !rest[1] && method === "POST") {
    const blocked = await requireMutation(ctx, session);
    return blocked ?? adminCreateStaff(ctx, operator);
  }
  if (rest[0] === "operators" && rest[1] && !rest[2] && method === "PATCH") {
    const blocked = await requireMutation(ctx, session);
    return blocked ?? adminUpdateStaff(ctx, operator, rest[1]);
  }
  if (rest[0] === "audit" && method === "GET") return adminAudit(ctx);
  if (rest[0] === "catalog" && method === "GET") return adminCatalog(ctx);
  if (rest[0] === "products" && !rest[1] && method === "POST") {
    const blocked = await requireMutation(ctx, session);
    return blocked ?? adminCreateProduct(ctx, operator);
  }
  if (rest[0] === "products" && rest[1] && method === "PATCH") {
    const blocked = await requireMutation(ctx, session);
    return blocked ?? adminUpdateProduct(ctx, operator, rest[1]);
  }
  if (rest[0] === "products" && rest[1] && rest[2] === "photos" && !rest[3] && method === "GET") {
    return adminPhotos(ctx, rest[1]);
  }
  if (rest[0] === "products" && rest[1] && rest[2] === "photos" && !rest[3] && method === "POST") {
    const blocked = await requireMutation(ctx, session);
    return blocked ?? adminUploadPhoto(ctx, operator, rest[1]);
  }
  if (rest[0] === "products" && rest[1] && rest[2] === "photos" && rest[3] === "order" && method === "PUT") {
    const blocked = await requireMutation(ctx, session);
    return blocked ?? adminReorderPhotos(ctx, operator, rest[1]);
  }
  if (rest[0] === "products" && rest[1] && rest[2] === "photos" && rest[3] && method === "DELETE") {
    const blocked = await requireMutation(ctx, session);
    return blocked ?? adminDeletePhoto(ctx, operator, rest[1], rest[3]);
  }
  if (rest[0] === "products" && rest[1] && rest[2] === "variants" && method === "POST") {
    const blocked = await requireMutation(ctx, session);
    return blocked ?? adminCreateVariant(ctx, operator, rest[1]);
  }
  if (rest[0] === "variants" && rest[1] && !rest[2] && method === "PATCH") {
    const blocked = await requireMutation(ctx, session);
    return blocked ?? adminUpdateVariant(ctx, operator, rest[1]);
  }
  if (rest[0] === "packages" && rest[1] && rest[2] === "configs" && rest[3] && method === "PUT") {
    const blocked = await requireMutation(ctx, session);
    return blocked ?? adminSavePackageConfig(ctx, operator, rest[1], rest[3]);
  }
  if (rest[0] === "faculties" && rest[1] && rest[2] === "aliases" && method === "PUT") {
    const blocked = await requireMutation(ctx, session);
    return blocked ?? adminAliases(ctx, operator, rest[1]);
  }
  if (rest[0] === "operators" && !rest[1] && method === "GET") return adminOperators(ctx);
  if (rest[0] === "operators" && rest[1] && rest[2] === "revoke" && method === "POST") {
    const blocked = await requireMutation(ctx, session);
    return blocked ?? adminRevokeOperator(ctx, operator, rest[1]);
  }
  if (rest[0] === "operators" && rest[1] && rest[2] === "enable" && method === "POST") {
    const blocked = await requireMutation(ctx, session);
    return blocked ?? adminEnableStaff(ctx, operator, rest[1]);
  }
  const blocked = await requireMutation(ctx, session);
  return blocked ?? adminSettings(ctx, operator);
}
