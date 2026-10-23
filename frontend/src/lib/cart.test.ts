import { beforeEach, describe, expect, test } from "vitest";
import { addToCart, cartLines, lineKey, replaceLine, type CartLine } from "./cart";

const febLine: CartLine = {
  productId: "p-paket",
  variantId: null,
  facultyId: "fac-feb",
  facultyName: "Fakultas Ekonomi dan Bisnis",
  title: "Paket Hemat",
  variantLabel: "Fakultas Ekonomi dan Bisnis",
  priceRp: 50000,
  quantity: 2,
};

const ftLine: CartLine = { ...febLine, facultyId: "fac-ft", facultyName: "Fakultas Teknik", variantLabel: "Fakultas Teknik", quantity: 1 };

beforeEach(() => {
  localStorage.clear();
});

describe("replaceLine", () => {
  test("mengganti baris lama dengan baris baru tanpa meninggalkan sisa baris lama", () => {
    addToCart(febLine);
    replaceLine(lineKey(febLine), ftLine);
    expect(cartLines()).toEqual([ftLine]);
  });

  test("menggabungkan kuantitas bila baris baru berbenturan dengan baris lain yang sudah ada", () => {
    addToCart(febLine);
    addToCart(ftLine);
    replaceLine(lineKey(febLine), { ...febLine, facultyId: "fac-ft", facultyName: "Fakultas Teknik", variantLabel: "Fakultas Teknik", quantity: 1 });
    const lines = cartLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({ ...ftLine, quantity: 2 });
  });
});
