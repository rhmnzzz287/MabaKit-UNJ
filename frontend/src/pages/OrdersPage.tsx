import { useCallback, useEffect, useState } from "react";
import { get } from "../lib/api";
import { navigate } from "../lib/router";
import { dateTime, rupiah, statusLabel, variantLabel } from "../lib/format";
import type { Order } from "../lib/types";
import { Alert, Button, Link, PageHeader, Spinner, StatusBadge } from "../components/ui";
import { OrderReviewForm } from "../components/OrderReviewForm";
import { useWorkspace } from "../lib/workspace";

function useReloadOnReturn(load: () => void) {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", handler);
    window.addEventListener("focus", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      window.removeEventListener("focus", handler);
    };
  }, [load]);
}

export function OrdersPage() {
  const workspace = useWorkspace();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const body = await get<{ orders: Order[] }>("/api/orders");
      setOrders(body.orders);
    } catch (issue: unknown) {
      setError(issue instanceof Error ? issue.message : "Pesanan gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (workspace.state === "loading") return;
    if (!workspace.user) {
      navigate("/login?next=%2Forders");
      return;
    }
    void load();
  }, [load, workspace.state, workspace.user]);
  useReloadOnReturn(load);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Pesanan saya"
          description="Riwayat terikat pada akun yang sedang masuk. Masuk dari browser lain untuk melihat pesanan yang sama."
        />
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
          {loading ? "Memuat..." : "Muat ulang"}
        </Button>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {!orders && !error ? <Spinner label="Memuat pesanan" /> : null}
      {orders && orders.length === 0 ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-muted">Belum ada pesanan.</p>
          <Link to="/catalog" className="font-semibold text-brand underline">
            Lihat katalog
          </Link>
        </div>
      ) : null}
      {orders && orders.length > 0 ? (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">{order.orderNumber}</p>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={order.paymentStatus} />
                  <StatusBadge status={order.fulfillmentStatus} />
                </div>
              </div>
              <p className="text-sm text-muted">
                {dateTime(order.createdAt)} WIB, {order.totalRp === 0 ? "Gratis" : rupiah(order.totalRp)}
              </p>
              <p className="text-sm text-muted">{order.items.map((item) => `${item.title} x ${item.quantity}`).join(", ")}</p>
              <div className="flex flex-wrap gap-4 pt-2 text-sm font-semibold">
                {order.paymentStatus === "PENDING" ? (
                  <Link to={`/orders/${order.id}/payment`} className="text-brand underline">
                    Lanjut bayar
                  </Link>
                ) : null}
                <Link to={`/orders/${order.id}`} className="text-brand underline">
                  Detail
                </Link>
                {order.paymentStatus === "PAID" ? (
                  <Link to={`/orders/${order.id}/invoice`} className="text-brand underline">
                    Invoice
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type Stage = { label: string; at: number | null; done: boolean };

function stages(order: Order): Stage[] {
  const preparing = order.paymentStatus === "PAID";
  const ready = order.fulfillmentStatus === "READY" || order.fulfillmentStatus === "PICKED_UP";
  const complete = order.fulfillmentStatus === "PICKED_UP";
  return [
    { label: "Menunggu pembayaran", at: order.createdAt, done: true },
    { label: "Sedang disiapkan", at: order.paidAt, done: preparing },
    { label: "Siap diambil", at: order.readyAt, done: ready },
    { label: "Sudah diterima", at: order.pickedUpAt, done: complete },
  ];
}

function OrderTimeline({ order }: { order: Order }) {
  if (order.paymentStatus === "EXPIRED") {
    return (
      <div className="rounded-xl border border-line bg-slate-100 p-4">
        <h2 className="font-semibold text-ink">Pesanan berakhir</h2>
        <p className="text-sm text-muted">
          Batas pembayaran lewat sebelum simulasi dikonfirmasi. Pesanan ini tidak dihitung sebagai selesai.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4" aria-labelledby="timeline-heading">
      <h2 id="timeline-heading" className="font-semibold text-ink">
        Progres pesanan
      </h2>
      <ol className="space-y-4">
        {stages(order).map((stage) => (
          <li key={stage.label} className="flex gap-4">
            <span
              aria-hidden="true"
              className={`mt-2 size-3 shrink-0 rounded-full border ${stage.done ? "border-brand bg-brand" : "border-line bg-white"}`}
            />
            <div>
              <p className={stage.done ? "font-medium text-ink" : "text-muted"}>{stage.label}</p>
              <p className="text-sm text-muted">{stage.done && stage.at ? `${dateTime(stage.at)} WIB` : "Menunggu tahap sebelumnya"}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">Perbarui halaman atau kembali ke tab ini untuk melihat status terbaru. Bukan push real-time.</p>
    </section>
  );
}

export function OrderDetailPage({ id }: { id: string }) {
  const workspace = useWorkspace();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const body = await get<{ order: Order }>(`/api/orders/${id}`);
      setOrder(body.order);
    } catch (issue: unknown) {
      setError(issue instanceof Error ? issue.message : "Pesanan gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (workspace.state === "loading") return;
    if (!workspace.user) {
      navigate("/login?next=%2Forders");
      return;
    }
    void load();
  }, [load, workspace.state, workspace.user]);
  useReloadOnReturn(load);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!order) return <Spinner label="Memuat pesanan" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title={order.orderNumber} description={`Dibuat ${dateTime(order.createdAt)} WIB`} />
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
          {loading ? "Memuat..." : "Muat ulang"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={order.paymentStatus} />
        <StatusBadge status={order.fulfillmentStatus} />
      </div>

      <OrderTimeline order={order} />

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-ink">Item</h2>
        <ul className="divide-y divide-slate-200">
          {order.items.map((item) => (
            <li key={item.id} className="space-y-2 py-2">
              <div className="flex justify-between gap-4">
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
                      Isi paket: {component.title} x {component.quantity}
                      {variantLabel(component.attributes) ? ` (${variantLabel(component.attributes)})` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t border-slate-200 pt-2 text-lg">
          <span>Total</span>
          <strong>{order.totalRp === 0 ? "Gratis" : rupiah(order.totalRp)}</strong>
        </p>
      </section>

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-ink">Kontak pesanan</h2>
        <p className="font-medium text-ink">{order.buyerName}</p>
        <p className="text-sm text-muted">{order.contactPhone}</p>
        <p className="text-sm text-muted">{order.email ?? "Email tidak tersimpan untuk pesanan lama ini."}</p>
        <p className="text-sm text-muted">Data ini snapshot saat checkout. Perubahan profil tidak mengubah pesanan ini.</p>
      </section>

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-ink">Pengambilan</h2>
        <p className="font-medium">{order.pickup.label}</p>
        <p className="text-sm text-muted">{order.pickup.details}</p>
        <p className="text-sm text-muted">Jam layanan: {order.pickup.hours}</p>
        <p className="text-sm text-muted">Tunjukkan nomor pesanan saat mengambil. Tidak perlu kode QR.</p>
      </section>

      {order.invoice ? (
        <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-ink">Invoice</h2>
          <p className="text-sm text-muted">
            {order.invoice.invoiceNumber}, {dateTime(order.invoice.issuedAt)} WIB
          </p>
          <Link to={`/orders/${order.id}/invoice`} className="font-semibold text-brand underline">
            Buka invoice dan pratinjau email
          </Link>
        </section>
      ) : null}

      {order.review ? (
        <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-ink">Ulasan Anda</h2>
          <p aria-label={`Rating ${order.review.rating} dari 5`} className="text-brand-dark">
            {"★".repeat(order.review.rating)}
            {"☆".repeat(5 - order.review.rating)}
          </p>
          <p className="text-ink">{order.review.comment}</p>
          <p className="text-sm text-muted">{dateTime(order.review.createdAt)} WIB, ulasan demo</p>
        </section>
      ) : order.reviewEligible ? (
        <OrderReviewForm
          orderId={order.id}
          onSubmitted={(review) => {
            setOrder({
              ...order,
              review: { rating: review.rating, comment: review.comment, createdAt: review.createdAt },
              reviewEligible: false,
            });
          }}
        />
      ) : (
        <p className="text-sm text-muted">
          Ulasan tersedia setelah pesanan diterima. Status saat ini: {statusLabel(order.fulfillmentStatus)}.
        </p>
      )}
    </div>
  );
}
