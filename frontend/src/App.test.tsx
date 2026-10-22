import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import App from "@/App";
import type { Order } from "@/lib/types";

const product = {
  id: "p-a",
  kind: "single" as const,
  title: "Kaos PKKMB",
  description: "Kaos katun untuk peserta.",
  imagePath: null,
  priceRp: 15000,
  stock: 2,
  variants: [{ id: "v-a", sku: "KAOS-01", attributes: { ukuran: "M" }, priceRp: 15000, stock: 2 }],
};

const NOW = Date.now();

const pendingOrder: Order = {
  id: "o-1",
  orderNumber: "MBK-261022-ABCD",
  buyerName: "Siti",
  recipientName: "Siti",
  contactPhone: "+6281234567890",
  departmentId: null,
  totalRp: 15000,
  paymentStatus: "PENDING",
  fulfillmentStatus: "UNFULFILLED",
  method: "QRIS",
  createdAt: NOW - 60_000,
  expiresAt: NOW + 600_000,
  paidAt: null,
  readyAt: null,
  pickedUpAt: null,
  pickup: { label: "Kampus A Rawamangun", details: "Lobi gedung B", hours: "09.00-15.00", version: 1 },
  items: [{ id: "i-1", title: "Kaos PKKMB", attributes: { ukuran: "M" }, quantity: 1, unitPriceRp: 15000, lineTotalRp: 15000 }],
  invoice: null,
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function mockApi() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    if (url === "/api/catalog") return json({ products: [product] });
    if (url === "/api/demo/session" && method === "POST") return json({ csrfToken: "csrf" }, 201);
    if (url === "/api/checkout/create" && method === "POST") return json({ order: pendingOrder }, 201);
    if (url === "/api/orders/o-1" && method === "GET") return json({ order: pendingOrder });
    if (url === "/api/demo/orders/o-1/check-payment" && method === "POST") {
      return json({
        order: {
          ...pendingOrder,
          paymentStatus: "PAID",
          paidAt: NOW,
          invoice: { invoiceNumber: "INV-MBK-261022-ABCD", issuedAt: NOW },
        },
      });
    }
    return json({ error: "not_found", message: "Tidak ada" }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  localStorage.clear();
  document.cookie = "mbk_csrf=csrf; path=/";
  window.history.replaceState({}, "", "/");
  mockApi();
});

