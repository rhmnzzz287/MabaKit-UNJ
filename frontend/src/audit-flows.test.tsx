import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import App from "@/App";
import type { CatalogResponse, Order, User } from "@/lib/types";
import { operatorNext, safeNext } from "@/lib/workspace";

const NOW = Date.now();

const staffUser: User = {
  id: "usr-staff",
  email: "tim@demo.mabakit",
  role: "staff",
  name: "Tim MabaKit",
  whatsapp: "081234567890",
  facultyId: null,
  permissions: ["orders.view", "orders.ready", "orders.complete"],
};

const catalog: CatalogResponse = {
  faculties: [
    { id: "fac-feb", name: "Fakultas Ekonomi dan Bisnis", aliases: ["FEB"] },
    { id: "fac-ft", name: "Fakultas Teknik", aliases: ["FT"] },
  ],
  packages: [
    {
      id: "p-paket-hemat",
      kind: "bundle",
      title: "Paket Hemat",
      description: "Topi, kipas, dan kaus kaki.",
      imagePath: null,
      priceRp: 50000,
      stock: 3,
      variants: [],
      facultyOptions: [{ facultyId: "fac-feb", facultyName: "Fakultas Ekonomi dan Bisnis", priceRp: 50000, stock: 3 }],
    },
  ],
  products: [],
};

const catalogWithoutFaculty: CatalogResponse = {
  ...catalog,
  packages: [
    {
      id: "p-paket-kosong",
      kind: "bundle",
      title: "Paket Kosong",
      description: "Belum ada komponen fakultas.",
      imagePath: null,
      priceRp: 0,
      stock: 0,
      variants: [],
      facultyOptions: [],
    },
  ],
};

const paidOrder: Order = {
  id: "o-1",
  orderNumber: "MBK-261022-ABCD",
  buyerName: "Siti",
  contactPhone: "081234567890",
  email: null,
  facultyId: null,
  totalRp: 50000,
  paymentStatus: "PAID",
  fulfillmentStatus: "UNFULFILLED",
  method: "QRIS",
  createdAt: NOW - 60_000,
  expiresAt: NOW + 600_000,
  paidAt: NOW,
  readyAt: null,
  pickedUpAt: null,
  pickup: { label: "Kampus A", details: "Lobi gedung B", hours: "09.00-15.00", version: 1 },
  items: [],
  invoice: null,
  review: null,
  reviewEligible: false,
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response | null = () => null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const custom = handler(url, init);
      if (custom) return custom;
      if (url === "/api/catalog") return json(catalog);
      if (url === "/api/demo/session" && (init?.method ?? "GET") === "POST") return json({ csrfToken: "csrf" }, 201);
      if (url === "/api/auth/session") return json({ session: null, user: null, role: "buyer" });
      if (url === "/api/auth/session?portal=operator") return json({ session: null, user: null, role: null, portal: "operator" });
      return json({ error: "not_found", message: "Tidak ada" }, 404);
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  document.cookie = "mbk_csrf=csrf; path=/";
  document.cookie = "mbk_op_csrf=csrf; path=/";
  window.history.replaceState({}, "", "/");
  mockFetch();
});

describe("F03 tujuan operator per-role", () => {
  test("staf default ke /team/orders dan tujuan /admin ditolak", () => {
    expect(operatorNext(null, "staff")).toBe("/team/orders");
    expect(operatorNext("/admin", "staff")).toBe("/team/orders");
    expect(operatorNext("/admin/akses", "staff")).toBe("/team/orders");
    expect(operatorNext("/team/orders", "staff")).toBe("/team/orders");
  });

  test("admin default ke /admin dan tujuan portal dipertahankan", () => {
    expect(operatorNext(null, "admin")).toBe("/admin");
    expect(operatorNext("/team/orders", "admin")).toBe("/team/orders");
    expect(operatorNext("/admin/katalog", "admin")).toBe("/admin/katalog");
  });

  test("tujuan di luar portal operator ditolak", () => {
    expect(operatorNext("/orders", "staff")).toBe("/team/orders");
    expect(operatorNext("https://evil.test", "admin")).toBe("/admin");
  });

  test("safeNext pembeli tetap memakai allowlist portal", () => {
    expect(safeNext("/cart", "/orders")).toBe("/cart");
    expect(safeNext("/admin", "/orders")).toBe("/orders");
    expect(safeNext("https://evil.test", "/orders")).toBe("/orders");
  });

  test("staf dengan next /admin diarahkan ke /team/orders setelah role diketahui", async () => {
    mockFetch((url) => {
      if (url === "/api/auth/session?portal=operator") {
        return json({ session: { expiresAt: NOW + 1000 }, user: staffUser, role: "staff", portal: "operator" });
      }
      if (url.startsWith("/api/team/orders")) return json({ orders: [], nextCursor: null });
      return null;
    });
    window.history.replaceState({}, "", "/operator/login?next=%2Fadmin");
    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe("/team/orders"));
  });
});

