import { describe, expect, test } from "vitest";
import { normalizePhone } from "../../worker/domain/phone";
import { validateCheckout } from "../../worker/domain/checkout";

describe("normalizePhone", () => {
  test.each([
    ["081234567890", "+6281234567890"],
    ["0812-3456-7890", "+6281234567890"],
    ["+62 812 3456 7890", "+6281234567890"],
    ["6281234567890", "+6281234567890"],
    ["  0812 3456 7890 ", "+6281234567890"],
  ])("menormalkan %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  test.each(["", "12345", "0812abc", "021-123456", "+62812345678901234"])("menolak %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

const base = {
  buyerName: "Siti Rahma",
  recipientName: "Siti Rahma",
  contactPhone: "081234567890",
  items: [{ productId: "p-a", variantId: "v-a", quantity: 1 }],
  idempotencyKey: "checkout-key-0001",
};

describe("validateCheckout", () => {
  test("menerima payload wajar dan menormalkan telepon", () => {
    const result = validateCheckout(base);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.contactPhone).toBe("+6281234567890");
  });

  test("menolak nama kosong atau terlalu panjang", () => {
    expect(validateCheckout({ ...base, buyerName: "  " })).toMatchObject({ ok: false, code: "invalid_name", field: "buyerName" });
    expect(validateCheckout({ ...base, recipientName: "x".repeat(81) })).toMatchObject({
      ok: false,
      code: "invalid_name",
      field: "recipientName",
    });
  });

  test("menolak telepon tidak valid", () => {
    expect(validateCheckout({ ...base, contactPhone: "12345" })).toMatchObject({
      ok: false,
      code: "invalid_phone",
      field: "contactPhone",
    });
  });

  test("menolak keranjang kosong dan jumlah di luar batas", () => {
    expect(validateCheckout({ ...base, items: [] })).toMatchObject({ ok: false, code: "empty_cart" });
    expect(validateCheckout({ ...base, items: [{ ...base.items[0], quantity: 0 }] })).toMatchObject({
      ok: false,
      code: "invalid_quantity",
    });
    expect(validateCheckout({ ...base, items: [{ ...base.items[0], quantity: 100 }] })).toMatchObject({
      ok: false,
      code: "invalid_quantity",
    });
  });

  test("menolak item duplikat dan keranjang lebih dari 20 baris", () => {
    expect(validateCheckout({ ...base, items: [base.items[0], base.items[0]] })).toMatchObject({ ok: false, code: "duplicate_item" });
    const many = Array.from({ length: 21 }, (_, i) => ({ productId: `p-${i}`, variantId: `v-${i}`, quantity: 1 }));
    expect(validateCheckout({ ...base, items: many })).toMatchObject({ ok: false, code: "too_many_items" });
  });

  test("menolak idempotency key yang tidak wajar", () => {
    expect(validateCheckout({ ...base, idempotencyKey: "short" })).toMatchObject({ ok: false, code: "invalid_key" });
    expect(validateCheckout({ ...base, idempotencyKey: "x".repeat(16) })).toMatchObject({ ok: true });
  });
});
