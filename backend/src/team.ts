import { type Ctx, type OperatorRow, errorName, fail, json, releaseExpired } from "./http";
import { type OrderRow, loadOrder, orderPayload } from "./orders";

const WIB_OFFSET = 7 * 60 * 60_000;
const PERIODS = ["today", "7d", "30d", "all"] as const;
export type Period = (typeof PERIODS)[number];

/** Awal rentang dalam epoch ms, memakai batas tengah malam WIB (UTC+7, tanpa DST). */
export function periodStart(period: Period, now: number): number | null {
  if (period === "all") return null;
  const wibNow = now + WIB_OFFSET;
  const wibMidnight = Math.floor(wibNow / 86_400_000) * 86_400_000;
  const days = period === "today" ? 0 : period === "7d" ? 6 : 29;
  return wibMidnight - days * 86_400_000 - WIB_OFFSET;
}

function parsePeriod(raw: string | null): Period {
  return raw && (PERIODS as readonly string[]).includes(raw) ? (raw as Period) : "today";
}

export async function teamSummary(ctx: Ctx): Promise<Response> {
  await releaseExpired(ctx);
  const period = parsePeriod(ctx.url.searchParams.get("period"));
  const start = periodStart(period, ctx.now);
  // Antrean (counts) memakai tanggal order dibuat; nilai penjualan memakai tanggal pembayaran.
  const range = start === null ? "" : " AND created_at >= ?";
  const paidRange = start === null ? "" : " AND paid_at >= ?";
  const binds = start === null ? [] : [start];

  const counts = await ctx.env.DB.prepare(
    `SELECT
       SUM(CASE WHEN payment_status = 'PENDING' THEN 1 ELSE 0 END) AS pending_count,
       SUM(CASE WHEN payment_status = 'PAID' AND fulfillment_status = 'UNFULFILLED' THEN 1 ELSE 0 END) AS preparing_count,
       SUM(CASE WHEN fulfillment_status = 'READY' THEN 1 ELSE 0 END) AS ready_count,
       SUM(CASE WHEN fulfillment_status = 'PICKED_UP' THEN 1 ELSE 0 END) AS completed_count
     FROM orders WHERE 1 = 1${range}`,
  )
    .bind(...binds)
    .first<Record<string, number | null>>();

  const paid = await ctx.env.DB.prepare(
    `SELECT COUNT(*) AS paid_orders, COALESCE(SUM(amount_due_rp), 0) AS paid_value FROM orders
     WHERE payment_status = 'PAID'${paidRange}`,
  )
    .bind(...binds)
    .first<{ paid_orders: number; paid_value: number }>();

  return json({
    period,
    rangeStart: start,
    sales: { paidValueRp: paid?.paid_value ?? 0, paidOrders: paid?.paid_orders ?? 0, simulated: true },
    counts: {
      pending: counts?.pending_count ?? 0,
      preparing: counts?.preparing_count ?? 0,
      ready: counts?.ready_count ?? 0,
      completed: counts?.completed_count ?? 0,
    },
  });
}

type Cursor = { createdAt: number; id: string };

function encodeCursor(order: OrderRow): string {
  return btoa(JSON.stringify({ t: order.created_at, i: order.id }));
}

function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(atob(raw)) as { t?: unknown; i?: unknown };
    if (typeof parsed.t !== "number" || typeof parsed.i !== "string") return null;
    return { createdAt: parsed.t, id: parsed.i };
  } catch {
    return null;
  }
}

const PAYMENT_FILTERS = ["PENDING", "PAID", "EXPIRED"] as const;
const FULFILLMENT_FILTERS = ["UNFULFILLED", "READY", "PICKED_UP", "CANCELLED"] as const;

const ORDER_COLUMNS = `id, order_number, session_id, user_id, faculty_id, buyer_name, recipient_name, contact_phone, email,
  department_id,
  pickup_instructions_snapshot, total_rp, amount_due_rp, payment_status, fulfillment_status, created_at,
  expires_at, paid_at, ready_at, picked_up_at`;

export async function teamOrders(ctx: Ctx): Promise<Response> {
  await releaseExpired(ctx);
  const params = ctx.url.searchParams;
  const payment = params.get("payment");
  const fulfillment = params.get("fulfillment");
  if (payment && !(PAYMENT_FILTERS as readonly string[]).includes(payment)) return fail("invalid_payload");
  if (fulfillment && !(FULFILLMENT_FILTERS as readonly string[]).includes(fulfillment)) {
    return fail("invalid_payload");
  }
  const limitRaw = Number(params.get("limit") ?? 20);
  const limit = Number.isInteger(limitRaw) ? Math.min(50, Math.max(1, limitRaw)) : 20;
  const cursor = decodeCursor(params.get("cursor"));
  if (params.get("cursor") && !cursor) return fail("invalid_payload");

  const where: string[] = [];
  const binds: unknown[] = [];
  if (payment) {
    where.push("payment_status = ?");
    binds.push(payment);
  }
  if (fulfillment) {
    where.push("fulfillment_status = ?");
    binds.push(fulfillment);
  }
  if (cursor) {
    where.push("(created_at < ? OR (created_at = ? AND id < ?))");
    binds.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { results } = await ctx.env.DB.prepare(
    `SELECT ${ORDER_COLUMNS} FROM orders ${clause} ORDER BY created_at DESC, id DESC LIMIT ?`,
  )
    .bind(...binds, limit + 1)
    .all<OrderRow>();

  const page = results.slice(0, limit);
  const orders = [];
  for (const order of page) orders.push(await orderPayload(ctx, order));
  const last = page[page.length - 1];
  return json({ orders, nextCursor: results.length > limit && last ? encodeCursor(last) : null });
}

export async function teamOrderDetail(ctx: Ctx, id: string): Promise<Response> {
  const order = await loadOrder(ctx, id);
  if (!order) return fail("not_found");
  return json({ order: await orderPayload(ctx, order) });
}

/** Konfirmasi serah terima manual: PAID + READY -> PICKED_UP, idempoten, audit atomik. */
export async function teamComplete(ctx: Ctx, operator: OperatorRow, id: string): Promise<Response> {
  const order = await loadOrder(ctx, id);
  if (!order) return fail("not_found");
  if (order.fulfillment_status === "PICKED_UP") return json({ order: await orderPayload(ctx, order), replayed: true });

  let changed = 0;
  try {
    const results = await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        `UPDATE orders SET fulfillment_status = 'PICKED_UP', picked_up_at = ?
         WHERE id = ? AND payment_status = 'PAID' AND fulfillment_status = 'READY'`,
      ).bind(ctx.now, id),
      ctx.env.DB.prepare(
        `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, safe_metadata, request_id, created_at)
         SELECT ?, ?, 'pickup_claimed', 'order', ?, '{"source":"team"}', ?, ?
         WHERE changes() = 1`,
      ).bind(crypto.randomUUID(), operator.id, id, ctx.requestId, ctx.now),
    ]);
    changed = Number(results[0]?.meta?.changes ?? 0);
  } catch (error) {
    const name = errorName(error);
    if (name === "pickup_not_allowed" || name === "not_ready_transition") return fail(name);
    throw error;
  }

  const updated = await loadOrder(ctx, id);
  if (!updated || updated.fulfillment_status !== "PICKED_UP") return fail("pickup_not_allowed");
  return json({ order: await orderPayload(ctx, updated), replayed: changed === 0 });
}
