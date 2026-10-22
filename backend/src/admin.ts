import { type Ctx, type OperatorRow, audit, errorName, fail, json, readJson } from "./http";

type SettingsRow = {
  checkout_enabled: number;
  pickup_location_label: string;
  pickup_location_details: string;
  pickup_service_hours: string;
  pickup_version: number;
  updated_at: number;
};

function settingsPayload(row: SettingsRow) {
  return {
    checkoutEnabled: row.checkout_enabled === 1,
    pickup: {
      label: row.pickup_location_label,
      details: row.pickup_location_details,
      hours: row.pickup_service_hours,
      version: row.pickup_version,
    },
    updatedAt: row.updated_at,
  };
}

export async function adminSummary(ctx: Ctx): Promise<Response> {
  const settings = await ctx.env.DB.prepare(
    `SELECT checkout_enabled, pickup_location_label, pickup_location_details, pickup_service_hours, pickup_version, updated_at
     FROM store_settings WHERE id = 1`,
  ).first<SettingsRow>();
  const { results: variants } = await ctx.env.DB.prepare(
    `SELECT v.id, v.sku, v.price_rp, v.stock_on_hand, v.stock_reserved, v.active, p.title
     FROM variants v JOIN products p ON p.id = v.product_id ORDER BY p.title, v.sku`,
  ).all<{
    id: string;
    sku: string;
    price_rp: number;
    stock_on_hand: number;
    stock_reserved: number;
    active: number;
    title: string;
  }>();
  const counts = await ctx.env.DB.prepare(
    `SELECT
       SUM(CASE WHEN payment_status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN payment_status = 'PAID' THEN 1 ELSE 0 END) AS paid,
       SUM(CASE WHEN payment_status = 'EXPIRED' THEN 1 ELSE 0 END) AS expired,
       SUM(CASE WHEN fulfillment_status = 'READY' THEN 1 ELSE 0 END) AS ready,
       SUM(CASE WHEN fulfillment_status = 'PICKED_UP' THEN 1 ELSE 0 END) AS picked_up
     FROM orders`,
  ).first<Record<string, number | null>>();

  return json({
    settings: settings ? settingsPayload(settings) : null,
    variants: variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      title: variant.title,
      priceRp: variant.price_rp,
      stockOnHand: variant.stock_on_hand,
      stockReserved: variant.stock_reserved,
      active: variant.active === 1,
    })),
    counts: {
      pending: counts?.pending ?? 0,
      paid: counts?.paid ?? 0,
      expired: counts?.expired ?? 0,
      ready: counts?.ready ?? 0,
      pickedUp: counts?.picked_up ?? 0,
    },
  });
}

export async function adminSettings(ctx: Ctx, operator: OperatorRow): Promise<Response> {
  const body = await readJson(ctx.request);
  if (!body) return fail("invalid_payload");

  const current = await ctx.env.DB.prepare(
    `SELECT checkout_enabled, pickup_location_label, pickup_location_details, pickup_service_hours, pickup_version, updated_at
     FROM store_settings WHERE id = 1`,
  ).first<SettingsRow>();
  if (!current) return fail("internal");

  const checkoutEnabled =
    typeof body.checkoutEnabled === "boolean" ? body.checkoutEnabled : current.checkout_enabled === 1;
  const label = typeof body.pickupLabel === "string" ? body.pickupLabel.trim() : current.pickup_location_label;
  const details = typeof body.pickupDetails === "string" ? body.pickupDetails.trim() : current.pickup_location_details;
  const hours = typeof body.pickupServiceHours === "string" ? body.pickupServiceHours.trim() : current.pickup_service_hours;
  if (label.length < 1 || label.length > 120 || details.length > 300 || hours.length > 120) return fail("invalid_payload");

  const pickupChanged =
    label !== current.pickup_location_label ||
    details !== current.pickup_location_details ||
    hours !== current.pickup_service_hours;

  await ctx.env.DB.prepare(
    `UPDATE store_settings SET checkout_enabled = ?, pickup_location_label = ?, pickup_location_details = ?,
       pickup_service_hours = ?, pickup_version = pickup_version + ?, updated_at = ? WHERE id = 1`,
  )
    .bind(checkoutEnabled ? 1 : 0, label, details, hours, pickupChanged ? 1 : 0, ctx.now)
    .run();

  await audit(ctx, {
    actorId: operator.id,
    action: "settings_updated",
    entityType: "store_settings",
    entityId: "1",
    metadata: { checkoutEnabled, pickupChanged },
  });

  return adminSummary(ctx);
}

export async function adminStock(ctx: Ctx, operator: OperatorRow, variantId: string): Promise<Response> {
  const body = await readJson(ctx.request);
  const onHand = body?.onHand;
  if (typeof onHand !== "number" || !Number.isInteger(onHand) || onHand < 0 || onHand > 100_000) {
    return fail("invalid_payload");
  }
  try {
    const result = await ctx.env.DB.prepare(
      "UPDATE variants SET stock_on_hand = ?, version = version + 1, updated_at = ? WHERE id = ?",
    )
      .bind(onHand, ctx.now, variantId)
      .run();
    if (result.meta.changes === 0) return fail("not_found");
  } catch (error) {
    return fail(errorName(error));
  }
  await audit(ctx, {
    actorId: operator.id,
    action: "stock_adjusted",
    entityType: "variant",
    entityId: variantId,
    metadata: { onHand },
  });
  const variant = await ctx.env.DB.prepare(
    "SELECT id, sku, stock_on_hand, stock_reserved FROM variants WHERE id = ?",
  )
    .bind(variantId)
    .first<{ id: string; sku: string; stock_on_hand: number; stock_reserved: number }>();
  return json({
    variant: variant
      ? { id: variant.id, sku: variant.sku, stockOnHand: variant.stock_on_hand, stockReserved: variant.stock_reserved }
      : null,
  });
}

export async function adminAudit(ctx: Ctx): Promise<Response> {
  const { results } = await ctx.env.DB.prepare(
    `SELECT id, actor_id, action, entity_type, entity_id, safe_metadata, created_at
     FROM audit_logs ORDER BY created_at DESC LIMIT 100`,
  ).all<{
    id: string;
    actor_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string;
    safe_metadata: string;
    created_at: number;
  }>();
  return json({
    logs: results.map((log) => ({
      id: log.id,
      actorId: log.actor_id,
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id,
      metadata: JSON.parse(log.safe_metadata) as Record<string, unknown>,
      createdAt: log.created_at,
    })),
  });
}
