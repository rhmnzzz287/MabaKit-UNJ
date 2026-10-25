import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import App from "@/App";
import type { CatalogResponse, Order, PackageQuote } from "@/lib/types";
import { percentToBasisPoints } from "@/pages/AdminPage";

const NOW = Date.now();

const product = {
  id: "p-topi",
  kind: "single" as const,
  title: "Topi PKKMB",
  description: "Topi peserta dengan label fakultas.",
  imagePath: "/products/topi-feb-960.webp",
  priceRp: 35000,
  stock: 4,
  variants: [
    {
      id: "v-topi-feb",
      sku: "TOPI-FEB",
      attributes: { fakultas: "FEB", foto: "/products/topi-feb-960.webp", foto480: "/products/topi-feb-480.webp" },
      imagePath: "/products/topi-feb-960.webp",
      imagePath480: "/products/topi-feb-480.webp",
      priceRp: 35000,
      stock: 4,
      faculties: ["fac-feb"],
    },
  ],
};

const paket = {
  id: "p-paket-hemat",
  kind: "bundle" as const,
  title: "Paket Hemat",
  description: "Topi, kipas, dan kaus kaki.",
  imagePath: null,
  priceRp: 50000,
  stock: 3,
  variants: [],
  facultyOptions: [
    { facultyId: "fac-feb", facultyName: "Fakultas Ekonomi dan Bisnis", priceRp: 50000, stock: 3 },
    { facultyId: "fac-ft", facultyName: "Fakultas Teknik", priceRp: 52000, stock: 2 },
  ],
};

const catalog: CatalogResponse = {
  faculties: [
    { id: "fac-feb", name: "Fakultas Ekonomi dan Bisnis", aliases: ["FEB"] },
    { id: "fac-ft", name: "Fakultas Teknik", aliases: ["FT"] },
  ],
  packages: [paket],
  products: [product],
};

const quote: PackageQuote = {
  package: { id: "p-paket-hemat", title: "Paket Hemat", description: "Topi, kipas, dan kaus kaki.", imagePath: null },
  faculty: { id: "fac-feb", name: "Fakultas Ekonomi dan Bisnis" },
  components: [
    {
      variantId: "v-topi-feb",
      sku: "TOPI-FEB",
      title: "Topi PKKMB",
      attributes: { fakultas: "FEB" },
      imagePath: "/products/topi-feb-960.webp",
      quantity: 1,
      unitPriceRp: 35000,
      lineTotalRp: 35000,
      stock: 4,
    },
  ],
  priceRp: 50000,
  unitTotalRp: 60000,
  savingsRp: 10000,
  stock: 3,
  available: true,
};

const pendingOrder: Order = {
  id: "o-1",
  orderNumber: "MBK-261022-ABCD",
  buyerName: "Siti",
  contactPhone: "081234567890",
  email: "siti@example.test",
  facultyId: "fac-feb",
  totalRp: 50000,
  paymentStatus: "PENDING",
  fulfillmentStatus: "UNFULFILLED",
  method: "QRIS",
  createdAt: NOW - 60_000,
  expiresAt: NOW + 600_000,
  paidAt: null,
  readyAt: null,
  pickedUpAt: null,
  pickup: { label: "Kampus A Rawamangun", details: "Lobi gedung B", hours: "09.00-15.00", version: 1 },
  items: [
    {
      id: "i-1",
      title: "Paket Hemat",
      attributes: { fakultas: "Fakultas Ekonomi dan Bisnis" },
      quantity: 1,
      unitPriceRp: 50000,
      lineTotalRp: 50000,
      components: [{ variantId: "v-topi-feb", sku: "TOPI-FEB", title: "Topi PKKMB", attributes: { fakultas: "FEB" }, quantity: 1 }],
    },
  ],
  invoice: null,
  review: null,
  reviewEligible: false,
};

const buyer = { id: "usr-buyer", email: "buyer@mabakit.demo", role: "buyer" as const, name: "Siti Rahma", whatsapp: "081234567890", facultyId: "fac-ft" };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function routes(overrides: (url: string, init?: RequestInit) => Response | Promise<Response> | null = () => null) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const custom = overrides(url, init);
    if (custom) return custom;
    if (url === "/api/catalog") return json(catalog);
    if (url === "/api/catalog/p-topi") return json({ product });
    if (url === "/api/packages/p-paket-hemat/quote?faculty=fac-feb") return json(quote);
    if (url === "/api/demo/session" && method === "POST") return json({ csrfToken: "csrf" }, 201);
    if (url === "/api/auth/session") return json({ session: null, user: null, role: "buyer" });
    if (url === "/api/profile") return json({ profile: null });
    if (url === "/api/checkout/create" && method === "POST") return json({ order: pendingOrder }, 201);
    if (url === "/api/orders/o-1") return json({ order: pendingOrder });
    if (url === "/api/demo/orders/o-1/check-payment" && method === "POST") {
      return json({
        order: { ...pendingOrder, paymentStatus: "PAID", paidAt: NOW, invoice: { invoiceNumber: "INV-MBK-261022-ABCD", issuedAt: NOW } },
      });
    }
    return json({ error: "not_found", message: "Tidak ada" }, 404);
  });
}

