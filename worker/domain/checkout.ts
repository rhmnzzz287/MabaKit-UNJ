import { normalizePhone } from "./phone";

export type CheckoutInput = {
  buyerName: string;
  recipientName: string;
  contactPhone: string;
  departmentId: string | null;
  items: { productId: string; variantId: string | null; quantity: number }[];
  idempotencyKey: string;
};

export type CheckoutFailure = {
  ok: false;
  code:
    | "invalid_name"
    | "invalid_phone"
    | "empty_cart"
    | "too_many_items"
    | "invalid_quantity"
    | "duplicate_item"
    | "invalid_item"
    | "invalid_key";
  field?: string;
};

export type CheckoutResult = { ok: true; value: CheckoutInput } | CheckoutFailure;

const MAX_NAME = 80;
const MAX_ITEMS = 20;
const MAX_QUANTITY = 99;
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

function name(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length >= 1 && trimmed.length <= MAX_NAME ? trimmed : null;
}

export function validateCheckout(body: unknown): CheckoutResult {
  if (!body || typeof body !== "object") return { ok: false, code: "invalid_item" };
  const input = body as Record<string, unknown>;

  const buyerName = name(input.buyerName);
  if (!buyerName) return { ok: false, code: "invalid_name", field: "buyerName" };
  const recipientName = name(input.recipientName);
  if (!recipientName) return { ok: false, code: "invalid_name", field: "recipientName" };

  const contactPhone = typeof input.contactPhone === "string" ? normalizePhone(input.contactPhone) : null;
  if (!contactPhone) return { ok: false, code: "invalid_phone", field: "contactPhone" };

  const key = input.idempotencyKey;
  if (typeof key !== "string" || !KEY_PATTERN.test(key)) return { ok: false, code: "invalid_key" };

  const rawItems = input.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) return { ok: false, code: "empty_cart" };
  if (rawItems.length > MAX_ITEMS) return { ok: false, code: "too_many_items" };

  const items: CheckoutInput["items"] = [];
  const seen = new Set<string>();
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") return { ok: false, code: "invalid_item" };
    const item = raw as Record<string, unknown>;
    const productId = typeof item.productId === "string" ? item.productId : "";
    const variantId = item.variantId === null || item.variantId === undefined ? null : String(item.variantId);
    const quantity = item.quantity;
    if (!productId || productId.length > 64) return { ok: false, code: "invalid_item" };
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return { ok: false, code: "invalid_quantity", field: "quantity" };
    }
    const dedupe = `${productId}::${variantId ?? ""}`;
    if (seen.has(dedupe)) return { ok: false, code: "duplicate_item" };
    seen.add(dedupe);
    items.push({ productId, variantId, quantity });
  }

  const departmentId =
    input.departmentId === null || input.departmentId === undefined
      ? null
      : typeof input.departmentId === "string" && input.departmentId.length <= 64
        ? input.departmentId
        : null;

  return { ok: true, value: { buyerName, recipientName, contactPhone, departmentId, items, idempotencyKey: key } };
}
