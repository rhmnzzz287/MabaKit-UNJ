import { type Ctx, type OperatorRow, audit, errorName, fail, json, readJsonLimited } from "./http";

type ProductRow = {
  id: string;
  kind: "single" | "bundle";
  title: string;
  description: string;
  image_path: string | null;
  active: number;
  discount_basis_points: number;
  version: number;
};
type VariantRow = {
  id: string;
  product_id: string;
  sku: string;
  attributes: string;
  price_rp: number;
  stock_on_hand: number;
  stock_reserved: number;
  active: number;
  sellable: number;
  version: number;
};

function text(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max ? trimmed : null;
}

function money(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 10_000_000 ? value : null;
}

function stock(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100_000 ? value : null;
}

function attributes(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 12) return null;
  const clean: Record<string, string> = {};
  for (const [key, raw] of entries) {
    if (!/^[a-zA-Z0-9_]{1,24}$/.test(key)) return null;
    if (typeof raw !== "string" || raw.length > 120) return null;
    clean[key] = raw;
  }
  return JSON.stringify(clean);
}

export async function adminCatalog(ctx: Ctx): Promise<Response> {
  const { results: products } = await ctx.env.DB.prepare(
    "SELECT id, kind, title, description, image_path, active, discount_basis_points, version FROM products ORDER BY kind, title",
  ).all<ProductRow>();
  const { results: variants } = await ctx.env.DB.prepare(
    "SELECT id, product_id, sku, attributes, price_rp, stock_on_hand, stock_reserved, active, sellable, version FROM variants ORDER BY sku",
  ).all<VariantRow>();
  const { results: configs } = await ctx.env.DB.prepare(
    `SELECT c.id, c.bundle_product_id, c.faculty_id, f.name AS faculty_name, c.price_rp, c.published
     FROM bundle_configs c JOIN faculties f ON f.id = c.faculty_id ORDER BY f.name`,
  ).all<{
    id: string;
    bundle_product_id: string;
    faculty_id: string;
    faculty_name: string;
    price_rp: number;
    published: number;
  }>();
  const { results: components } = await ctx.env.DB.prepare(
    "SELECT config_id, variant_id, quantity FROM bundle_config_components",
  ).all<{ config_id: string; variant_id: string; quantity: number }>();
  const { results: faculties } = await ctx.env.DB.prepare(
    "SELECT id, name, active FROM faculties ORDER BY name",
  ).all<{ id: string; name: string; active: number }>();
  const { results: aliases } = await ctx.env.DB.prepare("SELECT alias, faculty_id FROM faculty_aliases").all<{
    alias: string;
    faculty_id: string;
  }>();

  return json({
    products: products.map((product) => ({
      id: product.id,
      kind: product.kind,
      title: product.title,
      discountBasisPoints: product.discount_basis_points,
      description: product.description,
      imagePath: product.image_path,
      active: product.active === 1,
      version: product.version,
      variants: variants
        .filter((variant) => variant.product_id === product.id)
        .map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          attributes: JSON.parse(variant.attributes) as Record<string, string>,
          priceRp: variant.price_rp,
          stockOnHand: variant.stock_on_hand,
          stockReserved: variant.stock_reserved,
          sellable: variant.sellable === 1,
          active: variant.active === 1,
        })),
      configs: configs
        .filter((config) => config.bundle_product_id === product.id)
        .map((config) => ({
          id: config.id,
          facultyId: config.faculty_id,
          facultyName: config.faculty_name,
          priceRp: config.price_rp,
          published: config.published === 1,
          components: components
            .filter((component) => component.config_id === config.id)
            .map((component) => ({ variantId: component.variant_id, quantity: component.quantity })),
        })),
    })),
    faculties: faculties.map((faculty) => ({
      id: faculty.id,
      name: faculty.name,
      active: faculty.active === 1,
      aliases: aliases.filter((alias) => alias.faculty_id === faculty.id).map((alias) => alias.alias),
    })),
  });
}

