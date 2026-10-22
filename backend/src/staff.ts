import { type Ctx, type OperatorRow, type SessionRow, audit, errorName, fail, json, readJson, sha256 } from "./http";
import { type OrderRow, loadOrder, orderPayload } from "./orders";

async function staffOrder(ctx: Ctx, id: string, operator: OperatorRow, action: "ready" | "claim"): Promise<Response> {
  const order = await loadOrder(ctx, id);
  if (!order) return fail("not_found");
  if (order.payment_status !== "PAID") return fail("not_ready_transition");
  if (action === "claim" && order.fulfillment_status !== "READY") return fail("pickup_not_allowed");

  if (action === "ready") {
    const result = await ctx.env.DB.prepare(
      `UPDATE orders SET fulfillment_status = 'READY', ready_at = ?
       WHERE id = ? AND payment_status = 'PAID' AND stock_allocation_status = 'CONSUMED'
         AND fulfillment_status = 'UNFULFILLED'`,
    )
      .bind(ctx.now, id)
      .run();
    if (result.meta.changes === 0) return fail("not_ready_transition");
    await audit(ctx, { actorId: operator.id, action: "order_ready", entityType: "order", entityId: id });
    const updated = await loadOrder(ctx, id);
    return updated ? json({ order: await orderPayload(ctx, updated) }) : fail("internal");
  }

  try {
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        `UPDATE pickup_tickets SET claimed_at = ?, claimed_by = ? WHERE order_id = ? AND claimed_at IS NULL`,
      ).bind(ctx.now, operator.id, id),
      ctx.env.DB.prepare(
        `UPDATE orders SET fulfillment_status = 'PICKED_UP', picked_up_at = ?, picked_up_by = ?
         WHERE id = ? AND fulfillment_status = 'READY'`,
      ).bind(ctx.now, operator.id, id),
      ctx.env.DB.prepare(
        `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, safe_metadata, request_id, created_at)
         VALUES (?, ?, 'pickup_claimed', 'order', ?, '{}', ?, ?)`,
      ).bind(crypto.randomUUID(), operator.id, id, ctx.requestId, ctx.now),
    ]);
  } catch (error) {
    return fail(errorName(error));
  }
  const updated = await loadOrder(ctx, id);
  return updated ? json({ order: await orderPayload(ctx, updated) }) : fail("internal");
}

export async function staffReady(ctx: Ctx, operator: OperatorRow, id: string): Promise<Response> {
  return staffOrder(ctx, id, operator, "ready");
}

export async function staffOrders(ctx: Ctx): Promise<Response> {
  const { results } = await ctx.env.DB.prepare(
    `SELECT id, order_number, session_id, buyer_name, recipient_name, contact_phone, department_id,
            pickup_instructions_snapshot, total_rp, payment_status, fulfillment_status, created_at,
            expires_at, paid_at, ready_at, picked_up_at
     FROM orders WHERE payment_status = 'PAID' ORDER BY COALESCE(ready_at, paid_at) DESC LIMIT 50`,
  ).all<OrderRow>();
  const orders = [];
  for (const order of results) orders.push(await orderPayload(ctx, order));
  return json({ orders });
}

async function checkLookupRate(ctx: Ctx, operator: OperatorRow): Promise<boolean> {
  const windowStart = Math.floor(ctx.now / 60_000) * 60_000;
  const row = await ctx.env.DB.prepare(
    `INSERT INTO rate_limits (scope, actor_key_hash, window_start, count) VALUES ('pickup_lookup', ?, ?, 1)
     ON CONFLICT (scope, actor_key_hash, window_start) DO UPDATE SET count = count + 1
     RETURNING count`,
  )
    .bind(operator.id, windowStart)
    .first<{ count: number }>();
  return (row?.count ?? 0) <= 30;
}

type TicketRow = { order_id: string; claimed_at: number | null };

export async function staffLookup(ctx: Ctx, operator: OperatorRow): Promise<Response> {
  if (!(await checkLookupRate(ctx, operator))) return fail("rate_limited");
  const body = await readJson(ctx.request);
  const code = typeof body?.token === "string" ? body.token.trim().toUpperCase() : "";
  if (code.length < 4 || code.length > 16) return fail("invalid_payload");
  const ticket = await ctx.env.DB.prepare("SELECT order_id, claimed_at FROM pickup_tickets WHERE token_hash = ?")
    .bind(await sha256(code))
    .first<TicketRow>();
  if (!ticket) return fail("not_found");
  const order = await loadOrder(ctx, ticket.order_id);
  return order ? json({ order: await orderPayload(ctx, order) }) : fail("not_found");
}

export async function staffClaim(ctx: Ctx, operator: OperatorRow): Promise<Response> {
  const body = await readJson(ctx.request);
  const code = typeof body?.token === "string" ? body.token.trim().toUpperCase() : "";
  if (code.length < 4 || code.length > 16) return fail("invalid_payload");
  const ticket = await ctx.env.DB.prepare("SELECT order_id FROM pickup_tickets WHERE token_hash = ?")
    .bind(await sha256(code))
    .first<TicketRow>();
  if (!ticket) return fail("not_found");
  return staffOrder(ctx, ticket.order_id, operator, "claim");
}

export async function staffTicket(ctx: Ctx, session: SessionRow, id: string): Promise<Response> {
  const order = await loadOrder(ctx, id);
  if (!order || order.session_id !== session.id) return fail("not_found");
  if (order.fulfillment_status === "PICKED_UP") return fail("pickup_not_allowed");
  return json({ order: await orderPayload(ctx, order) });
}