beforeEach(() => {
  localStorage.clear();
  document.cookie = "mbk_csrf=csrf; path=/";
  window.history.replaceState({}, "", "/");
  vi.stubGlobal("fetch", routes());
});

describe("konversi diskon admin", () => {
  test("koma dan titik desimal sama-sama diterima, nilai luar rentang ditolak", () => {
    expect(percentToBasisPoints("12,5")).toBe(1250);
    expect(percentToBasisPoints("12.5")).toBe(1250);
    expect(percentToBasisPoints("100")).toBe(10000);
    expect(percentToBasisPoints("")).toBe(0);
    expect(percentToBasisPoints("101")).toBe(-1);
    expect(percentToBasisPoints("abc")).toBe(-1);
  });
});

describe("alur belanja demo v2", () => {
  test("katalog menampilkan paket lebih dulu lalu produk satuan", async () => {
    window.history.replaceState({}, "", "/catalog");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Paket Hemat" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Topi PKKMB" })).toBeInTheDocument();
    expect(screen.getByText(/Mulai Rp\s?50\.000/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sesuaikan paket" })).toHaveAttribute("href", "/packages/p-paket-hemat/customize");
    expect(screen.getByRole("img", { name: "Foto Topi PKKMB" })).toHaveAttribute("src", "/products/topi-feb-960.webp");
  });

  test("halaman sesuaikan paket memuat penawaran per fakultas dan menambah ke keranjang", async () => {
    window.history.replaceState({}, "", "/packages/p-paket-hemat/customize");
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText(/Isi paket untuk Fakultas Ekonomi dan Bisnis/)).toBeInTheDocument();
    expect(screen.getByText("Selisih paket")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tambah paket ke keranjang" }));

    await waitFor(() => expect(window.location.pathname).toBe("/cart"));
    const cart = JSON.parse(localStorage.getItem("mabakit.cart.v2") ?? "[]");
    expect(cart).toMatchObject([
      { productId: "p-paket-hemat", facultyId: "fac-feb", facultyName: "Fakultas Ekonomi dan Bisnis", quantity: 1 },
    ]);
  });

  test("produk satuan menambahkan baris keranjang tanpa fakultas", async () => {
    window.history.replaceState({}, "", "/products/p-topi");
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Tambah ke keranjang" }));
    await waitFor(() => expect(window.location.pathname).toBe("/cart"));
    const cart = JSON.parse(localStorage.getItem("mabakit.cart.v2") ?? "[]");
    expect(cart).toMatchObject([{ productId: "p-topi", variantId: "v-topi-feb", facultyId: null, quantity: 1 }]);
  });

  test("checkout tanpa akun mengalihkan ke halaman masuk", async () => {
    window.history.replaceState({}, "", "/checkout");
    render(<App />);
    await waitFor(() => expect(window.location.pathname).toBe("/login"));
  });

  test("checkout mengirim item paket dengan fakultas lalu membuka pembayaran", async () => {
    vi.stubGlobal(
      "fetch",
      routes((url) => {
        if (url === "/api/auth/session") return json({ session: { expiresAt: NOW + 1000 }, user: buyer, role: "buyer" });
        if (url === "/api/profile") {
          return json({ profile: { name: "Siti Rahma", whatsapp: "081234567890", email: "buyer@mabakit.demo", facultyId: "fac-ft", updatedAt: NOW } });
        }
        return null;
      }),
    );
    window.history.replaceState({}, "", "/checkout");
    localStorage.setItem(
      "mabakit.cart.v2",
      JSON.stringify([
        {
          productId: "p-paket-hemat",
          variantId: null,
          facultyId: "fac-feb",
          facultyName: "Fakultas Ekonomi dan Bisnis",
          title: "Paket Hemat",
          variantLabel: "Fakultas Ekonomi dan Bisnis",
          priceRp: 50000,
          quantity: 1,
        },
      ]),
    );
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Buat pesanan simulasi" }));

    expect(await screen.findByRole("heading", { name: /Pembayaran MBK-261022-ABCD/ })).toBeInTheDocument();
    const call = vi.mocked(fetch).mock.calls.find(([input]) => String(input) === "/api/checkout/create");
    const init = call?.[1] as RequestInit;
    expect((init.headers as Headers).get("x-csrf")).toBe("csrf");
    expect(JSON.parse(String(init.body))).toMatchObject({
      buyerName: "Siti Rahma",
      contactPhone: "081234567890",
      email: "buyer@mabakit.demo",
      items: [{ productId: "p-paket-hemat", variantId: null, facultyId: "fac-feb", quantity: 1 }],
    });
    expect(localStorage.getItem("mabakit.cart.v2")).toBe("[]");
  });

  test("cek status pembayaran menampilkan tautan invoice dan status sudah dibayar", async () => {
    vi.stubGlobal(
      "fetch",
      routes((url) => {
        if (url === "/api/auth/session") return json({ session: { expiresAt: NOW + 1000 }, user: buyer, role: "buyer" });
        return null;
      }),
    );
    window.history.replaceState({}, "", "/orders/o-1/payment");
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Cek status pembayaran" }));

    expect(await screen.findByRole("link", { name: "Lihat invoice" })).toBeInTheDocument();
    expect(screen.getByText(/Pesanan simulasi berhasil dibuat/)).toBeInTheDocument();
    expect(screen.getByText("Sudah dibayar")).toBeInTheDocument();
  });

  test("beranda menawarkan paket dan tidak menampilkan tautan workspace tim", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: /Paket/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Workspace tim" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  test("profil menyimpan nama, whatsapp, dan fakultas", async () => {
    vi.stubGlobal(
      "fetch",
      routes((url, init) => {
        if (url === "/api/auth/session") return json({ session: { expiresAt: NOW + 1000 }, user: buyer, role: "buyer" });
        if (url === "/api/profile" && (init?.method ?? "GET") === "GET") {
          return json({ profile: { name: "Siti Rahma", whatsapp: "081234567890", email: "buyer@mabakit.demo", facultyId: null, updatedAt: NOW } });
        }
        if (url === "/api/profile" && init?.method === "PATCH") {
          return json({ profile: { ...JSON.parse(String(init.body)), email: "buyer@mabakit.demo", updatedAt: NOW } });
        }
        return null;
      }),
    );
    window.history.replaceState({}, "", "/profile");
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Simpan profil" }));

    expect(await screen.findByText("Profil tersimpan.")).toBeInTheDocument();
    const call = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ name: "Siti Rahma", whatsapp: "081234567890", facultyId: "fac-ft" });
  });

  test("pembeli yang membuka /team tidak memanggil API tim", async () => {
    window.history.replaceState({}, "", "/team");
    render(<App />);

    expect(await screen.findByText(/hanya untuk admin dan tim MabaKit/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Masuk sebagai operator" })).toHaveAttribute("href", "/operator/login?next=%2Fteam");
    expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input).startsWith("/api/team/"))).toBe(false);
  });

  test("header menampilkan workspace tim hanya setelah server menyatakan role operator", async () => {
    vi.stubGlobal(
      "fetch",
      routes((url) => {
        if (url === "/api/auth/session?portal=operator") {
          return json({ session: { expiresAt: NOW + 1000 }, user: { ...buyer, role: "staff", permissions: ["orders.view"] }, role: "staff", portal: "operator" });
        }
        if (url === "/api/auth/session") {
          return json({ session: null, user: null, role: "buyer", portal: "buyer" });
        }
        return null;
      }),
    );
    render(<App />);
    expect(await screen.findByRole("link", { name: "Workspace tim" })).toHaveAttribute("href", "/team");
  });

  test("aksi fulfillment disembunyikan saat izin tidak diberikan", async () => {
    const paid = { ...pendingOrder, paymentStatus: "PAID" as const, paidAt: NOW };
    vi.stubGlobal(
      "fetch",
      routes((url) => {
        if (url === "/api/auth/session?portal=operator") {
          return json({
            session: { expiresAt: NOW + 1000 },
            user: { ...buyer, role: "staff", permissions: ["orders.view"] },
            role: "staff",
            portal: "operator",
          });
        }
        if (url === "/api/team/orders/o-1") return json({ order: paid });
        return null;
      }),
    );
    window.history.replaceState({}, "", "/team/orders/o-1");
    render(<App />);

    expect(await screen.findByText("Izin menandai siap diambil belum diberikan admin.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tandai siap diambil" })).not.toBeInTheDocument();
  });

  test("staf dengan izin dapat menandai pesanan siap diambil", async () => {
    let current = { ...pendingOrder, paymentStatus: "PAID" as const, paidAt: NOW };
    vi.stubGlobal(
      "fetch",
      routes((url, init) => {
        if (url === "/api/auth/session?portal=operator") {
          return json({
            session: { expiresAt: NOW + 1000 },
            user: { ...buyer, role: "staff", permissions: ["orders.view", "orders.ready", "orders.complete"] },
            role: "staff",
            portal: "operator",
          });
        }
        if (url === "/api/team/orders/o-1" && (!init?.method || init.method === "GET")) {
          return json({ order: current });
        }
        if (url === "/api/team/orders/o-1/ready" && init?.method === "POST") {
          current = { ...current, fulfillmentStatus: "READY" as const, readyAt: NOW };
          return json({ order: current });
        }
        return null;
      }),
    );
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/team/orders/o-1");
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Tandai siap diambil" }));
    expect(await screen.findByText("Pesanan ditandai siap diambil.")).toBeInTheDocument();
    expect(screen.getByText("Siap diambil")).toBeInTheDocument();
  });

  test("header pembeli berubah setelah masuk tanpa menyisakan tautan Masuk", async () => {
    window.history.replaceState({}, "", "/login?next=%2Fcart");
    let signed = false;
    const base = routes();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/auth/session") {
        return json(signed ? { session: { expiresAt: NOW + 3_600_000 }, user: buyer, role: "buyer" } : { session: null, user: null, role: "buyer" });
      }
      if (url === "/api/auth/login" && init?.method === "POST") {
        signed = true;
        return json({ session: { expiresAt: NOW + 3_600_000 }, user: buyer, role: "buyer" });
      }
      return base(input, init);
    }));
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("Email"), "buyer@mabakit.demo");
    await user.type(screen.getByLabelText("Kata sandi"), "buyermabakit123");
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    expect(await screen.findByRole("link", { name: "Profil" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Masuk" })).not.toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe("/cart"));
  });

  test("rute admin hanya menampilkan bagian yang dipilih", async () => {
    const admin = { ...buyer, id: "usr-admin", email: "mabakita@admin", role: "admin" as const };
    vi.stubGlobal(
      "fetch",
      routes((url) => {
        if (url === "/api/auth/session?portal=operator") {
          return json({ session: { expiresAt: NOW + 1000 }, user: admin, role: "admin", portal: "operator" });
        }
        if (url === "/api/auth/session") return json({ session: null, user: null, role: "buyer" });
        if (url === "/api/admin/summary") {
          return json({
            settings: null,
            counts: { pending: 0, paid: 0, expired: 0, ready: 0, pickedUp: 0 },
            variants: [],
          });
        }
        if (url === "/api/admin/catalog") return json({ products: [], faculties: [] });
        return null;
      }),
    );
    window.history.replaceState({}, "", "/admin/stok");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Stok" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Katalog" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Stok" })).toHaveAttribute("aria-current", "page");
  });

  test("/admin tanpa bagian dialihkan ke ringkasan", async () => {
    const admin = { ...buyer, id: "usr-admin", email: "mabakita@admin", role: "admin" as const };
    vi.stubGlobal(
      "fetch",
      routes((url) => {
        if (url === "/api/auth/session?portal=operator") {
          return json({ session: { expiresAt: NOW + 1000 }, user: admin, role: "admin", portal: "operator" });
        }
        if (url === "/api/auth/session") return json({ session: null, user: null, role: "buyer" });
        if (url === "/api/admin/summary") {
          return json({ settings: null, counts: { pending: 0, paid: 0, expired: 0, ready: 0, pickedUp: 0 }, variants: [] });
        }
        if (url === "/api/admin/catalog") return json({ products: [], faculties: [] });
        return null;
      }),
    );
    window.history.replaceState({}, "", "/admin");
    render(<App />);
    await waitFor(() => expect(window.location.pathname).toBe("/admin/ringkasan"));
  });

  test("keranjang kosong menawarkan kembali ke katalog", async () => {
    window.history.replaceState({}, "", "/cart");
    render(<App />);
    expect(await screen.findByText("Keranjang masih kosong")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lihat katalog" })).toHaveAttribute("href", "/catalog");
  });
});

