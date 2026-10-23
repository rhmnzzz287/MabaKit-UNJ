import { useCallback, useEffect, useState } from "react";
import { ApiError, get, opPost, post } from "../lib/api";
import { dateTime, rupiah, statusLabel, variantLabel } from "../lib/format";
import { navigate } from "../lib/router";
import type { Order, TeamOrdersPage, TeamSummary } from "../lib/types";
import { useOperatorWorkspace, waNumber, type Workspace, type WorkspaceRole } from "../lib/workspace";
import { Alert, Button, Link, PageHeader, Spinner, StatusBadge } from "../components/ui";

const PERIODS = [
  { value: "today", label: "Hari ini" },
  { value: "7d", label: "7 hari" },
  { value: "30d", label: "30 hari" },
  { value: "all", label: "Semua" },
] as const;

function useTeamGate() {
  const workspace = useOperatorWorkspace();
  const role = workspace.state === "ready" && (workspace.role === "staff" || workspace.role === "admin") ? workspace.role : null;
  const permissions = workspace.user?.permissions ?? [];
  const can = (permission: string) => role === "staff" && permissions.includes(permission);
  return { workspace, role, can };
}

function Denied({ workspace }: { workspace: Workspace }) {
  if (workspace.state === "loading") return <Spinner label="Memeriksa akses tim" />;
  return (
    <div className="space-y-4">
      <PageHeader title="Workspace tim" description="Halaman ini hanya untuk admin dan tim MabaKit yang terverifikasi server." />
      <Alert tone="error">{workspace.error ?? "Akun ini bukan bagian dari tim MabaKit."}</Alert>
      <div className="flex flex-wrap gap-4">
        <Button variant="secondary" onClick={workspace.reload}>
          Coba lagi
        </Button>
        <Link to="/operator/login?next=%2Fteam" className="inline-flex min-h-12 items-center font-semibold text-brand underline">
          Masuk sebagai operator
        </Link>
      </div>
    </div>
  );
}

