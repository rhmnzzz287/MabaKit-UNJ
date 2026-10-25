import { useCallback, useEffect, useState } from "react";
import { get } from "../lib/api";
import { navigate } from "../lib/router";
import { dateTime, statusLabel, variantLabel } from "../lib/format";
import type { Order } from "../lib/types";
import { Alert, Button, ButtonLink, Card, Link, PageHeader, Price, Spinner, StatusBadge } from "../components/ui";
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
    <div className="space-y-8">
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
        <Card className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <p className="text-lg font-semibold text-ink">Belum ada pesanan</p>
          <p className="text-muted">Pesanan yang dibuat dengan akun ini akan muncul di sini.</p>
          <ButtonLink to="/catalog">Lihat katalog</ButtonLink>
        </Card>
      ) : null}

      {orders && orders.length > 0 ? (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id}>
              <Card className="space-y-4 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-mono text-sm font-semibold text-muted">{order.orderNumber}</p>
                    <p className="text-sm text-muted">
                      {dateTime(order.createdAt)} WIB, {order.items.length} item
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={order.paymentStatus} />
                    <StatusBadge status={order.fulfillmentStatus} />
                  </div>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 pt-4">
                  <p className="text-sm text-muted">{order.items.map((item) => `${item.title} x ${item.quantity}`).join(", ")}</p>
                  <Price finalRp={order.totalRp} />
                </div>
                <div className="flex flex-wrap gap-4 text-sm font-semibold">
                  {order.paymentStatus === "PENDING" ? (
                    <Link to={`/orders/${order.id}/payment`} className="text-brand-dark">
                      Lanjut bayar
                    </Link>
                  ) : null}
                  <Link to={`/orders/${order.id}`} className="text-brand-dark">
                    Detail
                  </Link>
                  {order.paymentStatus === "PAID" ? (
                    <Link to={`/orders/${order.id}/invoice`} className="text-brand-dark">
                      Invoice
                    </Link>
                  ) : null}
                </div>
              </Card>
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
      <Card className="space-y-2 p-6">
        <h2 className="font-bold text-ink">Pesanan berakhir</h2>
        <p className="text-sm text-muted">
          Batas pembayaran lewat sebelum simulasi dikonfirmasi. Pesanan ini tidak dihitung sebagai selesai.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-6 p-6" >
      <h2 id="timeline-heading" className="text-lg font-bold tracking-tight text-ink">
        Progres pesanan
      </h2>
      <ol className="space-y-6" aria-labelledby="timeline-heading">
        {stages(order).map((stage, index, all) => (
          <li key={stage.label} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={`grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-bold ${
                  stage.done ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-muted"
                }`}
              >
                {index + 1}
              </span>
              {index < all.length - 1 ? (
                <span aria-hidden="true" className={`mt-1 w-0.5 flex-1 ${stage.done ? "bg-brand" : "bg-slate-200"}`} />
              ) : null}
            </div>
            <div className="pb-1">
              <p className={stage.done ? "font-semibold text-ink" : "text-muted"}>{stage.label}</p>
              <p className="text-sm text-muted">
                {stage.done && stage.at ? `${dateTime(stage.at)} WIB` : "Menunggu tahap sebelumnya"}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="border-t border-slate-100 pt-4 text-sm text-muted">
        Perbarui halaman atau kembali ke tab ini untuk melihat status terbaru. Bukan push real-time.
      </p>
    </Card>
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

  // Simpan ke variabel lokal supaya penyempitan tipe tetap berlaku di dalam callback.
  const review = order.review;

  return (
    <div className="space-y-8">
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

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
        <div className="space-y-8">
          <OrderTimeline order={order} />

          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-bold tracking-tight text-ink">Item</h2>
            <ul className="divide-y divide-slate-100">
              {order.items.map((item) => (
                <li key={item.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
                  <div className="flex justify-between gap-4">
                    <span className="text-ink">
                      {item.title} x {item.quantity}
                      {variantLabel(item.attributes) ? (
                        <span className="block text-sm text-muted">{variantLabel(item.attributes)}</span>
                      ) : null}
                    </span>
                    <Price finalRp={item.lineTotalRp} size="sm" />
                  </div>
                  {item.components.length > 0 ? (
                    <ul className="space-y-1 rounded-xl bg-slate-50 p-4 text-sm text-muted">
                      {item.components.map((component) => (
                        <li key={component.variantId}>
                          {component.title} x {component.quantity}
                          {variantLabel(component.attributes) ? ` (${variantLabel(component.attributes)})` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="font-semibold text-ink">Total</span>
              <Price finalRp={order.totalRp} />
            </div>
          </Card>

          <Card className="space-y-2 p-6">
            <h2 className="text-lg font-bold tracking-tight text-ink">Kontak pesanan</h2>
            <p className="font-medium text-ink">{order.buyerName}</p>
            <p className="text-sm text-muted">{order.contactPhone}</p>
            <p className="text-sm text-muted">{order.email ?? "Email tidak tersimpan untuk pesanan lama ini."}</p>
            <p className="text-sm text-muted">Data ini snapshot saat checkout. Perubahan profil tidak mengubah pesanan ini.</p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-2 p-6">
            <h2 className="text-lg font-bold tracking-tight text-ink">Pengambilan</h2>
            <p className="font-semibold text-ink">{order.pickup.label}</p>
            <p className="text-sm text-muted">{order.pickup.details}</p>
            <p className="text-sm text-muted">Jam layanan: {order.pickup.hours}</p>
            <p className="text-sm text-muted">Tunjukkan nomor pesanan saat mengambil. Tidak perlu kode QR.</p>
          </Card>

          {order.invoice ? (
            <Card className="space-y-2 p-6">
              <h2 className="text-lg font-bold tracking-tight text-ink">Invoice</h2>
              <p className="text-sm text-muted">
                {order.invoice.invoiceNumber}, {dateTime(order.invoice.issuedAt)} WIB
              </p>
              <ButtonLink to={`/orders/${order.id}/invoice`} variant="secondary" className="w-full">
                Buka invoice
              </ButtonLink>
            </Card>
          ) : null}

          {review ? (
            <Card className="space-y-2 p-6">
              <h2 className="text-lg font-bold tracking-tight text-ink">Ulasan Anda</h2>
              <p aria-label={`Rating ${review.rating} dari 5`} className="flex items-center gap-2 text-sm text-muted">
                <span aria-hidden="true" className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <span
                      key={step}
                      className={`h-1.5 w-6 rounded-full ${step <= review.rating ? "bg-brand" : "bg-slate-200"}`}
                    />
                  ))}
                </span>
                <span>{review.rating} dari 5</span>
              </p>
              <p className="text-ink">{review.comment}</p>
              <p className="text-sm text-muted">{dateTime(review.createdAt)} WIB, ulasan demo</p>
            </Card>
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
            <Card className="p-6">
              <p className="text-sm text-muted">
                Ulasan tersedia setelah pesanan diterima. Status saat ini: {statusLabel(order.fulfillmentStatus)}.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
