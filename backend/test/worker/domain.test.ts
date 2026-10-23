import { describe, expect, test } from "vitest";
import { normalizeEmail } from "../../src/domain/email";
import { normalizePhone } from "../../src/domain/phone";
import { validateCheckout } from "../../src/domain/checkout";

describe("normalizeEmail", () => {
  test.each([
    ["Siti@Example.Test", "siti@example.test"],
    ["  buyer@mabakit.demo  ", "buyer@mabakit.demo"],
    ["a.b+tag@sub.domain.id", "a.b+tag@sub.domain.id"],
  ])("menormalkan %s", (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });

  test.each(["", "bukan-email", "a@b", "a@b.c", "a b@example.test", "@example.test", null, 42])(
    "menolak %s",
    (input) => {
      expect(normalizeEmail(input)).toBeNull();
    },
  );
});

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
  contactPhone: "081234567890",
  email: "siti@example.test",
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
    expect(validateCheckout({ ...base, buyerName: "x".repeat(81) })).toMatchObject({
      ok: false,
      code: "invalid_name",
      field: "buyerName",
    });
  });

  test("menolak email tidak valid dan field asing", () => {
    expect(validateCheckout({ ...base, email: "bukan-email" })).toMatchObject({
      ok: false,
      code: "invalid_email",
      field: "email",
    });
    expect(validateCheckout({ ...base, email: undefined })).toMatchObject({ ok: false, code: "invalid_email" });
    expect(validateCheckout({ ...base, recipientName: "Siti" })).toMatchObject({ ok: false, code: "invalid_payload" });
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
    expect(validateCheckout({ ...base, idempotencyKey: "x".repeat(65) })).toMatchObject({ ok: false, code: "invalid_key" });
    expect(validateCheckout({ ...base, idempotencyKey: "kunci idempoten 001" })).toMatchObject({ ok: false, code: "invalid_key" });
  });

  test("menerima facultyId untuk item paket dan mengosongkannya bila tidak diisi", () => {
    const withFaculty = validateCheckout({
      ...base,
      items: [{ productId: "p-paket-hemat", variantId: null, facultyId: "fac-ft", quantity: 1 }],
    });
    expect(withFaculty.ok).toBe(true);
    if (withFaculty.ok) {
      expect(withFaculty.value.items[0]).toEqual({
        productId: "p-paket-hemat",
        variantId: null,
        facultyId: "fac-ft",
        quantity: 1,
      });
    }

    const withoutFaculty = validateCheckout(base);
    expect(withoutFaculty.ok).toBe(true);
    if (withoutFaculty.ok) expect(withoutFaculty.value.items[0]).toMatchObject({ variantId: "v-a", facultyId: null });
  });

  test("menolak facultyId kepanjangan dan field item asing", () => {
    expect(
      validateCheckout({ ...base, items: [{ ...base.items[0], facultyId: "f".repeat(65) }] }),
    ).toMatchObject({ ok: false, code: "invalid_item" });
    expect(
      validateCheckout({ ...base, items: [{ ...base.items[0], recipientName: "Siti" }] }),
    ).toMatchObject({ ok: false, code: "invalid_item" });
    expect(validateCheckout({ ...base, items: [{ ...base.items[0], productId: "" }] })).toMatchObject({
      ok: false,
      code: "invalid_item",
    });
  });

  test("membedakan item yang hanya beda fakultas dan menormalkan nama", () => {
    const twoFaculties = validateCheckout({
      ...base,
      buyerName: "  Siti   Rahma  ",
      items: [
        { productId: "p-paket-hemat", facultyId: "fac-ft", quantity: 1 },
        { productId: "p-paket-hemat", facultyId: "fac-fik", quantity: 1 },
      ],
    });
    expect(twoFaculties.ok).toBe(true);
    if (twoFaculties.ok) {
      expect(twoFaculties.value.buyerName).toBe("Siti Rahma");
      expect(twoFaculties.value.items).toHaveLength(2);
    }

    expect(
      validateCheckout({
        ...base,
        items: [
          { productId: "p-paket-hemat", facultyId: "fac-ft", quantity: 1 },
          { productId: "p-paket-hemat", facultyId: "fac-ft", quantity: 2 },
        ],
      }),
    ).toMatchObject({ ok: false, code: "duplicate_item" });
  });
});