export function TeamShell({ role, children }: { role: WorkspaceRole; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    setBusy(true);
    setError(null);
    try {
      await opPost("/api/auth/logout?portal=operator");
      // Muat ulang penuh: guard Worker harus memeriksa ulang sebelum HTML workspace dikirim.
      window.location.assign("/operator/login");
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Logout gagal.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Workspace tim</p>
          <p className="text-lg font-bold text-ink">MabaKit</p>
          <p className="text-sm text-muted">Masuk sebagai {role === "admin" ? "admin" : "tim MabaKit"}</p>
        </div>
        <nav aria-label="Navigasi tim" className="flex flex-wrap items-center gap-4 text-sm font-semibold">
          <Link to="/team" className="min-h-12 content-center text-ink hover:underline">
            Ringkasan
          </Link>
          <Link to="/team/orders" className="min-h-12 content-center text-ink hover:underline">
            Pesanan
          </Link>
          {role === "admin" ? (
            <Link to="/admin" className="min-h-12 content-center text-ink hover:underline">
              Admin
            </Link>
          ) : null}
          <Button variant="secondary" onClick={() => void logout()} disabled={busy}>
            {busy ? "Keluar..." : "Keluar"}
          </Button>
        </nav>
      </header>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {children}
    </div>
  );
}

export function TeamDashboardPage() {
  const { workspace, role } = useTeamGate();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["value"]>("today");
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await get<TeamSummary>(`/api/team/summary?period=${period}`));
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Ringkasan gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (!role) return;
    void load();
  }, [role, load]);

  if (!role) return <Denied workspace={workspace} />;

  return (
    <TeamShell role={role}>
      <PageHeader
        title="Ringkasan penjualan"
        description="Nilai penjualan adalah total pesanan terbayar, bukan laba. Semua angka berasal dari simulasi pembayaran."
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Rentang waktu">
        {PERIODS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={period === option.value}
            onClick={() => setPeriod(option.value)}
            className={`min-h-12 rounded-lg border px-4 font-semibold ${
              period === option.value ? "border-brand bg-brand-tint text-brand-dark" : "border-line bg-white text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error ? (
        <div className="space-y-4">
          <Alert tone="error">{error}</Alert>
          <Button variant="secondary" onClick={() => void load()}>
            Coba lagi
          </Button>
        </div>
      ) : null}
      {loading && !summary ? <Spinner label="Memuat ringkasan" /> : null}
      {summary ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2" aria-label="Penjualan">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-muted">Nilai penjualan dibayar</p>
              <p className="text-3xl font-bold text-ink">{rupiah(summary.sales.paidValueRp)}</p>
              <p className="text-sm text-muted">Simulasi, bukan omzet nyata dan bukan laba.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-muted">Transaksi dibayar</p>
              <p className="text-3xl font-bold text-ink">{summary.sales.paidOrders}</p>
              <p className="text-sm text-muted">
                Batas rentang WIB: {summary.rangeStart ? `${dateTime(summary.rangeStart)} WIB` : "sejak awal data"}.
              </p>
            </div>
          </section>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Status pesanan">
            {(
              [
                ["pending", "Menunggu pembayaran", "/team/orders?payment=PENDING"],
                ["preparing", "Sedang disiapkan", "/team/orders?payment=PAID&fulfillment=UNFULFILLED"],
                ["ready", "Siap diambil", "/team/orders?fulfillment=READY"],
                ["completed", "Selesai", "/team/orders?fulfillment=PICKED_UP"],
              ] as const
            ).map(([key, label, to]) => (
              <div key={key} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm text-muted">{label}</p>
                <p className="text-2xl font-bold text-ink">{summary.counts[key]}</p>
                <Link to={to} className="text-sm font-semibold text-brand underline">
                  Lihat pesanan
                </Link>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </TeamShell>
  );
}

function WhatsAppShortcut({ order }: { order: Order }) {
  const [copied, setCopied] = useState(false);
  const stage =
    order.fulfillmentStatus === "READY"
      ? `siap diambil di ${order.pickup.label} (${order.pickup.hours})`
      : order.fulfillmentStatus === "PICKED_UP"
        ? "sudah diterima"
        : "sedang disiapkan";
  const message = `Halo ${order.buyerName}, pesanan ${order.orderNumber} ${stage}. Ini pesan simulasi dari demo MabaKit.`;
  const href = `https://wa.me/${waNumber(order.contactPhone)}?text=${encodeURIComponent(message)}`;

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-4 text-sm">
      <p className="font-semibold text-ink">Draft WhatsApp</p>
      <p className="text-muted">Tujuan: {order.contactPhone}. Membuka chat tidak mengubah status pesanan.</p>
      <p className="rounded bg-slate-50 p-2 text-ink">{message}</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 items-center rounded-lg border border-line bg-white px-4 font-semibold text-ink"
        >
          Buka WhatsApp
        </a>
        <Button
          variant="secondary"
          onClick={() => {
            void navigator.clipboard?.writeText(message).then(() => setCopied(true));
          }}
        >
          {copied ? "Tersalin" : "Salin pesan"}
        </Button>
      </div>
    </div>
  );
}

export function TeamOrdersPage() {
  const { workspace, role } = useTeamGate();
  const params = new URLSearchParams(window.location.search);
  const [payment, setPayment] = useState(params.get("payment") ?? "");
  const [fulfillment, setFulfillment] = useState(params.get("fulfillment") ?? "");
  const [page, setPage] = useState<TeamOrdersPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const query = useCallback(
    (cursor?: string | null) => {
      const search = new URLSearchParams();
      if (payment) search.set("payment", payment);
      if (fulfillment) search.set("fulfillment", fulfillment);
      if (cursor) search.set("cursor", cursor);
      return `/api/team/orders?${search.toString()}`;
    },
    [payment, fulfillment],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPage(await get<TeamOrdersPage>(query(null)));
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Pesanan tim gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (!role) return;
    void load();
  }, [role, load]);

  async function more() {
    if (!page?.nextCursor) return;
    setLoading(true);
    try {
      const next = await get<TeamOrdersPage>(query(page.nextCursor));
      setPage({ orders: [...page.orders, ...next.orders], nextCursor: next.nextCursor });
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Halaman berikut gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }

  if (!role) return <Denied workspace={workspace} />;

  return (
    <TeamShell role={role}>
      <PageHeader title="Pesanan tim" description="Semua pesanan lintas pembeli. Data kontak adalah snapshot saat checkout." />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="block font-medium text-ink">Status pembayaran</span>
          <select
            value={payment}
            onChange={(event) => setPayment(event.target.value)}
            className="min-h-12 w-full rounded-lg border border-line bg-white px-4 text-ink"
          >
            <option value="">Semua</option>
            <option value="PENDING">Menunggu pembayaran</option>
            <option value="PAID">Sudah dibayar</option>
            <option value="EXPIRED">Kedaluwarsa</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="block font-medium text-ink">Status pengerjaan</span>
          <select
            value={fulfillment}
            onChange={(event) => setFulfillment(event.target.value)}
            className="min-h-12 w-full rounded-lg border border-line bg-white px-4 text-ink"
          >
            <option value="">Semua</option>
            <option value="UNFULFILLED">Belum disiapkan</option>
            <option value="READY">Siap diambil</option>
            <option value="PICKED_UP">Sudah diterima</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>
        </label>
      </div>

      {error ? (
        <div className="space-y-4">
          <Alert tone="error">{error}</Alert>
          <Button variant="secondary" onClick={() => void load()}>
            Coba lagi
          </Button>
        </div>
      ) : null}
      {loading && !page ? <Spinner label="Memuat pesanan" /> : null}
      {page && page.orders.length === 0 ? <Alert tone="warn">Tidak ada pesanan untuk filter ini.</Alert> : null}
      {page && page.orders.length > 0 ? (
        <ul className="space-y-4">
          {page.orders.map((order) => (
            <li key={order.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono font-semibold text-ink">{order.orderNumber}</p>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={order.paymentStatus} />
                  <StatusBadge status={order.fulfillmentStatus} />
                </div>
              </div>
              <p className="text-sm text-muted">
                {order.buyerName} · {order.contactPhone} · {rupiah(order.totalRp)}
              </p>
              <p className="text-sm text-muted">
                Dibuat {dateTime(order.createdAt)} WIB. {order.items.map((item) => `${item.title} x ${item.quantity}`).join(", ")}
              </p>
              <Link to={`/team/orders/${order.id}`} className="font-semibold text-brand underline">
                Buka detail
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {page?.nextCursor ? (
        <Button variant="secondary" onClick={() => void more()} disabled={loading}>
          {loading ? "Memuat..." : "Muat lebih banyak"}
        </Button>
      ) : null}
    </TeamShell>
  );
}

export function TeamOrderDetailPage({ id }: { id: string }) {
  const { workspace, role, can } = useTeamGate();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const body = await get<{ order: Order }>(`/api/team/orders/${id}`);
      setOrder(body.order);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Detail pesanan gagal dimuat.");
    }
  }, [id]);

  useEffect(() => {
    if (!role) return;
    void load();
  }, [role, load]);

  async function act(path: string, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const body = await post<{ order: Order; replayed?: boolean }>(path);
      setOrder(body.order);
      setNotice(body.replayed ? "Tindakan ini sudah pernah dicatat, tidak ada perubahan ganda." : success);
      setConfirming(false);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Tindakan gagal.");
    } finally {
      setBusy(false);
    }
  }

  if (!role) return <Denied workspace={workspace} />;

  return (
    <TeamShell role={role}>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="info">{notice}</Alert> : null}
      {!order && !error ? <Spinner label="Memuat detail pesanan" /> : null}
      {order ? (
        <>
          <PageHeader title={order.orderNumber} description={`Dibuat ${dateTime(order.createdAt)} WIB`} />
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={order.paymentStatus} />
            <StatusBadge status={order.fulfillmentStatus} />
          </div>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-ink">Pembeli</h2>
              <p className="font-medium text-ink">{order.buyerName}</p>
              <p className="text-sm text-muted">{order.contactPhone}</p>
              <p className="text-sm text-muted">{order.email ?? "Email tidak tersimpan."}</p>
              <p className="text-sm text-muted">
                Dibayar {dateTime(order.paidAt)} WIB, siap {dateTime(order.readyAt)} WIB, diterima {dateTime(order.pickedUpAt)} WIB.
              </p>
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-ink">Pengambilan</h2>
              <p className="font-medium text-ink">{order.pickup.label}</p>
              <p className="text-sm text-muted">{order.pickup.details}</p>
              <p className="text-sm text-muted">Jam layanan: {order.pickup.hours}</p>
              <p className="text-sm text-muted">Metode: {order.method ?? "-"} (simulasi)</p>
            </div>
          </section>

          <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-ink">Item dan komponen</h2>
            <ul className="divide-y divide-slate-200">
              {order.items.map((item) => (
                <li key={item.id} className="space-y-2 py-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="text-ink">
                      {item.title} x {item.quantity}
                      {variantLabel(item.attributes) ? <span className="block text-sm text-muted">{variantLabel(item.attributes)}</span> : null}
                    </span>
                    <span className="font-medium text-ink">{rupiah(item.lineTotalRp)}</span>
                  </div>
                  {item.components.length > 0 ? (
                    <ul className="pl-4 text-sm text-muted">
                      {item.components.map((component) => (
                        <li key={component.variantId}>
                          {component.title} ({component.sku}) x {component.quantity}
                          {variantLabel(component.attributes) ? ` · ${variantLabel(component.attributes)}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="flex justify-between border-t border-slate-200 pt-2 text-lg">
              <span>Total</span>
              <strong>{rupiah(order.totalRp)}</strong>
            </p>
          </section>

          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-ink">Tindakan</h2>
            {role === "admin" ? (
              <p className="text-sm text-muted">
                Admin hanya melihat antrean. Tindakan siap diambil dan serah terima dijalankan staf.
              </p>
            ) : null}
            {role === "staff" && order.paymentStatus === "PAID" && order.fulfillmentStatus === "UNFULFILLED" && can("orders.ready") ? (
              <Button onClick={() => void act(`/api/team/orders/${order.id}/ready`, "Pesanan ditandai siap diambil.")} disabled={busy}>
                Tandai siap diambil
              </Button>
            ) : null}
            {role === "staff" && order.paymentStatus === "PAID" && order.fulfillmentStatus === "READY" && can("orders.complete") ? (
              confirming ? (
                <div className="space-y-2 rounded-lg border border-brand bg-brand-tint p-4">
                  <p className="font-medium text-brand-dark">Konfirmasi barang sudah diterima pembeli?</p>
                  <p className="text-sm text-ink">Tindakan ini mengubah status menjadi sudah diterima dan tercatat di audit.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void act(`/api/team/orders/${order.id}/complete`, "Serah terima tercatat.")} disabled={busy}>
                      Ya, konfirmasi terima
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                      Batal
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={() => setConfirming(true)} disabled={busy}>
                  Konfirmasi barang diterima
                </Button>
              )
            ) : null}
            {order.paymentStatus === "PAID" && order.fulfillmentStatus === "UNFULFILLED" && !can("orders.ready") && role === "staff" ? (
              <p className="text-sm text-muted">Izin menandai siap diambil belum diberikan admin.</p>
            ) : null}
            {order.paymentStatus === "PAID" && order.fulfillmentStatus === "READY" && !can("orders.complete") && role === "staff" ? (
              <p className="text-sm text-muted">Izin mencatat serah terima belum diberikan admin.</p>
            ) : null}
            {order.fulfillmentStatus === "PICKED_UP" ? <p className="text-sm text-muted">Pesanan sudah diterima.</p> : null}
            {order.paymentStatus !== "PAID" ? (
              <p className="text-sm text-muted">
                Tindakan tersedia setelah pembayaran simulasi terkonfirmasi. Status: {statusLabel(order.paymentStatus)}.
              </p>
            ) : null}
            <p className="text-sm text-muted">Tidak ada QR atau kode dari pembeli. Tindakan tidak mengubah stok.</p>
            <WhatsAppShortcut order={order} />
          </section>
        </>
      ) : null}
      <button
        type="button"
        onClick={() => navigate("/team/orders")}
        className="min-h-12 font-semibold text-brand underline"
      >
        Kembali ke daftar pesanan tim
      </button>
    </TeamShell>
  );
}
