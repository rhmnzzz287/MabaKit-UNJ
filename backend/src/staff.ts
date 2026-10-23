import { type Ctx, type OperatorRow, audit, fail, json } from "./http";
import { loadOrder, orderPayload } from "./orders";

export async function staffReady(ctx: Ctx, operator: OperatorRow, id: string): Promise<Response> {
  const order = await loadOrder(ctx, id);
  if (!order) return fail("not_found");
  if (order.payment_status !== "PAID") return fail("not_ready_transition");

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

