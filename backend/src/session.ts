import {
  type Ctx,
  type Portal,
  type SessionRow,
  SESSION_COOKIES,
  errorName,
  fail,
  ipHash,
  randomToken,
  readJsonLimited,
  setCookie,
  sha256,
} from "./http";

const SESSION_DAYS = 1;

/** Cookie portal terpisah: sesi pembeli tidak pernah dipakai endpoint operator. */
export function sessionResponse(
  ctx: Ctx,
  body: unknown,
  status: number,
  portal: Portal,
  token: string,
  csrf: string,
): Response {
  const secure = ctx.url.protocol === "https:";
  const names = SESSION_COOKIES[portal];
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  headers.append("set-cookie", setCookie(names.token, token, { httpOnly: true, secure, maxAge: SESSION_DAYS * 86_400 }));
  headers.append("set-cookie", setCookie(names.csrf, csrf, { secure, maxAge: SESSION_DAYS * 86_400 }));
  return new Response(JSON.stringify(body), { status, headers });
}

function parsePortal(value: unknown): Portal {
  return value === "operator" ? "operator" : "buyer";
}

export async function createSession(ctx: Ctx): Promise<Response> {
  const body = await readJsonLimited(ctx.request, 1024).catch(() => null);
  const portal = parsePortal(body?.portal);
  const token = randomToken(32);
  const csrf = randomToken(24);
  const id = crypto.randomUUID();
  const clientKey = await ipHash(ctx);
  try {
    await ctx.env.DB.prepare(
      `INSERT INTO demo_sessions (id, user_id, portal, token_hash, csrf_hash, client_key_hash, created_at, expires_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, portal, await sha256(token), await sha256(csrf), clientKey, ctx.now, ctx.now + SESSION_DAYS * 86_400_000)
      .run();
  } catch (error) {
    const code = errorName(error);
    return fail(code === "rate_limited" ? "rate_limited" : "internal");
  }

  return sessionResponse(ctx, { csrfToken: csrf, portal }, 201, portal, token, csrf);
}

export async function allowAttempt(ctx: Ctx, scope: string, key: string, limit = 10): Promise<boolean> {
  const windowStart = Math.floor(ctx.now / 300_000) * 300_000;
  const row = await ctx.env.DB.prepare(
    `INSERT INTO rate_limits (scope, actor_key_hash, window_start, count) VALUES (?, ?, ?, 1)
     ON CONFLICT (scope, actor_key_hash, window_start) DO UPDATE SET count = count + 1
     RETURNING count`,
  )
    .bind(scope, key, windowStart)
    .first<{ count: number }>();
  return (row?.count ?? 0) <= limit;
}

/** Rotasi token + CSRF pada sesi yang sama, lalu pasang pemilik akun. */
export async function rotateSession(
  ctx: Ctx,
  session: SessionRow,
  userId: string | null,
): Promise<{ token: string; csrf: string; portal: Portal }> {
  const token = randomToken(32);
  const csrf = randomToken(24);
  await ctx.env.DB.prepare("UPDATE demo_sessions SET token_hash = ?, csrf_hash = ?, user_id = ? WHERE id = ?")
    .bind(await sha256(token), await sha256(csrf), userId, session.id)
    .run();
  return { token, csrf, portal: session.portal };
}
