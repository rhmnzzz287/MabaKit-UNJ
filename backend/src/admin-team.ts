import { type Ctx, type OperatorRow, PERMISSIONS, audit, fail, json, readJsonLimited } from "./http";
import { hashPassword } from "./auth";
import { allowAttempt } from "./session";
import { sha256 } from "./http";

type StaffRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string;
  disabled: number;
  last_login: number | null;
  active_sessions: number | null;
};

function staffPayload(row: StaffRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    permissions: safePermissions(row.permissions),
    disabled: row.disabled === 1,
    lastLoginAt: row.last_login,
    activeSessions: row.active_sessions ?? 0,
  };
}

function safePermissions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function validPermissionList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const allowed = new Set<string>(PERMISSIONS);
  const list = value.filter((item): item is string => typeof item === "string");
  if (list.length !== value.length || list.some((item) => !allowed.has(item))) return null;
  if (new Set(list).size !== list.length) return null;
  const set = new Set(list);
  if ((set.has("orders.ready") || set.has("orders.complete")) && !set.has("orders.view")) return null;
  return list;
}

const NAME_RE = /^[A-Za-z0-9 .,'-]{1,80}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Ringkasan KPI: seluruh rentang, batas WIB, dan atribusi per operator dari audit. */
export async function adminKpi(ctx: Ctx): Promise<Response> {
  const period = ctx.url.searchParams.get("period") ?? "today";
  const start = periodStart(period, ctx.now);
  const range = start === null ? "" : " AND a.created_at >= ?";
  const args = start === null ? [] : [start];

  const { results: transitionRows } = await ctx.env.DB.prepare(
    `SELECT a.action, a.actor_id, COUNT(*) AS total, MAX(a.created_at) AS last_at
     FROM audit_logs a WHERE a.action IN ('order_ready', 'pickup_claimed')${range}
     GROUP BY a.action, a.actor_id`,
  )
    .bind(...args)
    .all<{ action: string; actor_id: string | null; total: number; last_at: number }>();

  const { results: staffRows } = await ctx.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.role, u.disabled
     FROM users u WHERE u.role IN ('staff', 'admin') ORDER BY u.name`,
  ).all<{ id: string; name: string; email: string; role: string; disabled: number }>();

  const attributed = new Map<string, { ready: number; complete: number; lastAt: number | null }>();
  for (const row of transitionRows) {
    if (!row.actor_id) continue;
    const entry = attributed.get(row.actor_id) ?? { ready: 0, complete: 0, lastAt: null };
    if (row.action === "order_ready") entry.ready += row.total;
    else entry.complete += row.total;
    if (!entry.lastAt || row.last_at > entry.lastAt) entry.lastAt = row.last_at;
    attributed.set(row.actor_id, entry);
  }

  const staff = staffRows.map((row) => {
    const entry = attributed.get(row.id);
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      disabled: row.disabled === 1,
      readyCount: entry?.ready ?? 0,
      completeCount: entry?.complete ?? 0,
      lastTransitionAt: entry?.lastAt ?? null,
    };
  });

  const unattributedRows = transitionRows.filter((row) => !row.actor_id);
  const unattributed = {
    readyCount: unattributedRows.filter((row) => row.action === "order_ready").reduce((sum, row) => sum + row.total, 0),
    completeCount: unattributedRows
      .filter((row) => row.action === "pickup_claimed")
      .reduce((sum, row) => sum + row.total, 0),
  };

  const paidRange = start === null ? "" : " AND paid_at >= ?";
  const paid = await ctx.env.DB.prepare(
    `SELECT COUNT(*) AS paid_orders, COALESCE(SUM(amount_due_rp), 0) AS paid_value FROM orders
     WHERE payment_status = 'PAID'${paidRange}`,
  )
    .bind(...(start === null ? [] : [start]))
    .first<{ paid_orders: number; paid_value: number }>();

  return json({
    period,
    rangeStart: start,
    sales: { paidValueRp: paid?.paid_value ?? 0, paidOrders: paid?.paid_orders ?? 0, simulated: true },
    staff,
    unattributed,
  });
}

function periodStart(period: string, now: number): number | null {
  if (period === "all") return null;
  const offset = 7 * 60 * 60_000;
  const wibMidnight = Math.floor((now + offset) / 86_400_000) * 86_400_000;
  const days = period === "today" ? 0 : period === "7d" ? 6 : 29;
  return wibMidnight - days * 86_400_000 - offset;
}

export async function adminCreateStaff(ctx: Ctx, operator: OperatorRow): Promise<Response> {
  const body = await readJsonLimited(ctx.request);
  if (!body) return fail("invalid_payload");
  const allowed = new Set(["name", "email", "password", "permissions"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) return fail("invalid_payload");

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!NAME_RE.test(name)) return fail("invalid_name", { field: "name" });
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL_RE.test(email)) return fail("invalid_email", { field: "email" });
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8 || password.length > 128 || password.toLowerCase().includes(email)) {
    return fail("invalid_password", { field: "password" });
  }
  const permissions = body.permissions === undefined ? null : validPermissionList(body.permissions);
  if (body.permissions !== undefined && !permissions) return fail("invalid_payload", { field: "permissions" });

  if (!(await allowAttempt(ctx, "staff_create", await sha256(operator.id), 20))) return fail("rate_limited");

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  try {
    await ctx.env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, role, name, whatsapp, faculty_id, permissions, disabled, created_at, updated_at)
       VALUES (?, ?, ?, 'staff', ?, '', NULL, ?, 0, ?, ?)`,
    )
      .bind(
        id,
        email,
        passwordHash,
        name,
        JSON.stringify(permissions ?? ["orders.view", "orders.ready", "orders.complete"]),
        ctx.now,
        ctx.now,
      )
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("UNIQUE")) return fail("email_unavailable", { field: "email" });
    if (message.includes("seed_role_conflict")) return fail("email_unavailable", { field: "email" });
    throw error;
  }

  await audit(ctx, {
    actorId: operator.id,
    action: "staff_created",
    entityType: "user",
    entityId: id,
    metadata: { role: "staff", permissions: permissions ?? ["orders.view", "orders.ready", "orders.complete"] },
  });
  return json({ staff: { id, email, name, role: "staff", permissions: permissions ?? ["orders.view", "orders.ready", "orders.complete"], disabled: false } }, 201);
}

