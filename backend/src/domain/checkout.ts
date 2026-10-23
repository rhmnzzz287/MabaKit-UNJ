import { normalizeEmail } from "./email";
import { normalizePhone } from "./phone";

export type CheckoutInput = {
  buyerName: string;
  contactPhone: string;
  email: string;
  departmentId: string | null;
  items: { productId: string; variantId: string | null; facultyId: string | null; quantity: number }[];
  idempotencyKey: string;
};

export type CheckoutFailure = {
  ok: false;
  code:
    | "invalid_name"
    | "invalid_phone"
    | "invalid_email"
    | "invalid_payload"
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

  const allowed = new Set(["buyerName", "contactPhone", "email", "departmentId", "method", "idempotencyKey", "items"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) return { ok: false, code: "invalid_payload" };

  const buyerName = name(input.buyerName);
  if (!buyerName) return { ok: false, code: "invalid_name", field: "buyerName" };

  const contactPhone = typeof input.contactPhone === "string" ? normalizePhone(input.contactPhone) : null;
  if (!contactPhone) return { ok: false, code: "invalid_phone", field: "contactPhone" };

  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, code: "invalid_email", field: "email" };

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
    if (Object.keys(item).some((key) => !["productId", "variantId", "facultyId", "quantity"].includes(key))) {
      return { ok: false, code: "invalid_item" };
    }
    const productId = typeof item.productId === "string" ? item.productId : "";
    const variantId = item.variantId === null || item.variantId === undefined ? null : String(item.variantId);
    const facultyId = item.facultyId === null || item.facultyId === undefined ? null : String(item.facultyId);
    if (facultyId !== null && (facultyId.length < 1 || facultyId.length > 64)) return { ok: false, code: "invalid_item" };
    const quantity = item.quantity;
    if (!productId || productId.length > 64) return { ok: false, code: "invalid_item" };
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return { ok: false, code: "invalid_quantity", field: "quantity" };
    }
    const dedupe = `${productId}::${variantId ?? ""}::${facultyId ?? ""}`;
    if (seen.has(dedupe)) return { ok: false, code: "duplicate_item" };
    seen.add(dedupe);
    items.push({ productId, variantId, facultyId, quantity });
  }

  const departmentId =
    input.departmentId === null || input.departmentId === undefined
      ? null
      : typeof input.departmentId === "string" && input.departmentId.length <= 64
        ? input.departmentId
        : null;

  return { ok: true, value: { buyerName, contactPhone, email, departmentId, items, idempotencyKey: key } };
}
