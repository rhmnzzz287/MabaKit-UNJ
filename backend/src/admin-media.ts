import { type Ctx, type OperatorRow, audit, errorName, fail, json, readBytesLimited, readJsonLimited } from "./http";
import { imageInfo } from "./domain/image";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

type PhotoRow = {
  id: string;
  product_id: string;
  object_key: string;
  content_type: string;
  bytes: number;
  width: number;
  height: number;
  position: number;
};

function photo(row: PhotoRow) {
  return {
    id: row.id,
    url: `/media/${row.object_key}`,
    contentType: row.content_type,
    bytes: row.bytes,
    width: row.width,
    height: row.height,
    position: row.position,
  };
}

async function productExists(ctx: Ctx, id: string): Promise<boolean> {
  return Boolean(await ctx.env.DB.prepare("SELECT id FROM products WHERE id = ?").bind(id).first());
}

export async function adminPhotos(ctx: Ctx, id: string): Promise<Response> {
  if (!(await productExists(ctx, id))) return fail("not_found");
  const { results } = await ctx.env.DB.prepare(
    "SELECT id, product_id, object_key, content_type, bytes, width, height, position FROM product_photos WHERE product_id = ? ORDER BY position, id",
  )
    .bind(id)
    .all<PhotoRow>();
  return json({ photos: results.map(photo) });
}

export async function adminUploadPhoto(ctx: Ctx, operator: OperatorRow, productId: string): Promise<Response> {
  if (!(await productExists(ctx, productId))) return fail("not_found");
  if (!ctx.env.MEDIA) return fail("checkout_disabled");
  const type = (ctx.request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!TYPES.has(type)) return fail("invalid_payload", { field: "file" });
  const bytes = await readBytesLimited(ctx.request, MAX_BYTES);
  if (!bytes || bytes.length === 0) return fail("invalid_payload", { field: "file" });
  const info = imageInfo(bytes, type);
  if (!info || info.width < 1 || info.height < 1 || info.width * info.height > MAX_PIXELS) {
    return fail("invalid_payload", { field: "file" });
  }

  const id = `ph-${crypto.randomUUID().slice(0, 8)}`;
  const key = `products/${productId}/${id}.${EXT[type]}`;
  try {
    // Posisi diisi slot kosong terkecil supaya penghapusan di tengah tidak menabrak CHECK 0..4.
    const { results: taken } = await ctx.env.DB.prepare("SELECT position FROM product_photos WHERE product_id = ?")
      .bind(productId)
      .all<{ position: number }>();
    const used = new Set(taken.map((row) => row.position));
    let position = 0;
    while (used.has(position) && position < 5) position += 1;
    if (position > 4) return fail("photo_limit");

    await ctx.env.MEDIA.put(key, bytes, { httpMetadata: { contentType: type } });
    await ctx.env.DB.prepare(
      `INSERT INTO product_photos (id, product_id, object_key, content_type, bytes, width, height, position, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE (SELECT COUNT(*) FROM product_photos WHERE product_id = ?) < 5`,
    )
      .bind(id, productId, key, type, bytes.length, info.width, info.height, position, ctx.now, productId)
      .run();
    const saved = await ctx.env.DB.prepare("SELECT id FROM product_photos WHERE id = ?").bind(id).first();
    if (!saved) {
      await ctx.env.MEDIA.delete(key);
      return fail("photo_limit");
    }
    // Sampul selalu mengikuti foto pertama pada urutan galeri, bukan foto yang baru diunggah.
    const cover = await ctx.env.DB.prepare(
      "SELECT object_key FROM product_photos WHERE product_id = ? ORDER BY position, id LIMIT 1",
    )
      .bind(productId)
      .first<{ object_key: string }>();
    if (cover) {
      await ctx.env.DB.prepare("UPDATE products SET image_path = ?, updated_at = ? WHERE id = ?")
        .bind(`/media/${cover.object_key}`, ctx.now, productId)
        .run();
    }
    await audit(ctx, { actorId: operator.id, action: "photo_uploaded", entityType: "product", entityId: productId, metadata: { photoId: id } });
    return json({ photo: { id, url: `/media/${key}`, contentType: type, bytes: bytes.length, width: info.width, height: info.height, position } }, 201);
  } catch (error) {
    await ctx.env.MEDIA.delete(key);
    return fail(errorName(error));
  }
}

export async function adminDeletePhoto(ctx: Ctx, operator: OperatorRow, productId: string, photoId: string): Promise<Response> {
  const row = await ctx.env.DB.prepare("SELECT object_key FROM product_photos WHERE id = ? AND product_id = ?")
    .bind(photoId, productId)
    .first<{ object_key: string }>();
  if (!row) return fail("not_found");
  await ctx.env.DB.prepare("DELETE FROM product_photos WHERE id = ? AND product_id = ?").bind(photoId, productId).run();
  await ctx.env.MEDIA?.delete(row.object_key).catch(() => undefined);
  const cover = await ctx.env.DB.prepare(
    "SELECT object_key FROM product_photos WHERE product_id = ? ORDER BY position, id LIMIT 1",
  )
    .bind(productId)
    .first<{ object_key: string }>();
  await ctx.env.DB.prepare("UPDATE products SET image_path = ?, updated_at = ? WHERE id = ? AND image_path LIKE '/media/%'")
    .bind(cover ? `/media/${cover.object_key}` : null, ctx.now, productId)
    .run();
  await audit(ctx, { actorId: operator.id, action: "photo_deleted", entityType: "product", entityId: productId, metadata: { photoId } });
  return json({ deleted: true });
}

export async function adminReorderPhotos(ctx: Ctx, operator: OperatorRow, productId: string): Promise<Response> {
  const body = await readJsonLimited(ctx.request);
  if (!body || !Array.isArray(body.ids) || body.ids.length > 5 || body.ids.some((id) => typeof id !== "string")) {
    return fail("invalid_payload");
  }
  const ids = body.ids as string[];
  if (ids.length === 0) return fail("invalid_payload");
  const { results } = await ctx.env.DB.prepare("SELECT id FROM product_photos WHERE product_id = ?")
    .bind(productId)
    .all<{ id: string }>();
  if (ids.length !== results.length || new Set(ids).size !== ids.length || results.some((row) => !ids.includes(row.id))) {
    return fail("invalid_payload");
  }
  const statements = ids.map((id, index) =>
    ctx.env.DB.prepare("UPDATE product_photos SET position = ? WHERE id = ? AND product_id = ?").bind(index, id, productId),
  );
  const cover = await ctx.env.DB.prepare("SELECT object_key FROM product_photos WHERE id = ?").bind(ids[0]).first<{ object_key: string }>();
  if (cover) {
    statements.push(
      ctx.env.DB.prepare("UPDATE products SET image_path = ?, updated_at = ? WHERE id = ?").bind(`/media/${cover.object_key}`, ctx.now, productId),
    );
  }
  await ctx.env.DB.batch(statements);
  await audit(ctx, { actorId: operator.id, action: "photos_reordered", entityType: "product", entityId: productId, metadata: { count: ids.length } });
  return adminPhotos(ctx, productId);
}

export async function mediaObject(ctx: Ctx, key: string): Promise<Response> {
  if (!ctx.env.MEDIA || !key.startsWith("products/") || key.includes("..")) return new Response("Not found", { status: 404 });
  const object = await ctx.env.MEDIA.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      etag: object.httpEtag,
    },
  });
}
