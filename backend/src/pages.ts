import { type Ctx, loadOperator, loadSession } from "./http";

const LOGIN = "/operator/login";

/** Path ternormalisasi agar variasi slash, persen-encoding, dan dot-segment tetap melewati guard. */
export function canonicalPath(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname.replace(/\\/g, "/"));
  } catch {
    return null;
  }
  const parts: string[] = [];
  for (const part of decoded.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return `/${parts.join("/")}`;
}

function privateArea(path: string): "team" | "staff" | "admin" | null {
  const lower = path.toLowerCase();
  if (lower === "/team" || lower.startsWith("/team/")) return "team";
  if (lower === "/staff" || lower.startsWith("/staff/")) return "staff";
  if (lower === "/admin" || lower.startsWith("/admin/")) return "admin";
  return null;
}

function html(status: number, message: string): Response {
  return new Response(
    `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Akses terbatas</title></head><body><main><h1>Akses terbatas</h1><p>${message}</p><p><a href="${LOGIN}">Masuk sebagai operator</a></p></main></body></html>`,
    {
      status,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
    },
  );
}

function redirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location, "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
  });
}

async function servePrivate(ctx: Ctx): Promise<Response> {
  const response = await ctx.env.ASSETS.fetch(ctx.request);
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-robots-tag", "noindex, nofollow");
  const body = ctx.request.method === "HEAD" ? null : response.body;
  return new Response(body, { status: response.status, headers });
}

/** Dijalankan sebelum Static Assets untuk halaman workspace. Null berarti halaman publik. */
export async function guardPage(ctx: Ctx): Promise<Response | null> {
  const path = canonicalPath(ctx.url.pathname);
  if (!path) return html(400, "Alamat tidak valid.");
  const area = privateArea(path);
  if (!area) return null;

  const session = await loadSession(ctx, "operator");
  if (!session) {
    // Sesi pembeli yang sah tetap ditolak di sini, bukan diarahkan ke login operator.
    if (await loadSession(ctx, "buyer")) return html(403, "Halaman ini hanya untuk akun operator.");
    const next = area === "staff" ? "/team/orders" : path;
    return redirect(`${LOGIN}?next=${encodeURIComponent(next)}`);
  }

  const operator = await loadOperator(ctx, session);
  if (!operator) return html(403, "Halaman ini hanya untuk tim MabaKit yang sudah diverifikasi.");
  if (area === "admin" && operator.role !== "admin") return html(403, "Halaman ini hanya untuk admin.");

  if (area === "staff") {
    const lower = path.toLowerCase();
    if (lower === "/staff" || lower === "/staff/orders" || lower === "/staff/pickup") return redirect("/team/orders");
    return html(404, "Halaman tidak ditemukan.");
  }

  return servePrivate(ctx);
}
