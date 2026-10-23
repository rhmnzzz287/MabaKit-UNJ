import { type Ctx, type Portal, type SessionRow, fail, ipHash, json, readJsonLimited, sha256 } from "./http";
import { allowAttempt, rotateSession, sessionResponse } from "./session";

const ITERATIONS = 100_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Login juga menerima akun seed presentasi `mabakita@admin` yang bukan email berdomain.
const LOGIN_EMAIL_RE = /^[^\s@]+@[^\s@]+$/;

export type UserRow = {
  id: string;
  email: string;
  role: "buyer" | "staff" | "admin";
  name: string;
  whatsapp: string;
  faculty_id: string | null;
  permissions?: string;
};

export const PORTAL_ROLES: Record<Portal, ("buyer" | "staff" | "admin")[]> = {
  buyer: ["buyer"],
  operator: ["staff", "admin"],
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  return toHex(new Uint8Array(bits));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${await derive(password, salt, ITERATIONS)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, saltHex, expected] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterations || !saltHex || !expected) return false;
  const actual = await derive(password, fromHex(saltHex), Number(iterations));
  let mismatch = actual.length ^ expected.length;
  for (let index = 0; index < Math.min(actual.length, expected.length); index += 1) {
    mismatch |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

function validEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

function loginEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && LOGIN_EMAIL_RE.test(email) ? email : null;
}

function validPassword(value: unknown, email: string): string | null {
  const password = typeof value === "string" ? value : "";
  if (password.length < 8 || password.length > 128) return null;
  return password.toLowerCase().includes(email) ? null : password;
}

export async function loadUser(ctx: Ctx, session: SessionRow): Promise<UserRow | null> {
  if (!session.user_id) return null;
  const user = await ctx.env.DB.prepare(
    "SELECT id, email, role, name, whatsapp, faculty_id, permissions FROM users WHERE id = ? AND disabled = 0",
  )
    .bind(session.user_id)
    .first<UserRow>();
  if (!user) return null;
  return PORTAL_ROLES[session.portal].includes(user.role) ? user : null;
}

function permissionsOf(raw: string | undefined): string[] {
  try {
    const parsed = JSON.parse(raw ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function publicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    whatsapp: user.whatsapp,
    facultyId: user.faculty_id,
    permissions: user.role === "buyer" ? [] : permissionsOf(user.permissions),
  };
}

export async function authSession(ctx: Ctx, session: SessionRow): Promise<Response> {
  const user = await loadUser(ctx, session);
  return json({
    session: { expiresAt: session.expires_at },
    user: user ? publicUser(user) : null,
    role: session.portal === "operator" ? (user?.role ?? null) : (user?.role ?? "buyer"),
    portal: session.portal,
  });
}

export async function register(ctx: Ctx, session: SessionRow): Promise<Response> {
  if (session.portal !== "buyer") return fail("forbidden");
  const body = await readJsonLimited(ctx.request);
  if (!body || Object.keys(body).some((key) => !["name", "email", "password"].includes(key))) return fail("invalid_payload");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 80) return fail("invalid_name", { field: "name" });
  const email = validEmail(body.email);
  if (!email) return fail("invalid_email", { field: "email" });
  const password = validPassword(body.password, email);
  if (!password) return fail("invalid_password", { field: "password" });

  const sourceAllowed = await allowAttempt(ctx, "auth_source", await ipHash(ctx));
  if (!sourceAllowed) return fail("rate_limited");

  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();
  try {
    await ctx.env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, role, name, whatsapp, faculty_id, created_at, updated_at)
       VALUES (?, ?, ?, 'buyer', ?, '', NULL, ?, ?)`,
    ).bind(id, email, passwordHash, name, ctx.now, ctx.now).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("UNIQUE")) return fail("email_unavailable", { field: "email" });
    if (message.includes("seed_role_conflict")) return fail("email_unavailable", { field: "email" });
    throw error;
  }
  const rotated = await rotateSession(ctx, session, id);
  return sessionResponse(
    ctx,
    { user: { id, email, role: "buyer", name, whatsapp: "", facultyId: null } },
    201,
    rotated.portal,
    rotated.token,
    rotated.csrf,
  );
}

export async function login(ctx: Ctx, session: SessionRow): Promise<Response> {
  const body = await readJsonLimited(ctx.request);
  if (!body || Object.keys(body).some((key) => !["email", "password"].includes(key))) return fail("invalid_payload");
  const email = loginEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || password.length === 0) return fail("invalid_credentials");

  const sourceAllowed = await allowAttempt(ctx, "login_source", await ipHash(ctx));
  const emailAllowed = await allowAttempt(ctx, "login_email", await sha256(email));
  if (!sourceAllowed || !emailAllowed) return fail("rate_limited");

  const user = await ctx.env.DB.prepare(
    "SELECT id, email, role, name, whatsapp, faculty_id, permissions, password_hash FROM users WHERE email = ? AND disabled = 0",
  )
    .bind(email)
    .first<UserRow & { password_hash: string }>();
  if (!user || !(await verifyPassword(password, user.password_hash))) return fail("invalid_credentials");
  // Portal ditentukan server: kredensial operator tidak diterima di halaman pembeli dan sebaliknya.
  if (!PORTAL_ROLES[session.portal].includes(user.role)) return fail("wrong_portal");

  const rotated = await rotateSession(ctx, session, user.id);
  return sessionResponse(ctx, { user: publicUser(user) }, 200, rotated.portal, rotated.token, rotated.csrf);
}

export async function logout(ctx: Ctx, session: SessionRow): Promise<Response> {
  await ctx.env.DB.prepare("UPDATE demo_sessions SET user_id = NULL, expires_at = ? WHERE id = ?")
    .bind(ctx.now, session.id)
    .run();
  const rotated = await rotateSession(ctx, session, null);
  return sessionResponse(ctx, { user: null }, 200, rotated.portal, rotated.token, rotated.csrf);
}

