import { type Ctx, type SessionRow, errorName, fail, json, readJsonLimited } from "./http";
import { loadOrder } from "./orders";

type ReviewRow = {
  id: string;
  order_id: string | null;
  display_name: string;
  rating: number;
  comment: string;
  is_example: number;
  created_at: number;
};

function publicReview(row: ReviewRow) {
  return {
    displayName: row.display_name,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    isExample: row.is_example === 1,
  };
}

export async function listReviews(ctx: Ctx): Promise<Response> {
  const { results } = await ctx.env.DB.prepare(
    `SELECT id, order_id, display_name, rating, comment, is_example, created_at
     FROM reviews ORDER BY created_at DESC, id DESC LIMIT 6`,
  ).all<ReviewRow>();
  return json({ reviews: results.map(publicReview) });
}

export async function createReview(ctx: Ctx, session: SessionRow, orderId: string): Promise<Response> {
  if (!session.user_id) return fail("session_required");
  const body = await readJsonLimited(ctx.request);
  if (!body) return fail("invalid_payload");
  if (Object.keys(body).some((key) => !["rating", "comment"].includes(key))) {
    return fail("invalid_payload");
  }
  const rating = body.rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return fail("invalid_payload", { field: "rating" });
  }
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (comment.length < 10 || comment.length > 1000) {
    return fail("invalid_payload", { field: "comment" });
  }

  const order = await loadOrder(ctx, orderId);
  if (!order || order.user_id !== session.user_id) return fail("not_found");
  const existing = await ctx.env.DB.prepare(
    "SELECT id, order_id, display_name, rating, comment, is_example, created_at FROM reviews WHERE order_id = ?",
  )
    .bind(orderId)
    .first<ReviewRow>();
  if (existing) return json({ review: publicReview(existing) }, 200);

  if (order.payment_status !== "PAID" || order.fulfillment_status !== "PICKED_UP") {
    return fail("review_not_allowed");
  }

  const displayName = order.buyer_name.trim().split(/\s+/)[0]?.slice(0, 80) ?? "Pembeli";
  try {
    await ctx.env.DB.prepare(
      `INSERT INTO reviews (id, order_id, session_id, user_id, display_name, rating, comment, is_example, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
      .bind(crypto.randomUUID(), orderId, session.id, session.user_id, displayName, rating, comment, ctx.now)
      .run();
  } catch (error) {
    const code = errorName(error);
    if (code === "conflict") {
      const raced = await ctx.env.DB.prepare(
        "SELECT id, order_id, display_name, rating, comment, is_example, created_at FROM reviews WHERE order_id = ?",
      )
        .bind(orderId)
        .first<ReviewRow>();
      if (raced) return json({ review: publicReview(raced) }, 200);
    }
    return fail(code);
  }

  return json(
    {
      review: {
        displayName,
        rating,
        comment,
        createdAt: ctx.now,
        isExample: false,
      },
    },
    201,
  );
}