describe("penggantian fakultas aman di keranjang", () => {
  const febCartLine = {
    productId: "p-paket-hemat",
    variantId: null,
    facultyId: "fac-feb",
    facultyName: "Fakultas Ekonomi dan Bisnis",
    title: "Paket Hemat",
    variantLabel: "Fakultas Ekonomi dan Bisnis",
    priceRp: 50000,
    quantity: 2,
  };

  const ftQuote: PackageQuote = {
    ...quote,
    faculty: { id: "fac-ft", name: "Fakultas Teknik" },
    priceRp: 52000,
  };

  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  test("mengubah fakultas mempertahankan baris keranjang hingga penggantian dikonfirmasi", async () => {
    vi.stubGlobal(
      "fetch",
      routes((url) => {
        if (url === "/api/packages/p-paket-hemat/quote?faculty=fac-ft") return json(ftQuote);
        return null;
      }),
    );
    localStorage.setItem("mabakit.cart.v2", JSON.stringify([febCartLine]));
    window.history.replaceState({}, "", "/cart");
    const user = userEvent.setup();
    render(<App />);

    const link = screen.getByRole("link", { name: "Ubah fakultas paket" });
    expect(link).toHaveAttribute("href", expect.stringContaining("/packages/p-paket-hemat/customize?replace="));
    await user.click(link);

    await waitFor(() => expect(window.location.pathname).toBe("/packages/p-paket-hemat/customize"));
    expect(JSON.parse(localStorage.getItem("mabakit.cart.v2") ?? "[]")).toEqual([febCartLine]);

    await screen.findByText(/Isi paket untuk Fakultas Ekonomi dan Bisnis/);
    await user.selectOptions(screen.getByLabelText("Fakultas"), "fac-ft");
    await screen.findByText(/Isi paket untuk Fakultas Teknik/);
    await user.click(screen.getByRole("button", { name: "Tambah paket ke keranjang" }));

    await waitFor(() => expect(window.location.pathname).toBe("/cart"));
    const cart = JSON.parse(localStorage.getItem("mabakit.cart.v2") ?? "[]");
    expect(cart).toEqual([
      {
        productId: "p-paket-hemat",
        variantId: null,
        facultyId: "fac-ft",
        facultyName: "Fakultas Teknik",
        title: "Paket Hemat",
        variantLabel: "Fakultas Teknik",
        priceRp: 52000,
        quantity: 1,
      },
    ]);
  });

  test("tombol tambah terkunci saat penawaran dihitung ulang", async () => {
    window.history.replaceState({}, "", "/packages/p-paket-hemat/customize");
    let releaseFt!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      routes((url) => {
        if (url === "/api/packages/p-paket-hemat/quote?faculty=fac-ft") {
          return new Promise((resolve) => {
            releaseFt = (response) => resolve(response);
          });
        }
        return null;
      }),
    );
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(/Isi paket untuk Fakultas Ekonomi dan Bisnis/);
    await user.selectOptions(screen.getByLabelText("Fakultas"), "fac-ft");

    expect(screen.getByRole("button", { name: "Menghitung ulang..." })).toBeDisabled();

    releaseFt(json(ftQuote));
    expect(await screen.findByRole("button", { name: "Tambah paket ke keranjang" })).toBeEnabled();
  });
});

