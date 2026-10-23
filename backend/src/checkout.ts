import { validateCheckout } from "./domain/checkout";
import { type Ctx, type SessionRow, audit, errorName, fail, json, readJsonLimited, releaseExpired, sha256 } from "./http";
import { loadUser } from "./auth";
import { loadOrder, orderPayload } from "./orders";
import { parseAttributes } from "./variant-attributes";
import { finalUnitPrice } from "./domain/pricing";

const METHODS = ["BANK_TRANSFER", "EWALLET", "QRIS"] as const;
const DRAFT_MINUTES = 30;

type ProductRow = { id: string; kind: "single" | "bundle"; title: string; version: number; bundle_price_rp: number | null; discount_basis_points: number };
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
  bundleConfigVersion: number | null;
  quantity: number;
  unitPriceRp: number;
  basePriceRp: number;
  discountBasisPoints: number;
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
  const user = await loadUser(ctx, session);
  if (!user) return fail("session_required");
  await releaseExpired(ctx);
  const body = await readJsonLimited(ctx.request);
  if (!body) return fail("invalid_payload");
  const parsed = validateCheckout(body);
  if (!parsed.ok) return fail(parsed.code, parsed.field ? { field: parsed.field } : undefined);
  const input = parsed.value;

  const methodRaw = (body as Record<string, unknown>).method;
  if (methodRaw !== undefined && (typeof methodRaw !== "string" || !METHODS.includes(methodRaw as (typeof METHODS)[number]))) {
    return fail("invalid_method");
  }
  const chosenMethod = methodRaw as (typeof METHODS)[number] | undefined;

  const requestHash = await sha256(
    JSON.stringify([input.items, input.buyerName, input.contactPhone, input.email, input.departmentId, methodRaw ?? "FREE"]),
  );

  const existing = await ctx.env.DB.prepare("SELECT id, request_hash FROM orders WHERE user_id = ? AND checkout_key = ?")
    .bind(user.id, input.idempotencyKey)
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
  let orderFacultyId: string | null = user.faculty_id;
  for (const item of input.items) {
    const product = await ctx.env.DB.prepare(
      "SELECT id, kind, title, version, bundle_price_rp, discount_basis_points FROM products WHERE id = ? AND active = 1",
    )
      .bind(item.productId)
      .first<ProductRow>();
    if (!product) return fail("catalog_changed");

    if (product.kind === "single") {
      if (!item.variantId || item.facultyId) return fail("invalid_item");
      const variant = await ctx.env.DB.prepare(
        "SELECT id, product_id, sku, attributes, price_rp, version FROM variants WHERE id = ? AND active = 1 AND sellable = 1",
      )
        .bind(item.variantId)
        .first<VariantRow>();
      if (!variant || variant.product_id !== product.id) return fail("catalog_changed");
      resolved.push({
        productId: product.id,
        variantId: variant.id,
        title: product.title,
        attributes: JSON.stringify(parseAttributes(variant.attributes).attributes),
        catalogVersion: product.version,
        variantVersion: variant.version,
        bundleConfigVersion: null,
        quantity: item.quantity,
        unitPriceRp: finalUnitPrice(variant.price_rp, product.discount_basis_points),
        basePriceRp: variant.price_rp,
        discountBasisPoints: product.discount_basis_points,
        components: [
          {
            variantId: variant.id,
            sku: variant.sku,
            title: product.title,
            attributes: JSON.stringify(parseAttributes(variant.attributes).attributes),
            quantity: item.quantity,
          },
        ],
      });
      continue;
    }

    if (item.variantId) return fail("invalid_item");
    if (!item.facultyId) return fail("catalog_changed");
    // Muat seluruh komponen konfigurasi: satu komponen tidak layak menolak seluruh paket.
    const { results: parts } = await ctx.env.DB.prepare(
      `SELECT c.price_rp, c.version AS config_version, bc.variant_id, bc.quantity, v.sku, v.active, v.sellable, v.attributes, v.version, p.title
       FROM bundle_configs c
       JOIN bundle_config_components bc ON bc.config_id = c.id
       JOIN variants v ON v.id = bc.variant_id
       JOIN products p ON p.id = v.product_id
       WHERE c.bundle_product_id = ? AND c.faculty_id = ? AND c.published = 1`,
    )
      .bind(product.id, item.facultyId)
      .all<{ price_rp: number; config_version: number; variant_id: string; quantity: number; sku: string; active: number; sellable: number; attributes: string; version: number; title: string }>();
    if (parts.length === 0 || parts.some((part) => part.active !== 1 || part.sellable !== 1)) return fail("catalog_changed");
    const faculty = await ctx.env.DB.prepare("SELECT name FROM faculties WHERE id = ?")
      .bind(item.facultyId)
      .first<{ name: string }>();
    orderFacultyId = item.facultyId;
    resolved.push({
      productId: product.id,
      variantId: null,
      title: product.title,
      attributes: JSON.stringify({ fakultas: faculty?.name ?? "", fakultasId: item.facultyId }),
      catalogVersion: product.version,
      variantVersion: null,
      bundleConfigVersion: parts[0].config_version,
      quantity: item.quantity,
      unitPriceRp: parts[0].price_rp,
      basePriceRp: parts[0].price_rp,
      discountBasisPoints: 0,
      components: parts.map((part) => ({
        variantId: part.variant_id,
        sku: part.sku,
        title: part.title,
        attributes: JSON.stringify(parseAttributes(part.attributes).attributes),
        quantity: part.quantity * item.quantity,
      })),
    });
  }

  const total = resolved.reduce((sum, item) => sum + item.quantity * item.unitPriceRp, 0);
  if (total > 10_000_000) return fail("invalid_payload");
  const free = total === 0;
  if (!free && !chosenMethod) return fail("invalid_method");
  const method = free ? "FREE" : chosenMethod;

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
      `INSERT INTO orders (id, order_number, session_id, user_id, checkout_key, request_hash, buyer_name, recipient_name,
         contact_phone, email, department_id, faculty_id, pickup_instructions_snapshot, total_rp, amount_due_rp,
         payment_status, fulfillment_status, stock_allocation_status, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'UNFULFILLED', 'HELD', ?, ?)`,
    ).bind(
      orderId,
      orderNumber(ctx.now),
      session.id,
      user.id,
      input.idempotencyKey,
      requestHash,
      input.buyerName,
      input.buyerName,
      input.contactPhone,
      input.email,
      input.departmentId,
      orderFacultyId,
      pickupSnapshot,
      Math.max(1, total),
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
           catalog_version, variant_version, bundle_config_version, quantity, unit_price_rp, line_total_rp,
           base_unit_price_rp, discount_basis_points, charged_unit_price_rp, charged_line_total_rp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        itemId,
        orderId,
        item.productId,
        item.variantId,
        item.title,
        item.attributes,
        item.catalogVersion,
        item.variantVersion,
        item.bundleConfigVersion,
        item.quantity,
        item.basePriceRp,
        item.quantity * item.basePriceRp,
        item.basePriceRp,
        item.discountBasisPoints,
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
  if (free) {
    statements.push(
      ctx.env.DB.prepare("UPDATE payments SET confirmed_at = ? WHERE order_id = ? AND confirmed_at IS NULL").bind(ctx.now, orderId),
    );
  }

  try {
    await ctx.env.DB.batch(statements);
  } catch (error) {
    const code = errorName(error);
    // Replay idempotensi dicari lebih dulu untuk kode apa pun: SQLite mengevaluasi
    // trigger BEFORE INSERT sebelum UNIQUE(user_id, checkout_key), jadi retry dengan
    // key yang sama bisa gagal `free_limit` padahal baris pertama sudah commit.
    const raced = await ctx.env.DB.prepare("SELECT id, request_hash FROM orders WHERE user_id = ? AND checkout_key = ?")
      .bind(user.id, input.idempotencyKey)
      .first<{ id: string; request_hash: string }>();
    if (raced?.request_hash === requestHash) {
      const order = await loadOrder(ctx, raced.id);
      if (order) return json({ order: await orderPayload(ctx, order) }, 200);
    }
    return fail(code === "internal" ? "internal" : code);
  }

  await audit(ctx, {
    actorId: user.id,
    action: "checkout_created",
    entityType: "order",
    entityId: orderId,
    metadata: { totalRp: total, method },
  });

  const order = await loadOrder(ctx, orderId);
  return order ? json({ order: await orderPayload(ctx, order) }, 201) : fail("internal");
}
