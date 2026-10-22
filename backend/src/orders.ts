import {
  type Ctx,
  type SessionRow,
  audit,
  fail,
  json,
  randomToken,
  releaseExpired,
  sha256,
} from "./http";

export type OrderRow = {
  id: string;
  order_number: string;
  session_id: string;
  buyer_name: string;
  recipient_name: string;
  contact_phone: string;
  department_id: string | null;
  pickup_instructions_snapshot: string;
  total_rp: number;
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
    `SELECT id, order_number, session_id, buyer_name, recipient_name, contact_phone, department_id,
            pickup_instructions_snapshot, total_rp, payment_status, fulfillment_status, created_at,
            expires_at, paid_at, ready_at, picked_up_at
     FROM orders WHERE id = ?`,
  )
    .bind(orderId)
    .first<OrderRow>();
}

export async function orderPayload(ctx: Ctx, order: OrderRow): Promise<Record<string, unknown>> {
  const { results: items } = await ctx.env.DB.prepare(
    `SELECT id, title_snapshot, attributes_snapshot, quantity, unit_price_rp, line_total_rp
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

  return {
    id: order.id,
    orderNumber: order.order_number,
    buyerName: order.buyer_name,
    recipientName: order.recipient_name,
    contactPhone: order.contact_phone,
    departmentId: order.department_id,
    totalRp: order.total_rp,
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
      unitPriceRp: item.unit_price_rp,
      lineTotalRp: item.line_total_rp,
    })),
    invoice: invoice ? { invoiceNumber: invoice.invoice_number, issuedAt: invoice.issued_at } : null,
  };
}

async function ownedOrder(ctx: Ctx, session: SessionRow, id: string): Promise<OrderRow | Response> {
  const order = await loadOrder(ctx, id);
  if (!order || order.session_id !== session.id) return fail("not_found");
  return order;
}

export async function listOrders(ctx: Ctx, session: SessionRow): Promise<Response> {
  await releaseExpired(ctx, session.id);
  const { results } = await ctx.env.DB.prepare(
    `SELECT id, order_number, session_id, buyer_name, recipient_name, contact_phone, department_id,
            pickup_instructions_snapshot, total_rp, payment_status, fulfillment_status, created_at,
            expires_at, paid_at, ready_at, picked_up_at
     FROM orders WHERE session_id = ? ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(session.id)
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
  await releaseExpired(ctx, session.id);
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

  await releaseExpired(ctx, session.id);
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

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function pickupCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export async function issuePickupToken(ctx: Ctx, session: SessionRow, id: string): Promise<Response> {
  const order = await ownedOrder(ctx, session, id);
  if (order instanceof Response) return order;
  if (order.fulfillment_status !== "READY") return fail("pickup_not_allowed");
  const code = pickupCode();
  const hash = await sha256(code);
  const existing = await ctx.env.DB.prepare("SELECT claimed_at FROM pickup_tickets WHERE order_id = ?")
    .bind(id)
    .first<{ claimed_at: number | null }>();
  if (existing?.claimed_at) return fail("pickup_not_allowed");
  if (existing) {
    await ctx.env.DB.prepare("UPDATE pickup_tickets SET token_hash = ?, issued_at = ? WHERE order_id = ?")
      .bind(hash, ctx.now, id)
      .run();
  } else {
    await ctx.env.DB.prepare("INSERT INTO pickup_tickets (order_id, token_hash, issued_at) VALUES (?, ?, ?)")
      .bind(id, hash, ctx.now)
      .run();
  }
  await audit(ctx, { actorId: session.id, action: "pickup_token_issued", entityType: "order", entityId: id });
  return json({ token: code, expiresWithOrder: false }, 201);
}

export function randomReference(): string {
  return randomToken(9);
}