describe("alur belanja demo", () => {
  test("katalog menampilkan produk dan harga dari API", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Kaos PKKMB" })).toBeInTheDocument();
    expect(screen.getByText(/Rp\s?15\.000/)).toBeInTheDocument();
  });

  test("checkout mengirim item keranjang dan membuka halaman pembayaran", async () => {
    window.history.replaceState({}, "", "/checkout");
    localStorage.setItem(
      "mabakit.cart.v1",
      JSON.stringify([
        { productId: "p-a", variantId: "v-a", title: "Kaos PKKMB", variantLabel: "ukuran: M", priceRp: 15000, quantity: 1 },
      ]),
    );
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Nama pemesan"), "Siti");
    await user.type(screen.getByLabelText("Nama penerima"), "Siti");
    await user.type(screen.getByLabelText("Nomor WhatsApp"), "081234567890");
    await user.click(screen.getByRole("button", { name: "Lanjut ke pembayaran simulasi" }));

    expect(await screen.findByRole("heading", { name: /Pembayaran MBK-261022-ABCD/ })).toBeInTheDocument();
    const [url, init] = (vi.mocked(fetch).mock.calls.find(([input]) => String(input) === "/api/checkout/create") ?? []) as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/checkout/create");
    expect(init.headers).toBeInstanceOf(Headers);
    expect((init.headers as Headers).get("x-csrf")).toBe("csrf");
    expect(JSON.parse(String(init.body))).toMatchObject({
      buyerName: "Siti",
      contactPhone: "081234567890",
      method: "BANK_TRANSFER",
      items: [{ productId: "p-a", variantId: "v-a", quantity: 1 }],
    });
    expect(localStorage.getItem("mabakit.cart.v1")).toBe("[]");
  });

  test("cek status pembayaran menampilkan tautan invoice dan status PAID", async () => {
    window.history.replaceState({}, "", "/orders/o-1/payment");
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Cek status pembayaran" }));

    expect(await screen.findByRole("link", { name: "Lihat invoice" })).toBeInTheDocument();
    expect(screen.getByText(/Pesanan simulasi berhasil dibuat/)).toBeInTheDocument();
    expect(screen.getByText("Sudah dibayar (simulasi)")).toBeInTheDocument();
  });

  test("retry checkout memakai idempotency key sama sampai data berubah", async () => {
    window.history.replaceState({}, "", "/checkout");
    localStorage.setItem(
      "mabakit.cart.v1",
      JSON.stringify([
        { productId: "p-a", variantId: "v-a", title: "Kaos PKKMB", variantLabel: "ukuran: M", priceRp: 15000, quantity: 1 },
      ]),
    );
    const keys: string[] = [];
    let attempt = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/checkout/create") {
          keys.push((JSON.parse(String(init?.body)) as { idempotencyKey: string }).idempotencyKey);
          attempt += 1;
          if (attempt <= 2) return json({ error: "internal", message: "Gagal sementara." }, 500);
          return json({ order: pendingOrder }, 201);
        }
        if (url === "/api/catalog") return json({ products: [product] });
        if (url === "/api/orders/o-1") return json({ order: pendingOrder });
        return json({}, 404);
      }),
    );
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Nama pemesan"), "Siti");
    await user.type(screen.getByLabelText("Nama penerima"), "Siti");
    await user.type(screen.getByLabelText("Nomor WhatsApp"), "081234567890");
    const submit = screen.getByRole("button", { name: "Lanjut ke pembayaran simulasi" });

    await user.click(submit);
    expect(await screen.findByText("Gagal sementara.")).toBeInTheDocument();
    await user.click(submit);
    await user.click(submit);

    expect(await screen.findByRole("heading", { name: /Pembayaran MBK-261022-ABCD/ })).toBeInTheDocument();
    expect(keys).toHaveLength(3);
    expect(keys[0]).toBe(keys[1]);
  });

  test("retry checkout setelah data berubah memakai key baru", async () => {
    window.history.replaceState({}, "", "/checkout");
    localStorage.setItem(
      "mabakit.cart.v1",
      JSON.stringify([
        { productId: "p-a", variantId: "v-a", title: "Kaos PKKMB", variantLabel: "ukuran: M", priceRp: 15000, quantity: 1 },
      ]),
    );
    const keys: string[] = [];
    let attempt = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/checkout/create") {
          keys.push((JSON.parse(String(init?.body)) as { idempotencyKey: string }).idempotencyKey);
          attempt += 1;
          if (attempt === 1) return json({ error: "internal", message: "Gagal sementara." }, 500);
          return json({ order: pendingOrder }, 201);
        }
        if (url === "/api/catalog") return json({ products: [product] });
        if (url === "/api/orders/o-1") return json({ order: pendingOrder });
        return json({}, 404);
      }),
    );
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Nama pemesan"), "Siti");
    await user.type(screen.getByLabelText("Nama penerima"), "Siti");
    await user.type(screen.getByLabelText("Nomor WhatsApp"), "081234567890");
    await user.click(screen.getByRole("button", { name: "Lanjut ke pembayaran simulasi" }));
    expect(await screen.findByText("Gagal sementara.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Nama pemesan"));
    await user.type(screen.getByLabelText("Nama pemesan"), "Budi");
    await user.click(screen.getByRole("button", { name: "Lanjut ke pembayaran simulasi" }));

    await screen.findByRole("heading", { name: /Pembayaran MBK-261022-ABCD/ });
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  test("keranjang kosong menawarkan kembali ke katalog", async () => {
    window.history.replaceState({}, "", "/cart");
    render(<App />);
    expect(await screen.findByText("Keranjang masih kosong.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("link", { name: "Lihat katalog" })).toHaveAttribute("href", "/"));
  });
});