export async function adminCreateProduct(ctx: Ctx, operator: OperatorRow): Promise<Response> {
  const body = await readJsonLimited(ctx.request);
  const kind = body?.kind === "bundle" ? "bundle" : body?.kind === "single" ? "single" : null;
  const title = text(body?.title, 1, 80);
  const description = text(body?.description ?? "", 0, 600);
  const imagePath = body?.imagePath === null || body?.imagePath === undefined ? null : text(body.imagePath, 1, 200);
  if (!body || !kind || !title || description === null || (body.imagePath !== undefined && body.imagePath !== null && !imagePath)) {
    return fail("invalid_payload");
  }
  const id = `p-${crypto.randomUUID().slice(0, 8)}`;
  await ctx.env.DB.prepare(
    `INSERT INTO products (id, kind, title, description, image_path, bundle_price_rp, active, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`,
  )
    // Paket baru memakai harga placeholder sampai admin menetapkan harga per fakultas.
    .bind(id, kind, title, description, imagePath, kind === "bundle" ? 1 : null, ctx.now, ctx.now)
    .run();
  await audit(ctx, { actorId: operator.id, action: "product_created", entityType: "product", entityId: id, metadata: { kind } });
  return json({ product: { id, kind, title, description, imagePath, active: false } }, 201);
}

export async function adminUpdateProduct(ctx: Ctx, operator: OperatorRow, id: string): Promise<Response> {
  const body = await readJsonLimited(ctx.request);
  if (!body) return fail("invalid_payload");
  const current = await ctx.env.DB.prepare("SELECT id, title, description, image_path, active, discount_basis_points FROM products WHERE id = ?")
    .bind(id)
    .first<{ id: string; title: string; description: string; image_path: string | null; active: number; discount_basis_points: number }>();
  if (!current) return fail("not_found");

  const title = body.title === undefined ? current.title : text(body.title, 1, 80);
  const description = body.description === undefined ? current.description : text(body.description, 0, 600);
  const imagePath =
    body.imagePath === undefined ? current.image_path : body.imagePath === null ? null : text(body.imagePath, 1, 200);
  const active = body.active === undefined ? current.active === 1 : body.active;
  const discount =
    body.discountBasisPoints === undefined
      ? current.discount_basis_points
      : typeof body.discountBasisPoints === "number" && Number.isInteger(body.discountBasisPoints) && body.discountBasisPoints >= 0 && body.discountBasisPoints <= 10000
        ? body.discountBasisPoints
        : null;
  if (discount === null) return fail("invalid_payload", { field: "discountBasisPoints" });
  if (!title || description === null || (body.imagePath !== undefined && body.imagePath !== null && !imagePath)) {
    return fail("invalid_payload");
  }
  if (typeof active !== "boolean") return fail("invalid_payload");

  await ctx.env.DB.prepare(
    "UPDATE products SET title = ?, description = ?, image_path = ?, active = ?, discount_basis_points = ?, version = version + 1, updated_at = ? WHERE id = ?",
  )
    .bind(title, description, imagePath, active ? 1 : 0, discount, ctx.now, id)
    .run();
  await audit(ctx, { actorId: operator.id, action: "product_updated", entityType: "product", entityId: id, metadata: { active, discountBasisPoints: discount } });
  return json({ updated: true });
}

