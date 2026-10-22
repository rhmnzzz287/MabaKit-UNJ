import { useEffect, useState } from "react";
import { get, post } from "../lib/api";
import { dateTime, rupiah, statusLabel } from "../lib/format";
import type { Order } from "../lib/types";
import { Alert, Link, PageHeader, Spinner, StatusBadge } from "../components/ui";

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    get<{ orders: Order[] }>("/api/orders")
      .then((body) => {
        if (active) setOrders(body.orders);
      })
      .catch((issue: unknown) => {
        if (active) setError(issue instanceof Error ? issue.message : "Pesanan gagal dimuat.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pesanan saya"
        description="Riwayat terikat pada sesi tamu di browser ini. Berganti browser atau menghapus cookie berarti riwayat tidak bisa dipulihkan."
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {!orders && !error ? <Spinner label="Memuat pesanan" /> : null}
      {orders && orders.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-muted">Belum ada pesanan.</p>
          <Link to="/" className="font-semibold text-brand underline">
            Lihat katalog
          </Link>
        </div>
      ) : null}
      {orders && orders.length > 0 ? (
        <ul className="space-y-3">
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
                {dateTime(order.createdAt)} WIB, {rupiah(order.totalRp)}
              </p>
              <p className="text-sm text-muted">
                {order.items.map((item) => `${item.title} x ${item.quantity}`).join(", ")}
              </p>
              <div className="flex flex-wrap gap-3 pt-1 text-sm font-semibold">
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

export function OrderDetailPage({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    get<{ order: Order }>(`/api/orders/${id}`)
      .then((body) => {
        if (active) setOrder(body.order);
      })
      .catch((issue: unknown) => {
        if (active) setError(issue instanceof Error ? issue.message : "Pesanan gagal dimuat.");
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!order) return <Spinner label="Memuat pesanan" />;

  async function requestToken() {
    setBusy(true);
    try {
      const body = await post<{ token: string }>(`/api/orders/${id}/pickup-token`);
      setToken(body.token);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Kode pickup gagal dibuat.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={order.orderNumber} description={`Dibuat ${dateTime(order.createdAt)} WIB`} />
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={order.paymentStatus} />
        <StatusBadge status={order.fulfillmentStatus} />
      </div>

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-ink">Item</h2>
        <ul className="divide-y divide-slate-200">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between py-2">
              <span>
                {item.title} x {item.quantity}
              </span>
              <span className="font-medium">{rupiah(item.lineTotalRp)}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t border-slate-200 pt-2 text-lg">
          <span>Total</span>
          <strong>{rupiah(order.totalRp)}</strong>
        </p>
      </section>

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-ink">Pengambilan</h2>
        <p className="font-medium">{order.pickup.label}</p>
        <p className="text-sm text-muted">{order.pickup.details}</p>
        <p className="text-sm text-muted">Jam layanan: {order.pickup.hours}</p>
        {order.fulfillmentStatus === "READY" ? (
          <div className="space-y-2 pt-2">
            <p className="text-sm text-muted">Tunjukkan kode ini ke petugas. Kode hanya dibuat saat diminta.</p>
            <button
              type="button"
              onClick={requestToken}
              disabled={busy}
              className="min-h-12 rounded-lg bg-brand px-4 font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Membuat kode..." : "Buat kode pickup"}
            </button>
            {token ? (
              <p className="font-mono text-2xl font-bold tracking-widest text-ink" aria-live="polite">
                {token}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Kode pickup muncul setelah status {statusLabel("READY").toLowerCase()}. Status saat ini:{" "}
            {statusLabel(order.fulfillmentStatus)}.
          </p>
        )}
      </section>
    </div>
  );
}