export async function adminUpdateStaff(ctx: Ctx, operator: OperatorRow, id: string): Promise<Response> {
  const body = await readJsonLimited(ctx.request);
  if (!body) return fail("invalid_payload");
  const allowed = new Set(["name", "permissions", "disabled", "password"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) return fail("invalid_payload");

  const target = await ctx.env.DB.prepare(
    "SELECT id, email, name, role, permissions, disabled FROM users WHERE id = ? AND role IN ('staff', 'admin')",
  )
    .bind(id)
    .first<{ id: string; email: string; name: string; role: string; permissions: string; disabled: number }>();
  if (!target) return fail("not_found");
  if (target.role === "admin") return fail("forbidden");

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (name !== undefined && !NAME_RE.test(name)) return fail("invalid_name", { field: "name" });
  const permissions = body.permissions === undefined ? undefined : validPermissionList(body.permissions);
  if (permissions === null) return fail("invalid_payload", { field: "permissions" });
  const disabled = typeof body.disabled === "boolean" ? body.disabled : undefined;
  const password = typeof body.password === "string" ? body.password : undefined;
  if (password !== undefined) {
    if (password.length < 8 || password.length > 128 || password.toLowerCase().includes(target.email)) {
      return fail("invalid_password", { field: "password" });
    }
  }

  await ctx.env.DB.prepare(
    `UPDATE users SET name = COALESCE(?, name), permissions = COALESCE(?, permissions),
       disabled = COALESCE(?, disabled), password_hash = COALESCE(?, password_hash), updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      name ?? null,
      permissions === undefined ? null : JSON.stringify(permissions),
      disabled === undefined ? null : disabled ? 1 : 0,
      password === undefined ? null : await hashPassword(password),
      ctx.now,
      id,
    )
    .run();

  // Mengubah izin, menonaktifkan, atau mengganti sandi mencabut seluruh sesi operator akun itu.
  if (permissions !== undefined || disabled === true || password !== undefined) {
    await ctx.env.DB.prepare("UPDATE demo_sessions SET expires_at = ? WHERE user_id = ? AND portal = 'operator'")
      .bind(ctx.now, id)
      .run();
  }

  await audit(ctx, {
    actorId: operator.id,
    action: "staff_updated",
    entityType: "user",
    entityId: id,
    metadata: {
      name: name !== undefined,
      permissions: permissions ?? null,
      disabled: disabled ?? null,
      passwordChanged: password !== undefined,
    },
  });

  const updated = await ctx.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.permissions, u.disabled,
            MAX(s.created_at) AS last_login,
            SUM(CASE WHEN s.expires_at > ? THEN 1 ELSE 0 END) AS active_sessions
     FROM users u LEFT JOIN demo_sessions s ON s.user_id = u.id
     WHERE u.id = ? GROUP BY u.id`,
  )
    .bind(ctx.now, id)
    .first<StaffRow>();
  return json({ staff: updated ? staffPayload(updated) : null });
}

export async function adminEnableStaff(ctx: Ctx, operator: OperatorRow, id: string): Promise<Response> {
  const target = await ctx.env.DB.prepare(
    "SELECT id, role FROM users WHERE id = ? AND role IN ('staff', 'admin')",
  )
    .bind(id)
    .first<{ id: string; role: string }>();
  if (!target) return fail("not_found");
  if (target.role === "admin") return fail("forbidden");
  const enabled = await ctx.env.DB.prepare("UPDATE users SET disabled = 0, updated_at = ? WHERE id = ? AND disabled = 1")
    .bind(ctx.now, id)
    .run();
  if (!enabled.meta.changes) return json({ enabled: true, disabled: false });
  await audit(ctx, {
    actorId: operator.id,
    action: "staff_enabled",
    entityType: "user",
    entityId: id,
    metadata: { disabled: false },
  });
  return json({ enabled: true, disabled: false });
}
