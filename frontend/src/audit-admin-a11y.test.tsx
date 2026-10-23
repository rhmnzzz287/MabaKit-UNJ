import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import App from "@/App";
import { Field, Input } from "@/components/ui";
import type { Operator } from "@/lib/types";
import { percentToBasisPoints } from "@/pages/AdminPage";

const NOW = Date.now();

const buyer = {
  id: "usr-buyer",
  email: "buyer@mabakit.demo",
  role: "buyer" as const,
  name: "Siti Rahma",
  whatsapp: "081234567890",
  facultyId: "fac-feb",
};

const adminUser = {
  id: "usr-admin",
  email: "mabakita@admin",
  role: "admin" as const,
  name: "Admin MabaKit",
  whatsapp: null,
  facultyId: null,
};

const adminOperator: Operator = {
  id: "usr-admin",
  email: "mabakita@admin",
  name: "Admin MabaKit",
  role: "admin",
  permissions: [],
  disabled: false,
  lastLoginAt: NOW,
  activeSessions: 1,
};

const disabledStaff: Operator = {
  id: "usr-staff",
  email: "tim@demo.mabakit",
  name: "Tim MabaKit",
  role: "staff",
  permissions: ["orders.view", "orders.ready", "orders.complete"],
  disabled: true,
  lastLoginAt: NOW - 60_000,
  activeSessions: 0,
};

const summary = {
  settings: null,
  counts: { pending: 0, paid: 0, expired: 0, ready: 0, pickedUp: 0 },
  variants: [],
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function routes(overrides: (url: string, init?: RequestInit) => Response | null = () => null) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    return overrides(url, init) ?? json({ error: "not_found", message: "Tidak ada" }, 404);
  });
}

beforeEach(() => {
  localStorage.clear();
  document.cookie = "mbk_csrf=csrf; path=/";
  window.history.replaceState({}, "", "/");
});

describe("validasi diskon admin (F09)", () => {
  test("menolak desimal lebih dari dua angka dan notasi eksponen", () => {
    expect(percentToBasisPoints("12.345")).toBe(-1);
    expect(percentToBasisPoints("12,345")).toBe(-1);
    expect(percentToBasisPoints("1e1")).toBe(-1);
    expect(percentToBasisPoints("12.")).toBe(-1);
    expect(percentToBasisPoints("12,5")).toBe(1250);
    expect(percentToBasisPoints("100")).toBe(10000);
  });
});

describe("Field menghubungkan hint dan error (F11)", () => {
  test("aria-describedby mengikuti hint atau error dan aria-invalid hanya saat error", () => {
    const { rerender } = render(
      <Field id="telepon" label="Telepon" hint="Nomor aktif.">
        <Input id="telepon" />
      </Field>,
    );
    const input = screen.getByLabelText("Telepon");
    expect(input).toHaveAttribute("aria-describedby", "telepon-hint");
    expect(input).not.toHaveAttribute("aria-invalid");

    rerender(
      <Field id="telepon" label="Telepon" error="Nomor wajib diisi.">
        <Input id="telepon" />
      </Field>,
    );
    const invalid = screen.getByLabelText("Telepon");
    expect(invalid).toHaveAttribute("aria-describedby", "telepon-error");
    expect(invalid).toHaveAttribute("aria-invalid", "true");
  });
});

describe("admin mengaktifkan kembali staf (F07)", () => {
  test("tombol aktifkan memakai endpoint enable dan tidak memanggil revoke", async () => {
    let enabled = false;
    const fetchMock = routes((url, init) => {
      const method = init?.method ?? "GET";
      if (url === "/api/auth/session?portal=operator") {
        return json({ session: { expiresAt: NOW + 600_000 }, user: adminUser, role: "admin", portal: "operator" });
      }
      if (url === "/api/auth/session") return json({ session: null, user: null, role: "buyer" });
      if (url === "/api/admin/summary") return json(summary);
      if (url === "/api/admin/catalog") return json({ products: [], faculties: [] });
      if (url === "/api/admin/operators" && method === "GET") {
        return json({ operators: [adminOperator, { ...disabledStaff, disabled: !enabled }] });
      }
      if (url === "/api/admin/operators/usr-staff/enable" && method === "POST") {
        enabled = true;
        return json({ enabled: true, disabled: false });
      }
      return null;
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "/admin/akses");
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Aktifkan akun" }));

    expect(await screen.findByText(/Akun diaktifkan kembali/)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          String(input) === "/api/admin/operators/usr-staff/enable" &&
          (init as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(true);
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/revoke"))).toBe(false);
  });
});

describe("checkout gratis dan aksesibilitas kontak (F10, F11)", () => {
  test("total nol dari server menyembunyikan metode dan membuka detail pesanan", async () => {
    const fetchMock = routes((url, init) => {
      const method = init?.method ?? "GET";
      if (url === "/api/auth/session") {
        return json({ session: { expiresAt: NOW + 600_000 }, user: buyer, role: "buyer" });
      }
      if (url === "/api/auth/session?portal=operator") return json({ session: null, user: null, role: "admin" });
      if (url === "/api/profile") {
        return json({
          profile: { name: "Siti Rahma", whatsapp: "081234567890", email: "buyer@demo.mabakit", facultyId: "fac-feb", updatedAt: NOW },
        });
      }
      if (url === "/api/catalog") return json({ faculties: [], packages: [], products: [] });
      if (url === "/api/packages/paket-gratis/quote?faculty=fac-feb") return json({ priceRp: 0 });
      if (url === "/api/checkout/create" && method === "POST") return json({ order: { id: "o-free", totalRp: 0 } }, 201);
      return null;
    });
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem(
      "mabakit.cart.v2",
      JSON.stringify([
        {
          productId: "paket-gratis",
          variantId: null,
          facultyId: "fac-feb",
          facultyName: "Fakultas Ekonomi dan Bisnis",
          title: "Paket Gratis",
          variantLabel: "Fakultas Ekonomi dan Bisnis",
          priceRp: 50000,
          quantity: 1,
        },
      ]),
    );
    window.history.replaceState({}, "", "/checkout");
    const user = userEvent.setup();
    render(<App />);

    const phone = await screen.findByLabelText("Nomor WhatsApp");
    expect(phone).toHaveAttribute("aria-describedby", "contactPhone-hint");
    expect(screen.getByLabelText("Nama pemesan")).not.toHaveAttribute("aria-describedby");

    await waitFor(() => expect(screen.queryByText("Metode pembayaran simulasi")).not.toBeInTheDocument());
    expect(screen.getByText(/Tidak perlu pembayaran/)).toBeInTheDocument();
    expect(screen.queryByText("Tidak ada pembayaran atau penagihan nyata pada versi ini.")).not.toBeInTheDocument();
    expect(await screen.findByText("Gratis")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Buat pesanan simulasi" }));
    await waitFor(() => expect(window.location.pathname).toBe("/orders/o-free"));
  });
});
