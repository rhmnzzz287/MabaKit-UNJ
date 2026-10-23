import { type Ctx, type SessionRow, fail, json, randomToken, releaseExpired } from "./http";

export type OrderRow = {
  id: string;
  order_number: string;
  session_id: string;
  user_id: string | null;
  faculty_id: string | null;
  buyer_name: string;
  recipient_name: string;
  contact_phone: string;
  email: string | null;
  department_id: string | null;
  pickup_instructions_snapshot: string;
  total_rp: number;
  amount_due_rp: number;
  payment_status: "PENDING" | "PAID" | "EXPIRED";
  fulfillment_status: "UNFULFILLED" | "READY" | "PICKED_UP" | "CANCELLED";
  created_at: number;
  expires_at: number;
  paid_at: number | null;
  ready_at: number | null;
  picked_up_at: number | null;
};

type ItemRow = {
  id: string;
  title_snapshot: string;
  attributes_snapshot: string;
  quantity: number;
  unit_price_rp: number;
  line_total_rp: number;
  base_unit_price_rp: number;
  discount_basis_points: number;
  charged_unit_price_rp: number;
  charged_line_total_rp: number;
};

type InvoiceRow = { invoice_number: string; issued_at: number };

export function pickupFrom(raw: string): { label: string; details: string; hours: string; version: number } {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      label: String(parsed.label ?? ""),
      details: String(parsed.details ?? ""),
      hours: String(parsed.hours ?? ""),
      version: Number(parsed.version ?? 1),
    };
  } catch {
    return { label: "", details: "", hours: "", version: 1 };
  }
}

