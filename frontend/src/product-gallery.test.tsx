import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Product as ProductType } from "@/lib/types";
import ProductPage from "@/pages/ProductPage";

const baseProduct: ProductType = {
  id: "p-topi",
  kind: "single",
  title: "Topi PKKMB",
  description: "Topi peserta dengan label fakultas.",
  imagePath: "/products/topi-feb-960.webp",
  photos: [
    { id: "ph-1", url: "/media/products/topi-1.jpg", width: 1200, height: 900 },
    { id: "ph-2", url: "/media/products/topi-2.jpg", width: 800, height: 600 },
    { id: "ph-3", url: "/media/products/topi-3.jpg", width: 1000, height: 1000 },
  ],
  priceRp: 35000,
  stock: 4,
  variants: [
    {
      id: "v-topi-feb",
      sku: "TOPI-FEB",
      attributes: { fakultas: "FEB" },
      imagePath: "/products/topi-feb-960.webp",
      imagePath480: "/products/topi-feb-480.webp",
      priceRp: 35000,
      stock: 4,
      faculties: ["fac-feb"],
    },
  ],
};

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
}

function stubFetch(product: ProductType): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === `/api/catalog/${product.id}`) return json({ product });
      return json({ error: "not_found" });
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/products/p-topi");
});

describe("galeri foto produk", () => {
  test("foto pertama tampil dan tombol galeri bisa dipilih dengan keyboard", async () => {
    stubFetch(baseProduct);
    const user = userEvent.setup();
    render(<ProductPage id="p-topi" />);

    const main = await screen.findByRole("img", { name: /Foto Topi PKKMB/ });
    expect(main).toHaveAttribute("src", "/media/products/topi-1.jpg");
    expect(main).toHaveAttribute("width", "1200");
    expect(main).toHaveAttribute("height", "900");

    const gallery = screen.getByRole("group", { name: "Galeri foto produk" });
    expect(gallery).toBeInTheDocument();
    const first = screen.getByRole("button", { name: "Foto 1 dari 3" });
    const second = screen.getByRole("button", { name: "Foto 2 dari 3" });
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(first).toHaveClass("size-12");
    expect(second).toHaveAttribute("aria-pressed", "false");

    second.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("img", { name: /Foto Topi PKKMB/ })).toHaveAttribute("src", "/media/products/topi-2.jpg");
    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(first).toHaveAttribute("aria-pressed", "false");
  });

  test("memilih varian mengganti foto hero, klik galeri mengembalikannya", async () => {
    stubFetch({
      ...baseProduct,
      variants: [
        baseProduct.variants[0],
        {
          id: "v-topi-fip",
          sku: "TOPI-FIP",
          attributes: { fakultas: "FIP" },
          imagePath: "/products/topi-fip-960.webp",
          imagePath480: "/products/topi-fip-480.webp",
          priceRp: 35000,
          stock: 2,
          faculties: ["fac-fip"],
        },
      ],
    });
    const user = userEvent.setup();
    render(<ProductPage id="p-topi" />);

    // Default menampilkan foto galeri admin, bukan foto varian pertama.
    expect(await screen.findByRole("img", { name: /Foto Topi PKKMB/ })).toHaveAttribute(
      "src",
      "/media/products/topi-1.jpg",
    );

    await user.selectOptions(screen.getByLabelText("Pilih varian"), "v-topi-fip");
    expect(screen.getByRole("img", { name: /Foto Topi PKKMB/ })).toHaveAttribute(
      "src",
      "/products/topi-fip-960.webp",
    );

    await user.click(screen.getByRole("button", { name: "Foto 2 dari 3" }));
    expect(screen.getByRole("img", { name: /Foto Topi PKKMB/ })).toHaveAttribute(
      "src",
      "/media/products/topi-2.jpg",
    );
  });

  test("tanpa foto galeri memakai gambar varian sebagai cadangan", async () => {
    stubFetch({ ...baseProduct, photos: [] });
    render(<ProductPage id="p-topi" />);

    const main = await screen.findByRole("img", { name: /Foto Topi PKKMB/ });
    expect(main).toHaveAttribute("src", "/products/topi-feb-960.webp");
    expect(screen.queryByRole("group", { name: "Galeri foto produk" })).not.toBeInTheDocument();
  });
});
