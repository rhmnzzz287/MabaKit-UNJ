import { useCallback, useEffect, useState } from "react";
import { ApiError, get, post } from "../lib/api";
import { dateTime, rupiah, statusLabel } from "../lib/format";
import type { Order } from "../lib/types";
import { Alert, Button, Input, PageHeader, Spinner, StatusBadge } from "../components/ui";
import { OperatorLogin } from "../components/OperatorLogin";

export default function StaffPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [found, setFound] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const body = await get<{ orders: Order[] }>("/api/staff/orders");
      setOrders(body.orders);
      setAuthorized(true);
    } catch (issue) {
      if (issue instanceof ApiError && (issue.status === 401 || issue.status === 403)) {
        setAuthorized(false);
        return;
      }
      setError(issue instanceof Error ? issue.message : "Daftar pesanan gagal dimuat.");
      setAuthorized(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markReady(id: string) {
    setBusy(true);
    setError(null);
    try {
      await post(`/api/staff/orders/${id}/ready`);
      await load();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Status gagal diubah.");
    } finally {
      setBusy(false);
    }
  }

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFound(null);
    try {
      const body = await post<{ order: Order }>("/api/staff/pickup/lookup", { token: token.toUpperCase() });
      setFound(body.order);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Kode tidak ditemukan.");
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      await post("/api/staff/pickup/claim", { token: token.toUpperCase() });
      setFound(null);
      setToken("");
      await load();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Klaim gagal.");
    } finally {
      setBusy(false);
    }
  }

  if (authorized === null) return <Spinner label="Memeriksa akses operator" />;

  if (!authorized) {
    return (
      <div className="space-y-6">
        <PageHeader title="Staf" description="Area operator demo untuk menyiapkan dan menyerahkan pesanan." />
        <OperatorLogin role="staff" title="Masuk sebagai staf" onReady={() => void load()} />
      </div>
    );
  }

  const ready = orders.filter((order) => order.fulfillmentStatus === "UNFULFILLED");
  const readyToPick = orders.filter((order) => order.fulfillmentStatus === "READY");

  return (
    <div className="space-y-8">
      <PageHeader title="Staf" description="Hanya pesanan berstatus PAID yang tampil. Tandai siap setelah barang dikemas." />
      {error ? <Alert tone="error">{error}</Alert> : null}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-ink">Perlu disiapkan ({ready.length})</h2>
        {ready.length === 0 ? <p className="text-muted">Tidak ada pesanan yang menunggu persiapan.</p> : null}
        <ul className="space-y-3">
          {ready.map((order) => (
            <li key={order.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-mono font-semibold text-ink">{order.orderNumber}</p>
                <StatusBadge status={order.paymentStatus} />
              </div>
              <p className="text-sm text-muted">
                {order.recipientName}, {order.contactPhone}
              </p>
              <ul className="text-sm">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.title} x {item.quantity}
                  </li>
                ))}
              </ul>
              <p className="text-sm font-medium">{rupiah(order.totalRp)}</p>
              <p className="text-sm text-muted">
                Lokasi: {order.pickup.label}. Dibayar {dateTime(order.paidAt)} WIB.
              </p>
              <Button onClick={() => markReady(order.id)} disabled={busy}>
                Tandai siap
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-ink">Serah terima ({readyToPick.length})</h2>
        {readyToPick.length === 0 ? <p className="text-muted">Belum ada pesanan siap diambil.</p> : null}
        <ul className="space-y-2">
          {readyToPick.map((order) => (
            <li key={order.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <span className="font-mono font-semibold text-ink">{order.orderNumber}</span> — {order.recipientName},{" "}
              {statusLabel(order.fulfillmentStatus)}
            </li>
          ))}
        </ul>

        <form onSubmit={lookup} className="max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-ink">Cari kode pickup</h3>
          <label htmlFor="pickup-code" className="block text-sm font-medium text-ink">
            Kode dari pembeli
          </label>
          <Input
            id="pickup-code"
            value={token}
            onChange={(event) => setToken(event.target.value.toUpperCase())}
            maxLength={16}
            required
            autoComplete="off"
          />
          <Button type="submit" variant="secondary" disabled={busy || token.trim().length < 4}>
            Cari pesanan
          </Button>
        </form>

        {found ? (
          <div className="space-y-2 rounded-xl border border-brand bg-brand-tint p-4">
            <p className="font-mono font-semibold text-brand-dark">{found.orderNumber}</p>
            <p className="text-sm text-ink">
              {found.recipientName}, {found.contactPhone}
            </p>
            <ul className="text-sm text-ink">
              {found.items.map((item) => (
                <li key={item.id}>
                  {item.title} x {item.quantity}
                </li>
              ))}
            </ul>
            {found.pickedUpAt ? (
              <p className="text-sm font-medium text-brand-dark">Sudah diambil {dateTime(found.pickedUpAt)} WIB.</p>
            ) : (
              <Button onClick={claim} disabled={busy}>
                Konfirmasi serah terima
              </Button>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
