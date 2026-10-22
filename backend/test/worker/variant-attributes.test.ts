import { describe, expect, test } from "vitest";
import { parseAttributes } from "../../src/variant-attributes";

describe("parseAttributes", () => {
  test("memisahkan foto dari atribut publik", () => {
    const parsed = parseAttributes('{"fakultas":"FEB","foto":"/products/topi-feb.jpg"}');
    expect(parsed.attributes).toEqual({ fakultas: "FEB" });
    expect(parsed.imagePath).toBe("/products/topi-feb.jpg");
  });

  test("tanpa foto tetap mengembalikan atribut", () => {
    expect(parseAttributes('{"ukuran":"M"}')).toEqual({ attributes: { ukuran: "M" }, imagePath: null });
  });

  test("json rusak tidak melempar error", () => {
    expect(parseAttributes("bukan json")).toEqual({ attributes: {}, imagePath: null });
  });
});
