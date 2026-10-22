import {
  type Ctx,
  type SessionRow,
  errorName,
  fail,
  ipHash,
  json,
  randomToken,
  readJson,
  setCookie,
  sha256,
} from "./http";

const SESSION_DAYS = 1;

export async function createSession(ctx: Ctx): Promise<Response> {
  const token = randomToken(32);
  const csrf = randomToken(24);
  const id = crypto.randomUUID();
  const clientKey = await ipHash(ctx);
  try {
    await ctx.env.DB.prepare(
      `INSERT INTO demo_sessions (id, token_hash, csrf_hash, client_key_hash, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, await sha256(token), await sha256(csrf), clientKey, ctx.now, ctx.now + SESSION_DAYS * 86_400_000)
      .run();
  } catch (error) {
    const code = errorName(error);
    return fail(code === "rate_limited" ? "rate_limited" : "internal");
  }

  const secure = ctx.url.protocol === "https:";
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  headers.append("set-cookie", setCookie("mbk_sess", token, { httpOnly: true, secure, maxAge: SESSION_DAYS * 86_400 }));
  headers.append("set-cookie", setCookie("mbk_csrf", csrf, { secure, maxAge: SESSION_DAYS * 86_400 }));
  return new Response(JSON.stringify({ csrfToken: csrf }), { status: 201, headers });
}

async function allowOperatorAttempt(ctx: Ctx, session: SessionRow): Promise<boolean> {
  const windowStart = Math.floor(ctx.now / 300_000) * 300_000;
  const row = await ctx.env.DB.prepare(
    `INSERT INTO rate_limits (scope, actor_key_hash, window_start, count) VALUES ('operator_code', ?, ?, 1)
     ON CONFLICT (scope, actor_key_hash, window_start) DO UPDATE SET count = count + 1
     RETURNING count`,
  )
    .bind(`${session.id}:${session.client_key_hash}`, windowStart)
    .first<{ count: number }>();
  return (row?.count ?? 0) <= 10;
}

const ROLE_CODES = { staff: "STAFF_DEMO_CODE", admin: "ADMIN_DEMO_CODE" } as const;

export async function registerOperator(ctx: Ctx, session: SessionRow): Promise<Response> {
  const body = await readJson(ctx.request);
  const role = body?.role === "staff" || body?.role === "admin" ? body.role : null;
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!role) return fail("invalid_payload");
  if (!(await allowOperatorAttempt(ctx, session))) return fail("rate_limited");
  const expected = ctx.env[ROLE_CODES[role]];
  if (!expected || code.length === 0) return fail("forbidden");
  const a = await sha256(code);
  const b = await sha256(expected);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  if (mismatch !== 0) return fail("forbidden");

  await ctx.env.DB.prepare(
    `INSERT INTO demo_operators (id, session_id, role, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (session_id) DO UPDATE SET role = excluded.role`,
  )
    .bind(crypto.randomUUID(), session.id, role, ctx.now)
    .run();
  return json({ operator: { role } }, 201);
}
