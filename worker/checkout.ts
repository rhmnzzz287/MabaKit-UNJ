import { validateCheckout } from "./domain/checkout";
import { type Ctx, type SessionRow, audit, errorName, fail, json, sha256 } from "./http";
import { loadOrder, orderPayload } from "./orders";

const METHODS = ["BANK_TRANSFER", "EWALLET", "QRIS"] as const;
const DRAFT_MINUTES = 30;

type ProductRow = { id: string; kind: "single" | "bundle"; title: string; version: number; bundle_price_rp: number | null };
type VariantRow = {
  id: string;
  product_id: string;
  sku: string;
  attributes: string;
  price_rp: number;
  version: number;
};

type ResolvedItem = {
  productId: string;
  variantId: string | null;
  title: string;
  attributes: string;
  catalogVersion: number;
  variantVersion: number | null;
  quantity: number;
  unitPriceRp: number;
  components: { variantId: string; sku: string; title: string; attributes: string; quantity: number }[];
};

function orderNumber(now: number): string {
  const date = new Date(now).toISOString().slice(2, 10).replace(/-/g, "");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `MBK-${date}-${[...bytes].map((byte) => alphabet[byte % alphabet.length]).join("")}`;
}

export async function createCheckout(ctx: Ctx, session: SessionRow): Promise<Response> {
  const body = await ctx.request.json().catch(() => null);
  const parsed = validateCheckout(body);
  if (!parsed.ok) return fail(parsed.code, parsed.field ? { field: parsed.field } : undefined);
  const input = parsed.value;

  const methodRaw = (body as Record<string, unknown>).method;
  if (typeof methodRaw !== "string" || !METHODS.includes(methodRaw as (typeof METHODS)[number])) {
    return fail("invalid_method");
  }
  const method = methodRaw as (typeof METHODS)[number];

  const requestHash = await sha256(
    JSON.stringify([input.items, input.buyerName, input.recipientName, input.contactPhone, input.departmentId, method]),
  );

  const existing = await ctx.env.DB.prepare("SELECT id, request_hash FROM orders WHERE session_id = ? AND checkout_key = ?")
    .bind(session.id, input.idempotencyKey)
    .first<{ id: string; request_hash: string }>();
  if (existing) {
    if (existing.request_hash !== requestHash) return fail("conflict");
    const order = await loadOrder(ctx, existing.id);
    return order ? json({ order: await orderPayload(ctx, order) }, 200) : fail("not_found");
  }

  const settings = await ctx.env.DB.prepare(
    `SELECT checkout_enabled, pickup_location_label, pickup_location_details, pickup_service_hours, pickup_version
     FROM store_settings WHERE id = 1`,
  ).first<{
    checkout_enabled: number;
    pickup_location_label: string;
    pickup_location_details: string;
    pickup_service_hours: string;
    pickup_version: number;
  }>();
  if (!settings || settings.checkout_enabled !== 1) return fail("checkout_disabled");

  const resolved: ResolvedItem[] = [];
  for (const item of input.items) {
    const product = await ctx.env.DB.prepare(
      "SELECT id, kind, title, version, bundle_price_rp FROM products WHERE id = ? AND active = 1",
    )
      .bind(item.productId)
      .first<ProductRow>();
    if (!product) return fail("catalog_changed");

    if (product.kind === "single") {
      if (!item.variantId) return fail("invalid_item");
      const variant = await ctx.env.DB.prepare(
        "SELECT id, product_id, sku, attributes, price_rp, version FROM variants WHERE id = ? AND active = 1",
      )
        .bind(item.variantId)
        .first<VariantRow>();
      if (!variant || variant.product_id !== product.id) return fail("catalog_changed");
      resolved.push({
        productId: product.id,
        variantId: variant.id,
        title: product.title,
        attributes: variant.attributes,
        catalogVersion: product.version,
        variantVersion: variant.version,
        quantity: item.quantity,
        unitPriceRp: variant.price_rp,
        components: [
          {
            variantId: variant.id,
            sku: variant.sku,
            title: product.title,
            attributes: variant.attributes,
            quantity: item.quantity,
          },
        ],
      });
      continue;
    }

    if (item.variantId) return fail("invalid_item");
    const { results: parts } = await ctx.env.DB.prepare(
      `SELECT bc.variant_id, bc.quantity, v.sku, v.attributes, v.version, p.title
       FROM bundle_components bc
       JOIN variants v ON v.id = bc.variant_id
       JOIN products p ON p.id = v.product_id
       WHERE bc.bundle_product_id = ?`,
    )
      .bind(product.id)
      .all<{ variant_id: string; quantity: number; sku: string; attributes: string; version: number; title: string }>();
    if (parts.length === 0) return fail("catalog_changed");
    resolved.push({
      productId: product.id,
      variantId: null,
      title: product.title,
      attributes: "{}",
      catalogVersion: product.version,
      variantVersion: null,
      quantity: item.quantity,
      unitPriceRp: product.bundle_price_rp ?? 0,
      components: parts.map((part) => ({
        variantId: part.variant_id,
        sku: part.sku,
        title: part.title,
        attributes: part.attributes,
        quantity: part.quantity * item.quantity,
      })),
    });
  }

  const total = resolved.reduce((sum, item) => sum + item.quantity * item.unitPriceRp, 0);
  if (total < 1 || total > 10_000_000) return fail("invalid_payload");

  const orderId = crypto.randomUUID();
  const expiresAt = ctx.now + DRAFT_MINUTES * 60_000;
  const pickupSnapshot = JSON.stringify({
    label: settings.pickup_location_label,
    details: settings.pickup_location_details,
    hours: settings.pickup_service_hours,
    version: settings.pickup_version,
  });

  const statements = [
    ctx.env.DB.prepare(
      `INSERT INTO orders (id, order_number, session_id, checkout_key, request_hash, buyer_name, recipient_name,
         contact_phone, department_id, pickup_instructions_snapshot, total_rp, payment_status, fulfillment_status,
         stock_allocation_status, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'UNFULFILLED', 'HELD', ?, ?)`,
    ).bind(
      orderId,
      orderNumber(ctx.now),
      session.id,
      input.idempotencyKey,
      requestHash,
      input.buyerName,
      input.recipientName,
      input.contactPhone,
      input.departmentId,
      pickupSnapshot,
      total,
      ctx.now,
      expiresAt,
    ),
  ];

  for (const item of resolved) {
    const itemId = crypto.randomUUID();
    statements.push(
      ctx.env.DB.prepare(
        `INSERT INTO order_items (id, order_id, product_id, variant_id, title_snapshot, attributes_snapshot,
           catalog_version, variant_version, quantity, unit_price_rp, line_total_rp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        itemId,
        orderId,
        item.productId,
        item.variantId,
        item.title,
        item.attributes,
        item.catalogVersion,
        item.variantVersion,
        item.quantity,
        item.unitPriceRp,
        item.quantity * item.unitPriceRp,
      ),
    );
    for (const component of item.components) {
      statements.push(
        ctx.env.DB.prepare(
          `INSERT INTO order_components (order_item_id, variant_id, sku_snapshot, title_snapshot, attributes_snapshot, quantity)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).bind(itemId, component.variantId, component.sku, component.title, component.attributes, component.quantity),
      );
    }
  }

  statements.push(
    ctx.env.DB.prepare("INSERT INTO payments (order_id, mode, method) VALUES (?, 'DEMO', ?)").bind(orderId, method),
  );

  try {
    await ctx.env.DB.batch(statements);
  } catch (error) {
    const code = errorName(error);
    return fail(code === "internal" ? "internal" : code);
  }

  await audit(ctx, {
    actorId: session.id,
    action: "checkout_created",
    entityType: "order",
    entityId: orderId,
    metadata: { totalRp: total, method },
  });

  const order = await loadOrder(ctx, orderId);
  return order ? json({ order: await orderPayload(ctx, order) }, 201) : fail("internal");
}