export async function adminCreateVariant(ctx: Ctx, operator: OperatorRow, productId: string): Promise<Response> {
  const body = await readJsonLimited(ctx.request);
  const product = await ctx.env.DB.prepare("SELECT id, kind FROM products WHERE id = ?")
    .bind(productId)
    .first<{ id: string; kind: string }>();
  if (!product) return fail("not_found");
  if (product.kind !== "single") return fail("invalid_payload");

  const sku = typeof body?.sku === "string" ? body.sku.trim().toUpperCase() : "";
  const priceRp = money(body?.priceRp);
  const stockOnHand = stock(body?.stockOnHand ?? 0);
  const attrs = attributes(body?.attributes ?? {});
  const active = body?.active === undefined ? false : body?.active;
  const facultyId = body?.facultyId === null || body?.facultyId === undefined ? null : String(body.facultyId);
  if (!/^[A-Z0-9-]{3,40}$/.test(sku) || !priceRp || stockOnHand === null || !attrs || typeof active !== "boolean") {
    return fail("invalid_payload");
  }
  if (facultyId) {
    const faculty = await ctx.env.DB.prepare("SELECT id FROM faculties WHERE id = ?").bind(facultyId).first();
    if (!faculty) return fail("invalid_payload", { field: "facultyId" });
  }

  const id = `v-${crypto.randomUUID().slice(0, 8)}`;
  const sellable = productId === "p-goodie" ? 0 : 1;
  try {
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        `INSERT INTO variants (id, product_id, sku, attributes, price_rp, stock_on_hand, active, sellable, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      ).bind(id, productId, sku, attrs, priceRp, stockOnHand, active ? 1 : 0, sellable, ctx.now, ctx.now),
      ...(facultyId
        ? [ctx.env.DB.prepare("INSERT OR IGNORE INTO variant_faculties (variant_id, faculty_id) VALUES (?, ?)").bind(id, facultyId)]
        : []),
    ]);
  } catch (error) {
    return fail(errorName(error));
  }
  await audit(ctx, { actorId: operator.id, action: "variant_created", entityType: "variant", entityId: id, metadata: { sku } });
  return json({ variant: { id, sku, priceRp, stockOnHand, active } }, 201);
}

export async function adminUpdateVariant(ctx: Ctx, operator: OperatorRow, id: string): Promise<Response> {
  const body = await readJsonLimited(ctx.request);
  if (!body) return fail("invalid_payload");
  const current = await ctx.env.DB.prepare(
    "SELECT id, sku, attributes, price_rp, stock_on_hand, active, sellable FROM variants WHERE id = ?",
  )
    .bind(id)
    .first<{
      id: string;
      sku: string;
      attributes: string;
      price_rp: number;
      stock_on_hand: number;
      active: number;
      sellable: number;
    }>();
  if (!current) return fail("not_found");

  const priceRp = body.priceRp === undefined ? current.price_rp : money(body.priceRp);
  const stockOnHand = body.stockOnHand === undefined ? current.stock_on_hand : stock(body.stockOnHand);
  const attrs = body.attributes === undefined ? current.attributes : attributes(body.attributes);
  const active = body.active === undefined ? current.active === 1 : body.active;
  const nextSellable = body.sellable === undefined ? null : body.sellable;
  if (!priceRp || stockOnHand === null || !attrs || typeof active !== "boolean" || (nextSellable !== null && typeof nextSellable !== "boolean"))
    return fail("invalid_payload");
  const sellable = nextSellable === null ? current.sellable === 1 : nextSellable;
  try {
    await ctx.env.DB.prepare(
      "UPDATE variants SET price_rp = ?, stock_on_hand = ?, attributes = ?, active = ?, sellable = ?, version = version + 1, updated_at = ? WHERE id = ?",
    )
      .bind(priceRp, stockOnHand, attrs, active ? 1 : 0, sellable ? 1 : 0, ctx.now, id)
      .run();
  } catch (error) {
    return fail(errorName(error));
  }
  await audit(ctx, { actorId: operator.id, action: "variant_updated", entityType: "variant", entityId: id, metadata: { active, sellable } });
  return json({ updated: true });
}

export async function adminSavePackageConfig(
  ctx: Ctx,
  operator: OperatorRow,
  packageId: string,
  facultyId: string,
): Promise<Response> {
  const body = await readJsonLimited(ctx.request);
  const product = await ctx.env.DB.prepare("SELECT id, kind FROM products WHERE id = ? AND kind = 'bundle'")
    .bind(packageId)
    .first<{ id: string }>();
  const faculty = await ctx.env.DB.prepare("SELECT id FROM faculties WHERE id = ?").bind(facultyId).first();
  if (!product || !faculty) return fail("not_found");

  const priceRp = money(body?.priceRp);
  const published = body?.published === true;
  const rawComponents = body?.components;
  if (!priceRp || !Array.isArray(rawComponents) || rawComponents.length === 0 || rawComponents.length > 20) {
    return fail("invalid_payload");
  }
  const seen = new Set<string>();
  const components: { variantId: string; quantity: number }[] = [];
  for (const raw of rawComponents) {
    const item = raw as Record<string, unknown>;
    const variantId = typeof item?.variantId === "string" ? item.variantId : "";
    const quantity = item?.quantity;
    if (!variantId || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return fail("invalid_payload");
    }
    if (seen.has(variantId)) return fail("invalid_payload");
    seen.add(variantId);
    const variant = await ctx.env.DB.prepare(
      "SELECT id, active, sellable FROM variants WHERE id = ?",
    )
      .bind(variantId)
      .first<{ id: string; active: number; sellable: number }>();
    if (!variant) return fail("invalid_payload", { field: "components" });
    if (published && (variant.active !== 1 || variant.sellable !== 1)) {
      return fail("package_not_publishable", { field: "components" });
    }
    components.push({ variantId, quantity });
  }

  const id = `cfg-${packageId}-${facultyId}`;
  try {
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        `INSERT INTO bundle_configs (id, bundle_product_id, faculty_id, price_rp, published, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (bundle_product_id, faculty_id) DO UPDATE SET
           price_rp = excluded.price_rp, published = excluded.published, updated_at = excluded.updated_at`,
      ).bind(id, packageId, facultyId, priceRp, published ? 1 : 0, ctx.now, ctx.now),
      ctx.env.DB.prepare("DELETE FROM bundle_config_components WHERE config_id = ?").bind(id),
      ...components.map((component) =>
        ctx.env.DB.prepare("INSERT INTO bundle_config_components (config_id, variant_id, quantity) VALUES (?, ?, ?)").bind(
          id,
          component.variantId,
          component.quantity,
        ),
      ),
    ]);
  } catch (error) {
    return fail(errorName(error));
  }
  await audit(ctx, {
    actorId: operator.id,
    action: "package_config_saved",
    entityType: "bundle_config",
    entityId: id,
    metadata: { priceRp, published },
  });
  return json({ config: { id, priceRp, published, components } });
}

export async function adminAliases(ctx: Ctx, operator: OperatorRow, facultyId: string): Promise<Response> {
  const body = await readJsonLimited(ctx.request);
  const faculty = await ctx.env.DB.prepare("SELECT id FROM faculties WHERE id = ?").bind(facultyId).first();
  if (!faculty) return fail("not_found");
  if (!body || !Array.isArray(body.aliases) || body.aliases.length > 12) return fail("invalid_payload");
  const aliases: string[] = [];
  for (const raw of body.aliases) {
    if (typeof raw !== "string") return fail("invalid_payload");
    const alias = raw.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,12}$/.test(alias) || aliases.includes(alias)) return fail("invalid_payload");
    aliases.push(alias);
  }
  const conflict = await ctx.env.DB.prepare(
    `SELECT alias FROM faculty_aliases WHERE alias IN (${aliases.map(() => "?").join(",") || "''"}) AND faculty_id <> ?`,
  )
    .bind(...aliases, facultyId)
    .first<{ alias: string }>();
  if (conflict) return fail("conflict", { field: "aliases" });

  await ctx.env.DB.batch([
    ctx.env.DB.prepare("DELETE FROM faculty_aliases WHERE faculty_id = ?").bind(facultyId),
    ...aliases.map((alias) =>
      ctx.env.DB.prepare("INSERT INTO faculty_aliases (alias, faculty_id) VALUES (?, ?)").bind(alias, facultyId),
    ),
  ]);
  await audit(ctx, { actorId: operator.id, action: "faculty_aliases_updated", entityType: "faculty", entityId: facultyId });
  return json({ aliases });
}