describe("halaman Starter Kit", () => {
  const paketFakultas = (id: string, facultyId: string, title: string) => ({
    id,
    kind: "bundle" as const,
    title,
    description: `Isi ${title}.`,
    imagePath: null,
    priceRp: 95000,
    stock: 5,
    variants: [],
    facultyId,
    componentTitles: ["Topi Fakultas", "Slayer"],
    facultyOptions: [{ facultyId, facultyName: "Fakultas Teknik", priceRp: 95000, stock: 5 }],
  });

  test("mengumpulkan semua paket fakultas dan tidak menampilkan tier", async () => {
    const starterCatalog: CatalogResponse = {
      faculties: catalog.faculties,
      packages: [
        paketFakultas("p-paket-ft", "fac-ft", "Paket FT"),
        paketFakultas("p-paket-feb", "fac-feb", "Paket FEB"),
        {
          id: "p-tier-hemat",
          kind: "bundle",
          title: "Paket Hemat",
          description: "Slayer dan name tag.",
          imagePath: null,
          priceRp: 30000,
          stock: 5,
          variants: [],
          facultyId: null,
          componentTitles: ["Slayer", "Name Tag"],
          facultyOptions: [{ facultyId: "fac-ft", facultyName: "Fakultas Teknik", priceRp: 30000, stock: 5 }],
        },
      ],
      products: [product],
    };
    vi.stubGlobal("fetch", routes((url) => (url === "/api/catalog" ? json(starterCatalog) : null)));
    window.history.replaceState({}, "", "/starter-kit");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Paket FT" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Paket FEB" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Paket Hemat" })).toBeNull();
  });
});
