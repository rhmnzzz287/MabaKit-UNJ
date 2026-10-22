export type Env = {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  DB: D1Database;
  APP_MODE: string;
  DEMO_SECRET: string;
  STAFF_DEMO_CODE?: string;
  ADMIN_DEMO_CODE?: string;
};

export type Ctx = {
  request: Request;
  env: Env;
  url: URL;
  now: number;
  requestId: string;
};

export type SessionRow = {
  id: string;
  csrf_hash: string;
  client_key_hash: string;
  expires_at: number;
};

export type OperatorRow = { id: string; role: "staff" | "admin" };

export type Failure = { error: string; message: string };

const STATUS: Record<string, number> = {
  invalid_name: 400,
  invalid_phone: 400,
  empty_cart: 400,
  too_many_items: 400,
  invalid_quantity: 400,
  duplicate_item: 400,
  invalid_item: 400,
  invalid_key: 400,
  invalid_method: 400,
  invalid_payload: 400,
  session_required: 401,
  csrf_failed: 403,
  origin_rejected: 403,
  forbidden: 403,
  not_found: 404,
  stock_unavailable: 409,
  catalog_changed: 409,
  hold_limit: 409,
  conflict: 409,
  order_expired: 409,
  order_not_payable: 409,
  pickup_not_allowed: 409,
  not_ready_transition: 409,
  stock_below_reserved: 409,
  rate_limited: 429,
  checkout_disabled: 503,
  internal: 500,
};

const MESSAGE: Record<string, string> = {
  invalid_name: "Nama wajib diisi, maksimal 80 karakter.",
  invalid_phone: "Nomor WhatsApp tidak valid. Contoh: 081234567890.",
  empty_cart: "Keranjang masih kosong.",
  too_many_items: "Maksimal 20 jenis item per pesanan.",
  invalid_quantity: "Jumlah per item harus 1 sampai 99.",
  duplicate_item: "Item yang sama muncul lebih dari sekali.",
  invalid_item: "Item tidak dikenali.",
  invalid_key: "Kunci idempotensi tidak valid.",
  invalid_method: "Metode pembayaran tidak dikenali.",
  invalid_payload: "Permintaan tidak valid.",
  session_required: "Sesi demo berakhir. Muat ulang halaman.",
  csrf_failed: "Token keamanan tidak cocok. Muat ulang halaman.",
  origin_rejected: "Permintaan lintas situs ditolak.",
  forbidden: "Akses ditolak.",
  not_found: "Data tidak ditemukan.",
  stock_unavailable: "Stok salah satu item tidak cukup. Perbarui keranjang.",
  catalog_changed: "Harga atau ketersediaan berubah. Periksa ulang keranjang.",
  hold_limit: "Batas pesanan yang belum dibayar tercapai. Selesaikan atau tunggu 30 menit.",
  conflict: "Permintaan bertentangan dengan data terbaru.",
  order_expired: "Batas waktu pembayaran 30 menit sudah lewat.",
  order_not_payable: "Pesanan ini tidak bisa dibayar lagi.",
  pickup_not_allowed: "Klaim pickup tidak diizinkan untuk status ini.",
  not_ready_transition: "Pesanan harus sudah dibayar sebelum ditandai siap.",
  stock_below_reserved: "Stok fisik tidak boleh di bawah jumlah yang sudah direservasi.",
  rate_limited: "Terlalu banyak permintaan. Coba lagi sebentar.",
  checkout_disabled: "Checkout sedang ditutup.",
  internal: "Terjadi kesalahan di server.",
};

export function fail(error: string, extra?: Record<string, unknown>): Response {
  return json({ error, message: MESSAGE[error] ?? MESSAGE.internal, ...extra }, STATUS[error] ?? 500);
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function setCookie(name: string, value: string, options: { httpOnly?: boolean; secure?: boolean; maxAge: number }): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "SameSite=Lax", `Max-Age=${options.maxAge}`];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return base64url(buffer);
}

export function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

export function clientKeyHash(ctx: Ctx, ip: string): Promise<string> {
  return sha256(`${ctx.env.DEMO_SECRET}:client:${ip}`);
}

function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export function ipHash(ctx: Ctx): Promise<string> {
  return clientKeyHash(ctx, clientIp(ctx.request));
}

export async function loadSession(ctx: Ctx): Promise<SessionRow | null> {
  const token = getCookie(ctx.request, "mbk_sess");
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await ctx.env.DB.prepare(
    "SELECT id, csrf_hash, client_key_hash, expires_at FROM demo_sessions WHERE token_hash = ?",
  )
    .bind(tokenHash)
    .first<SessionRow>();
  if (!row || row.expires_at <= ctx.now) return null;
  return row;
}

export async function requireSession(ctx: Ctx): Promise<SessionRow | Response> {
  const session = await loadSession(ctx);
  return session ?? fail("session_required");
}

export async function requireMutation(ctx: Ctx, session: SessionRow): Promise<Response | null> {
  const origin = ctx.request.headers.get("origin");
  if (origin && origin !== ctx.url.origin) return fail("origin_rejected");
  const csrf = ctx.request.headers.get("x-csrf");
  if (!csrf) return fail("csrf_failed");
  const csrfHash = await sha256(csrf);
  if (!constantTimeEqual(csrfHash, session.csrf_hash)) return fail("csrf_failed");
  return null;
}

export async function loadOperator(ctx: Ctx, session: SessionRow): Promise<OperatorRow | null> {
  return ctx.env.DB.prepare("SELECT id, role FROM demo_operators WHERE session_id = ?")
    .bind(session.id)
    .first<OperatorRow>();
}

export async function requireOperator(
  ctx: Ctx,
  session: SessionRow,
  roles: ("staff" | "admin")[],
): Promise<OperatorRow | Response> {
  const operator = await loadOperator(ctx, session);
  if (!operator || !roles.includes(operator.role)) return fail("forbidden");
  return operator;
}

export function errorName(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  for (const code of [
    "stock_unavailable",
    "catalog_changed",
    "hold_limit",
    "rate_limited",
    "not_ready_transition",
    "pickup_not_allowed",
    "stock_below_reserved",
  ]) {
    if (message.includes(code)) return code;
  }
  if (message.includes("UNIQUE constraint failed")) return "conflict";
  return "internal";
}

export async function audit(
  ctx: Ctx,
  entry: { actorId?: string | null; action: string; entityType: string; entityId: string; metadata?: Record<string, unknown> },
): Promise<void> {
  await ctx.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, safe_metadata, request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      entry.actorId ?? null,
      entry.action,
      entry.entityType,
      entry.entityId,
      JSON.stringify(entry.metadata ?? {}),
      ctx.requestId,
      ctx.now,
    )
    .run();
}

/** Melepas reservasi draft yang lewat 30 menit. Trigger DB yang mengembalikan stok sekali. */
export async function releaseExpired(ctx: Ctx, sessionId?: string): Promise<void> {
  const sql = `UPDATE orders SET payment_status = 'EXPIRED', fulfillment_status = 'CANCELLED',
                 stock_allocation_status = 'RELEASED'
               WHERE payment_status = 'PENDING' AND stock_allocation_status = 'HELD' AND expires_at <= ?`;
  if (sessionId) {
    await ctx.env.DB.prepare(`${sql} AND session_id = ?`).bind(ctx.now, sessionId).run();
  } else {
    await ctx.env.DB.prepare(sql).bind(ctx.now).run();
  }
}
