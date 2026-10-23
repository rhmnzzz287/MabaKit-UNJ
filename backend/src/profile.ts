import { type Ctx, type SessionRow, fail, json, readJsonLimited } from "./http";
import { normalizePhone } from "./domain/phone";

type UserProfileRow = { name: string; whatsapp: string; email: string; faculty_id: string | null; updated_at: number };

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= 80 ? name : null;
}

function payload(row: UserProfileRow | null) {
  return row
    ? { name: row.name, whatsapp: row.whatsapp, email: row.email, facultyId: row.faculty_id, updatedAt: row.updated_at }
    : null;
}

export async function getProfile(ctx: Ctx, session: SessionRow): Promise<Response> {
  if (!session.user_id) return fail("session_required");
  const row = await ctx.env.DB.prepare(
    "SELECT name, whatsapp, email, faculty_id, updated_at FROM users WHERE id = ?",
  )
    .bind(session.user_id)
    .first<UserProfileRow>();
  return json({ profile: payload(row ?? null) });
}

export async function saveProfile(ctx: Ctx, session: SessionRow): Promise<Response> {
  if (!session.user_id) return fail("session_required");
  const body = await readJsonLimited(ctx.request);
  if (!body) return fail("invalid_payload");
  if (Object.keys(body).some((key) => !["name", "whatsapp", "facultyId"].includes(key))) {
    return fail("invalid_payload");
  }

  const name = cleanName(body.name);
  if (!name) return fail("invalid_name", { field: "name" });
  const whatsapp = typeof body.whatsapp === "string" ? normalizePhone(body.whatsapp) : null;
  if (!whatsapp) return fail("invalid_phone", { field: "whatsapp" });
  const facultyId = body.facultyId === null || body.facultyId === undefined ? null : String(body.facultyId);
  if (facultyId !== null) {
    const faculty = await ctx.env.DB.prepare("SELECT id FROM faculties WHERE id = ? AND active = 1")
      .bind(facultyId)
      .first<{ id: string }>();
    if (!faculty) return fail("invalid_payload", { field: "facultyId" });
  }

  await ctx.env.DB.prepare(
    "UPDATE users SET name = ?, whatsapp = ?, faculty_id = ?, updated_at = ? WHERE id = ?",
  )
    .bind(name, whatsapp, facultyId, ctx.now, session.user_id)
    .run();

  const row = await ctx.env.DB.prepare(
    "SELECT name, whatsapp, email, faculty_id, updated_at FROM users WHERE id = ?",
  )
    .bind(session.user_id)
    .first<UserProfileRow>();
  return json({ profile: payload(row ?? null) });
}
