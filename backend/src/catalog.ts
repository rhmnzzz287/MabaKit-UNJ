import { type Ctx, fail, json, releaseExpired } from "./http";

type ProductRow = {
  id: string;
  kind: "single" | "bundle";
  title: string;
  description: string;
  image_path: string | null;
  bundle_price_rp: number | null;
};
type VariantRow = {
  id: string;
  product_id: string;
  sku: string;
  attributes: string;
  price_rp: number;
  stock_on_hand: number;
  stock_reserved: number;
};

type CatalogVariant = {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  priceRp: number;
  stock: number;
};
type CatalogProduct = {
  id: string;
  kind: "single" | "bundle";
  title: string;
  description: string;
  imagePath: string | null;
  priceRp: number;
  stock: number;
  variants: CatalogVariant[];
  components?: { variantId: string; sku: string; quantity: number }[];
};

function available(variant: VariantRow): number {
  return Math.max(0, variant.stock_on_hand - variant.stock_reserved);
}

function attributes(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function catalog(ctx: Ctx): Promise<Response> {
  await releaseExpired(ctx);
  const { results: products } = await ctx.env.DB.prepare(
    `SELECT id, kind, title, description, image_path, bundle_price_rp FROM products WHERE active = 1 ORDER BY kind DESC, title`,
  ).all<ProductRow>();
  const { results: variants } = await ctx.env.DB.prepare(
    `SELECT id, product_id, sku, attributes, price_rp, stock_on_hand, stock_reserved FROM variants WHERE active = 1`,
  ).all<VariantRow>();
  const { results: components } = await ctx.env.DB.prepare(
    `SELECT bc.bundle_product_id, bc.variant_id, bc.quantity, v.sku
     FROM bundle_components bc JOIN variants v ON v.id = bc.variant_id`,
  ).all<{ bundle_product_id: string; variant_id: string; quantity: number; sku: string }>();

  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  const items: CatalogProduct[] = products.map((product) => {
    const own = variants.filter((variant) => variant.product_id === product.id);
    if (product.kind === "single") {
      return {
        id: product.id,
        kind: "single",
        title: product.title,
        description: product.description,
        imagePath: product.image_path,
        priceRp: own[0]?.price_rp ?? 0,
        stock: own.reduce((total, variant) => total + available(variant), 0),
        variants: own.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          attributes: attributes(variant.attributes),
          priceRp: variant.price_rp,
          stock: available(variant),
        })),
      };
    }
    const parts = components.filter((component) => component.bundle_product_id === product.id);
    const stock = parts.length
      ? Math.min(...parts.map((part) => Math.floor(available(byId.get(part.variant_id) as VariantRow) / part.quantity)))
      : 0;
    return {
      id: product.id,
      kind: "bundle",
      title: product.title,
      description: product.description,
      imagePath: product.image_path,
      priceRp: product.bundle_price_rp ?? 0,
      stock,
      variants: [],
      components: parts.map((part) => ({ variantId: part.variant_id, sku: part.sku, quantity: part.quantity })),
    };
  });

  return json({ products: items });
}

export async function productDetail(ctx: Ctx, id: string): Promise<Response> {
  const response = await catalog(ctx);
  const body = (await response.json()) as { products: CatalogProduct[] };
  const product = body.products.find((item) => item.id === id);
  return product ? json({ product }) : fail("not_found");
}
