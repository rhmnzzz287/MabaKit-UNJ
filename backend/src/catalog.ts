import { type Ctx, fail, json, releaseExpired } from "./http";
import { parseAttributes } from "./variant-attributes";
import { finalUnitPrice } from "./domain/pricing";

type ProductRow = {
  id: string;
  kind: "single" | "bundle";
  title: string;
  description: string;
  image_path: string | null;
  bundle_price_rp: number | null;
  discount_basis_points: number;
  version: number;
  faculty_id: string | null;
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
};
type ConfigRow = {
  id: string;
  bundle_product_id: string;
  faculty_id: string;
  faculty_name: string;
  price_rp: number;
};
type PhotoRow = {
  id: string;
  product_id: string;
  object_key: string;
  width: number;
  height: number;
};

export type CatalogVariant = {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  imagePath: string | null;
  imagePath480: string | null;
  basePriceRp: number;
  finalPriceRp: number;
  priceRp: number;
  stock: number;
  faculties: string[];
};
export type CatalogPhoto = { id: string; url: string; width: number; height: number };
export type CatalogProduct = {
  id: string;
  kind: "single" | "bundle";
  title: string;
  description: string;
  imagePath: string | null;
  photos?: CatalogPhoto[];
  basePriceRp: number;
  discountBasisPoints: number;
  finalPriceRp: number;
  priceRp: number;
  stock: number;
  variants: CatalogVariant[];
  facultyId?: string | null;
  facultyOptions?: { facultyId: string; facultyName: string; priceRp: number; stock: number; photos?: string[] }[];
  /** Nama produk penyusun paket, tanpa duplikat. Dipakai kartu katalog untuk menampilkan isi paket. */
  componentTitles?: string[];
  /** Foto barang penyusun paket untuk fakultas paket itu, dipakai grid foto kartu paket. */
  componentPhotos?: string[];
};

export type QuoteComponent = {
  variantId: string;
  sku: string;
  title: string;
  attributes: Record<string, string>;
  imagePath: string | null;
  quantity: number;
  unitPriceRp: number;
  lineTotalRp: number;
  stock: number;
};

export function available(variant: VariantRow): number {
  return Math.max(0, variant.stock_on_hand - variant.stock_reserved);
}

async function loadCatalog(ctx: Ctx) {
  await releaseExpired(ctx);
  const { results: products } = await ctx.env.DB.prepare(
    `SELECT id, kind, title, description, image_path, bundle_price_rp, discount_basis_points, version, faculty_id
     FROM products WHERE active = 1 ORDER BY kind DESC, title`,
  ).all<ProductRow>();
  const { results: variants } = await ctx.env.DB.prepare(
    `SELECT id, product_id, sku, attributes, price_rp, stock_on_hand, stock_reserved, active
     FROM variants WHERE active = 1 AND sellable = 1`,
  ).all<VariantRow>();
  const { results: variantFaculties } = await ctx.env.DB.prepare(
    "SELECT variant_id, faculty_id FROM variant_faculties",
  ).all<{ variant_id: string; faculty_id: string }>();
  const { results: configs } = await ctx.env.DB.prepare(
    `SELECT c.id, c.bundle_product_id, c.faculty_id, f.name AS faculty_name, c.price_rp
     FROM bundle_configs c JOIN faculties f ON f.id = c.faculty_id
     WHERE c.published = 1 ORDER BY f.name`,
  ).all<ConfigRow>();
  const { results: photos } = await ctx.env.DB.prepare(
    `SELECT ph.id, ph.product_id, ph.object_key, ph.width, ph.height
     FROM product_photos ph JOIN products p ON p.id = ph.product_id
     WHERE p.active = 1 ORDER BY ph.position, ph.id`,
  ).all<PhotoRow>();
  return { products, variants, variantFaculties, configs, photos };
}