function attributes(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function loadOrder(ctx: Ctx, orderId: string): Promise<OrderRow | null> {
  return ctx.env.DB.prepare(
    `SELECT id, order_number, session_id, user_id, faculty_id, buyer_name, recipient_name, contact_phone, email,
            department_id, pickup_instructions_snapshot, total_rp, amount_due_rp, payment_status, fulfillment_status, created_at,
            expires_at, paid_at, ready_at, picked_up_at
     FROM orders WHERE id = ?`,
  )
    .bind(orderId)
    .first<OrderRow>();
}

export async function orderPayload(ctx: Ctx, order: OrderRow): Promise<Record<string, unknown>> {
  const { results: items } = await ctx.env.DB.prepare(
    `SELECT id, title_snapshot, attributes_snapshot, quantity, unit_price_rp, line_total_rp,
            base_unit_price_rp, discount_basis_points, charged_unit_price_rp, charged_line_total_rp
     FROM order_items WHERE order_id = ? ORDER BY rowid`,
  )
    .bind(order.id)
    .all<ItemRow>();
  const payment = await ctx.env.DB.prepare("SELECT method FROM payments WHERE order_id = ?")
    .bind(order.id)
    .first<{ method: string }>();
  const invoice = await ctx.env.DB.prepare("SELECT invoice_number, issued_at FROM invoices WHERE order_id = ?")
    .bind(order.id)
    .first<InvoiceRow>();
  const review = await ctx.env.DB.prepare(
    "SELECT rating, comment, created_at FROM reviews WHERE order_id = ? AND is_example = 0",
  )
    .bind(order.id)
    .first<{ rating: number; comment: string; created_at: number }>();
  const components = await ctx.env.DB.prepare(
    `SELECT order_item_id, variant_id, sku_snapshot, title_snapshot, attributes_snapshot, quantity
     FROM order_components WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?) ORDER BY rowid`,
  )
    .bind(order.id)
    .all<{
      order_item_id: string;
      variant_id: string;
      sku_snapshot: string;
      title_snapshot: string;
      attributes_snapshot: string;
      quantity: number;
    }>();

  return {
    id: order.id,
    orderNumber: order.order_number,
    buyerName: order.buyer_name,
    recipientName: order.recipient_name,
    contactPhone: order.contact_phone,
    email: order.email,
    departmentId: order.department_id,
    facultyId: order.faculty_id,
    totalRp: order.amount_due_rp,
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status,
    method: payment?.method ?? null,
    createdAt: order.created_at,
    expiresAt: order.expires_at,
    paidAt: order.paid_at,
    readyAt: order.ready_at,
    pickedUpAt: order.picked_up_at,
    pickup: pickupFrom(order.pickup_instructions_snapshot),
    items: items.map((item) => ({
      id: item.id,
      title: item.title_snapshot,
      attributes: attributes(item.attributes_snapshot),
      quantity: item.quantity,
      unitPriceRp: item.charged_unit_price_rp,
      lineTotalRp: item.charged_line_total_rp,
      basePriceRp: item.base_unit_price_rp,
      discountBasisPoints: item.discount_basis_points,
      components: components.results
        .filter((component) => component.order_item_id === item.id)
        .map((component) => ({
          variantId: component.variant_id,
          sku: component.sku_snapshot,
          title: component.title_snapshot,
          attributes: attributes(component.attributes_snapshot),
          quantity: component.quantity,
        })),
    })),
    invoice: invoice ? { invoiceNumber: invoice.invoice_number, issuedAt: invoice.issued_at } : null,
    review: review ? { rating: review.rating, comment: review.comment, createdAt: review.created_at } : null,
    reviewEligible:
      order.payment_status === "PAID" && order.fulfillment_status === "PICKED_UP" && review === null,
  };
}

async function ownedOrder(ctx: Ctx, session: SessionRow, id: string): Promise<OrderRow | Response> {
  const order = await loadOrder(ctx, id);
  if (!order || !session.user_id || order.user_id !== session.user_id) return fail("not_found");
  return order;
}

export async function listOrders(ctx: Ctx, session: SessionRow): Promise<Response> {
  await releaseExpired(ctx);
  const { results } = await ctx.env.DB.prepare(
    `SELECT id, order_number, session_id, user_id, faculty_id, buyer_name, recipient_name, contact_phone, email,
            department_id, pickup_instructions_snapshot, total_rp, amount_due_rp, payment_status, fulfillment_status, created_at,
            expires_at, paid_at, ready_at, picked_up_at
     FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(session.user_id)
    .all<OrderRow>();
  const orders = [];
  for (const order of results) orders.push(await orderPayload(ctx, order));
  return json({ orders });
}

export async function getOrder(ctx: Ctx, session: SessionRow, id: string): Promise<Response> {
  await releaseExpired(ctx);
  const order = await ownedOrder(ctx, session, id);
  if (order instanceof Response) return order;
  return json({ order: await orderPayload(ctx, order) });
}

export async function checkPayment(ctx: Ctx, session: SessionRow, id: string): Promise<Response> {
  await releaseExpired(ctx);
  const order = await ownedOrder(ctx, session, id);
  if (order instanceof Response) return order;
  if (order.payment_status === "PAID") return json({ order: await orderPayload(ctx, order) });
  if (order.payment_status === "EXPIRED" || order.expires_at <= ctx.now) return fail("order_expired");

  const result = await ctx.env.DB.prepare(
    `UPDATE payments SET confirmed_at = ?
     WHERE order_id = ? AND confirmed_at IS NULL
       AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND payment_status = 'PENDING' AND expires_at > ?)`,
  )
    .bind(ctx.now, id, id, ctx.now)
    .run();

  if (result.meta.changes === 0) {
    const current = await loadOrder(ctx, id);
    if (current?.payment_status === "PAID") return json({ order: await orderPayload(ctx, current) });
    return fail("order_not_payable");
  }

  await releaseExpired(ctx);
  const paid = await loadOrder(ctx, id);
  return paid ? json({ order: await orderPayload(ctx, paid) }) : fail("not_found");
}

const WATERMARK = "SIMULASI: bukan bukti pembayaran nyata";

export async function invoice(ctx: Ctx, session: SessionRow, id: string): Promise<Response> {
  const order = await ownedOrder(ctx, session, id);
  if (order instanceof Response) return order;
  const row = await ctx.env.DB.prepare("SELECT invoice_number, issued_at FROM invoices WHERE order_id = ?")
    .bind(id)
    .first<InvoiceRow>();
  if (!row) return fail(order.payment_status === "PAID" ? "internal" : "order_not_payable");
  const payload = await orderPayload(ctx, order);
  return json({
    invoice: {
      invoiceNumber: row.invoice_number,
      issuedAt: row.issued_at,
      mode: "DEMO",
      watermark: WATERMARK,
      order: payload,
    },
  });
}

export async function emailPreview(ctx: Ctx, session: SessionRow, id: string): Promise<Response> {
  const order = await ownedOrder(ctx, session, id);
  if (order instanceof Response) return order;
  if (order.payment_status !== "PAID") return fail("order_not_payable");
  if (!order.email) return fail("email_unavailable");
  const row = await ctx.env.DB.prepare("SELECT invoice_number, issued_at FROM invoices WHERE order_id = ?")
    .bind(id)
    .first<InvoiceRow>();
  if (!row) return fail("order_not_payable");
  const origin = ctx.env.APP_ORIGIN ?? ctx.url.origin;
  return json({
    recipient: order.email,
    subject: `Invoice ${row.invoice_number} - MabaKit`,
    invoiceUrl: `${origin}/orders/${id}/invoice`,
    simulated: true,
    body: `Halo ${order.buyer_name}, pembayaran simulasi pesanan ${order.order_number} sudah tercatat. Invoice ${row.invoice_number} dapat dilihat di ${origin}/orders/${id}/invoice. Ini simulasi: tidak ada email yang dikirim.`,
  });
}

export function randomReference(): string {
  return randomToken(9);
}