describe("F05 state terminal sesuaikan paket", () => {
  test("paket tidak dikenal menampilkan state tidak ditemukan dan tautan katalog", async () => {
    window.history.replaceState({}, "", "/packages/p-tidak-ada/customize");
    render(<App />);

    expect(await screen.findByText(/tidak ditemukan/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kembali ke katalog" })).toHaveAttribute("href", "/catalog");
    expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input).includes("/quote"))).toBe(false);
  });

  test("paket tanpa fakultas layak menampilkan state belum tersedia", async () => {
    mockFetch((url) => (url === "/api/catalog" ? json(catalogWithoutFaculty) : null));
    window.history.replaceState({}, "", "/packages/p-paket-kosong/customize");
    render(<App />);

    expect(await screen.findByText(/belum tersedia/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kembali ke katalog" })).toHaveAttribute("href", "/catalog");
    expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input).includes("/quote"))).toBe(false);
  });
});

describe("F06 pemulihan aksi tim", () => {
  test("aksi gagal memuat ulang status pesanan", async () => {
    let current = paidOrder;
    let getCount = 0;
    mockFetch((url, init) => {
      if (url === "/api/auth/session?portal=operator") {
        return json({ session: { expiresAt: NOW + 1000 }, user: staffUser, role: "staff", portal: "operator" });
      }
      if (url === "/api/team/orders/o-1" && (init?.method ?? "GET") === "GET") {
        getCount += 1;
        return json({ order: current });
      }
      if (url === "/api/team/orders/o-1/ready" && init?.method === "POST") {
        current = { ...current, fulfillmentStatus: "READY", readyAt: NOW };
        return json({ error: "conflict", message: "Status pesanan sudah berubah." }, 409);
      }
      return null;
    });
    window.history.replaceState({}, "", "/team/orders/o-1");
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Tandai siap diambil" }));

    expect(await screen.findByText("Status pesanan sudah berubah.")).toBeInTheDocument();
    expect(await screen.findByText("Siap diambil")).toBeInTheDocument();
    expect(getCount).toBeGreaterThanOrEqual(2);
  });

  test("penolakan izin menyegarkan sesi operator dan menampilkan pesan izin", async () => {
    let permissions = ["orders.view", "orders.ready", "orders.complete"];
    mockFetch((url, init) => {
      if (url === "/api/auth/session?portal=operator") {
        return json({
          session: { expiresAt: NOW + 1000 },
          user: { ...staffUser, permissions },
          role: "staff",
          portal: "operator",
        });
      }
      if (url === "/api/team/orders/o-1" && (init?.method ?? "GET") === "GET") return json({ order: paidOrder });
      if (url === "/api/team/orders/o-1/ready" && init?.method === "POST") {
        permissions = ["orders.view"];
        return json({ error: "forbidden", message: "Akses ditolak." }, 403);
      }
      return null;
    });
    window.history.replaceState({}, "", "/team/orders/o-1");
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Tandai siap diambil" }));

    expect(await screen.findByText(/izin tindakan ini/i)).toBeInTheDocument();
    expect(await screen.findByText("Izin menandai siap diambil belum diberikan admin.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tandai siap diambil" })).not.toBeInTheDocument();
  });

  test("replay idempoten tetap menampilkan catatan tanpa perubahan ganda", async () => {
    const ready = { ...paidOrder, fulfillmentStatus: "READY" as const, readyAt: NOW };
    mockFetch((url, init) => {
      if (url === "/api/auth/session?portal=operator") {
        return json({ session: { expiresAt: NOW + 1000 }, user: staffUser, role: "staff", portal: "operator" });
      }
      if (url === "/api/team/orders/o-1" && (init?.method ?? "GET") === "GET") return json({ order: paidOrder });
      if (url === "/api/team/orders/o-1/ready" && init?.method === "POST") return json({ order: ready, replayed: true });
      return null;
    });
    window.history.replaceState({}, "", "/team/orders/o-1");
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Tandai siap diambil" }));

    expect(
      await screen.findByText("Tindakan ini sudah pernah dicatat, tidak ada perubahan ganda."),
    ).toBeInTheDocument();
  });
});