export async function catalog(ctx: Ctx): Promise<Response> {
  const { products, variants, variantFaculties, configs, photos } = await loadCatalog(ctx);
  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  const titleByProduct = new Map(products.map((product) => [product.id, product.title]));
  const photosByProduct = new Map<string, CatalogPhoto[]>();
  for (const photo of photos) {
    const list = photosByProduct.get(photo.product_id) ?? [];
    list.push({ id: photo.id, url: `/media/${photo.object_key}`, width: photo.width, height: photo.height });
    photosByProduct.set(photo.product_id, list);
  }
  const facultiesByVariant = new Map<string, string[]>();
  for (const row of variantFaculties) {
    facultiesByVariant.set(row.variant_id, [...(facultiesByVariant.get(row.variant_id) ?? []), row.faculty_id]);
  }
  const configIds = new Map<string, string[]>();
  for (const config of configs) configIds.set(config.bundle_product_id, [...(configIds.get(config.bundle_product_id) ?? []), config.id]);

  const items: CatalogProduct[] = [];
  for (const product of products) {
    const own = variants.filter((variant) => variant.product_id === product.id);
    if (product.kind === "single") {
      items.push({
        id: product.id,
        kind: "single",
        title: product.title,
        description: product.description,
        imagePath: product.image_path,
        photos: photosByProduct.get(product.id) ?? [],
        basePriceRp: own[0]?.price_rp ?? 0,
        discountBasisPoints: product.discount_basis_points,
        finalPriceRp: finalUnitPrice(own[0]?.price_rp ?? 0, product.discount_basis_points),
        priceRp: finalUnitPrice(own[0]?.price_rp ?? 0, product.discount_basis_points),
        stock: own.reduce((total, variant) => total + available(variant), 0),
        variants: own.map((variant) => {
          const parsed = parseAttributes(variant.attributes);
          return {
            id: variant.id,
            sku: variant.sku,
            attributes: parsed.attributes,
            imagePath: parsed.imagePath,
            imagePath480: typeof parsed.attributes.foto480 === "string" ? parsed.attributes.foto480 : null,
            basePriceRp: variant.price_rp,
            finalPriceRp: finalUnitPrice(variant.price_rp, product.discount_basis_points),
            priceRp: finalUnitPrice(variant.price_rp, product.discount_basis_points),
            stock: available(variant),
            faculties: facultiesByVariant.get(variant.id) ?? [],
          };
        }),
      });
      continue;
    }

    const ownConfigs = configs.filter((config) => config.bundle_product_id === product.id);
    if (ownConfigs.length === 0) continue;

    const { results: parts } = await ctx.env.DB.prepare(
      `SELECT cc.config_id, cc.variant_id, cc.quantity
       FROM bundle_config_components cc WHERE cc.config_id IN (${ownConfigs.map(() => "?").join(",")})`,
    )
      .bind(...ownConfigs.map((config) => config.id))
      .all<{ config_id: string; variant_id: string; quantity: number }>();

    const options = ownConfigs.map((config) => {
      const components = parts.filter((part) => part.config_id === config.id);
      const stock = components.length
        ? Math.min(
            ...components.map((part) => {
              const variant = byId.get(part.variant_id);
              return variant ? Math.floor(available(variant) / part.quantity) : 0;
            }),
          )
        : 0;
      return { facultyId: config.faculty_id, facultyName: config.faculty_name, priceRp: config.price_rp, stock };
    });

    // Foto per fakultas: satu foto per jenis barang, urut nama barang supaya stabil antar-request.
    // Paket fakultas hanya punya satu config, tier netral punya satu config per fakultas.
    const photosByConfig = new Map(
      ownConfigs.map((config) => {
        const byTitle = new Map<string, string>();
        for (const part of parts) {
          if (part.config_id !== config.id) continue;
          const variant = byId.get(part.variant_id);
          if (!variant) continue;
          const photo = parseAttributes(variant.attributes).imagePath;
          if (!photo) continue;
          const title = titleByProduct.get(variant.product_id) ?? "";
          if (!byTitle.has(title)) byTitle.set(title, photo);
        }
        return [config.id, [...byTitle.entries()].sort((left, right) => left[0].localeCompare(right[0])).map((entry) => entry[1])];
      }),
    );

    // Foto paket = foto barang pada config fakultas paket itu sendiri, bukan seluruh 8 config.
    const showcase = ownConfigs.find((config) => config.faculty_id === product.faculty_id) ?? ownConfigs[0];
    const componentPhotos = photosByConfig.get(showcase.id) ?? [];
    const optionsWithPhotos = options.map((option, index) => ({ ...option, photos: photosByConfig.get(ownConfigs[index].id) ?? [] }));
    // Foto resmi paket jadi foto pertama, lalu barang penyusunnya.
    const photos = product.image_path ? [product.image_path, ...componentPhotos.filter((photo) => photo !== product.image_path)] : componentPhotos;

    items.push({
      id: product.id,
      kind: "bundle",
      title: product.title,
      description: product.description,
      // Paket tanpa foto sendiri meminjam foto barang pertamanya, supaya kartu tidak kosong.
      imagePath: product.image_path ?? componentPhotos[0] ?? null,
      basePriceRp: Math.min(...options.map((option) => option.priceRp)),
      discountBasisPoints: 0,
      finalPriceRp: Math.min(...options.map((option) => option.priceRp)),
      priceRp: Math.min(...options.map((option) => option.priceRp)),
      stock: Math.max(...options.map((option) => option.stock)),
      variants: [],
      facultyId: product.faculty_id,
      facultyOptions: optionsWithPhotos,
      componentPhotos: photos,
      componentTitles: [
        ...new Set(
          parts
            .map((part) => titleByProduct.get(byId.get(part.variant_id)?.product_id ?? "") ?? "")
            .filter(Boolean),
        ),
      ],
    });
  }

  const { results: faculties } = await ctx.env.DB.prepare("SELECT id, name FROM faculties WHERE active = 1 ORDER BY name").all<{
    id: string;
    name: string;
  }>();
  const { results: aliases } = await ctx.env.DB.prepare("SELECT alias, faculty_id FROM faculty_aliases").all<{
    alias: string;
    faculty_id: string;
  }>();

  return json({
    faculties: faculties.map((faculty) => ({
      id: faculty.id,
      name: faculty.name,
      aliases: aliases.filter((alias) => alias.faculty_id === faculty.id).map((alias) => alias.alias),
    })),
    packages: items.filter((item) => item.kind === "bundle"),
    products: items.filter((item) => item.kind === "single"),
  });
}

export async function productDetail(ctx: Ctx, id: string): Promise<Response> {
  const response = await catalog(ctx);
  const body = (await response.json()) as { packages: CatalogProduct[]; products: CatalogProduct[] };
  const product = [...body.packages, ...body.products].find((item) => item.id === id);
  return product ? json({ product }) : fail("not_found");
}

/** Quote paket per fakultas. Fakultas tanpa konfigurasi publish tidak bisa dibeli. */
export async function packageQuote(ctx: Ctx, productId: string, facultyId: string | null): Promise<Response> {
  if (!facultyId) return fail("faculty_required");
  await releaseExpired(ctx);
  const product = await ctx.env.DB.prepare(
    "SELECT id, title, description, image_path, active FROM products WHERE id = ? AND kind = 'bundle'",
  )
    .bind(productId)
    .first<{ id: string; title: string; description: string; image_path: string | null; active: number }>();
  if (!product || product.active !== 1) return fail("not_found");

  const config = await ctx.env.DB.prepare(
    `SELECT c.id, c.price_rp, c.published, f.id AS faculty_id, f.name AS faculty_name
     FROM bundle_configs c JOIN faculties f ON f.id = c.faculty_id
     WHERE c.bundle_product_id = ? AND c.faculty_id = ?`,
  )
    .bind(productId, facultyId)
    .first<{ id: string; price_rp: number; published: number; faculty_id: string; faculty_name: string }>();
  if (!config || config.published !== 1) return fail("package_unavailable");

  const { results: components } = await ctx.env.DB.prepare(
    `SELECT cc.variant_id, cc.quantity, v.sku, v.attributes, v.price_rp, v.stock_on_hand, v.stock_reserved, v.active, v.sellable,
            p.title
     FROM bundle_config_components cc
     JOIN variants v ON v.id = cc.variant_id
     JOIN products p ON p.id = v.product_id
     WHERE cc.config_id = ?`,
  )
    .bind(config.id)
    .all<{
      variant_id: string;
      quantity: number;
      sku: string;
      attributes: string;
      price_rp: number;
      stock_on_hand: number;
      stock_reserved: number;
      active: number;
      sellable: number;
      title: string;
    }>();
  if (components.length === 0 || components.some((component) => component.active !== 1 || component.sellable !== 1))
    return fail("package_unavailable");

  const payload: QuoteComponent[] = components.map((component) => {
    const parsed = parseAttributes(component.attributes);
    return {
      variantId: component.variant_id,
      sku: component.sku,
      title: component.title,
      attributes: parsed.attributes,
      imagePath: parsed.imagePath,
      quantity: component.quantity,
      unitPriceRp: component.price_rp,
      lineTotalRp: component.price_rp * component.quantity,
      stock: Math.floor(available(component as unknown as VariantRow) / component.quantity),
    };
  });
  const stock = Math.min(...payload.map((component) => component.stock));
  const unitTotalRp = payload.reduce((total, component) => total + component.lineTotalRp, 0);

  return json({
    package: { id: product.id, title: product.title, description: product.description, imagePath: product.image_path },
    faculty: { id: config.faculty_id, name: config.faculty_name },
    components: payload,
    priceRp: config.price_rp,
    unitTotalRp,
    savingsRp: Math.max(0, unitTotalRp - config.price_rp),
    stock,
    available: stock > 0,
  });
}
