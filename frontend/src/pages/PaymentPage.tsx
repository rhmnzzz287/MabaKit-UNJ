import { useEffect, useState } from "react";
import { navigate } from "../lib/router";
import { useWorkspace } from "../lib/workspace";
import { ApiError, get, post } from "../lib/api";
import { countdown, dateTime, rupiah, statusLabel } from "../lib/format";
import type { Order } from "../lib/types";
import { Alert, Button, Link, PageHeader, SimulasiBadge, Spinner, StatusBadge } from "../components/ui";

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: "Transfer bank (simulasi)",
  EWALLET: "E-wallet (simulasi)",
  QRIS: "QRIS (simulasi)",
  FREE: "Gratis, tanpa pembayaran",
};

export default function PaymentPage({ id }: { id: string }) {
  const workspace = useWorkspace();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (workspace.state === "loading") return;
    if (!workspace.user) navigate("/login?next=%2Forders");
  }, [workspace.state, workspace.user]);

  useEffect(() => {
    if (!workspace.user) return;
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
  }, [id, workspace.user]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function checkPayment() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const body = await post<{ order: Order }>(`/api/demo/orders/${id}/check-payment`);
      setOrder(body.order);
      setNotice("Pembayaran simulasi berhasil dicatat. Invoice tersedia.");
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Status gagal diperiksa.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !order) {
    return (
      <div className="space-y-4">
        <Alert tone="error">{error}</Alert>
        <Link to="/orders" className="font-semibold text-brand underline">
          Lihat pesanan saya
        </Link>
      </div>
    );
  }
  if (!order) return <Spinner label="Memuat pesanan" />;

  const paid = order.paymentStatus === "PAID";
  const expired = order.paymentStatus === "EXPIRED" || (!paid && order.expiresAt <= now);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Pembayaran ${order.orderNumber}`}
        description="Halaman ini mensimulasikan konfirmasi pembayaran. Tidak ada uang yang dikirim dan tidak ada bank yang dihubungi."
      />
      <SimulasiBadge />
      <Alert tone="info">Tidak ada pembayaran atau penagihan nyata pada versi ini.</Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-ink">Ringkasan</h2>
          <p className="text-3xl font-bold text-ink">{rupiah(order.totalRp)}</p>
          <p className="text-sm text-muted">Metode: {order.method ? METHOD_LABEL[order.method] : "-"}</p>
          <p>
            Status: <StatusBadge status={order.paymentStatus} />
          </p>
          {!paid && !expired ? (
            <p className="text-sm text-muted">
              Sisa waktu draft: <strong className="font-mono text-ink">{countdown(order.expiresAt, now)}</strong>
            </p>
          ) : null}
          <p className="text-sm text-muted">Dibuat {dateTime(order.createdAt)} WIB</p>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-ink">Pengambilan</h2>
          <p className="font-medium text-ink">{order.pickup.label}</p>
          <p className="text-sm text-muted">{order.pickup.details}</p>
          <p className="text-sm text-muted">Jam layanan: {order.pickup.hours}</p>
          <p className="text-sm text-muted">
            Pengambilan dilakukan setelah panitia menandai pesanan siap. Tidak ada booking jadwal.
          </p>
        </section>
      </div>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-ink">Item</h2>
        <ul className="divide-y divide-slate-200">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 py-2">
              <span className="text-ink">
                {item.title} x {item.quantity}
              </span>
              <span className="font-medium text-ink">{rupiah(item.lineTotalRp)}</span>
            </li>
          ))}
        </ul>
      </section>

      {paid ? (
        <div className="space-y-4">
          <Alert tone="info">
            {order.method === "FREE"
              ? "Pesanan gratis dibuat tanpa pembayaran. Status " + statusLabel(order.fulfillmentStatus) + "."
              : "Pesanan simulasi berhasil dibuat. Status " + statusLabel(order.fulfillmentStatus) + "."}{" "}
            Invoice digital tersedia dan bukan bukti pembayaran nyata.
          </Alert>
          <div className="flex flex-wrap gap-4">
            <Link
              to={`/orders/${order.id}/invoice`}
              className="inline-flex min-h-12 items-center rounded-lg bg-brand px-4 font-semibold text-white"
            >
              Lihat invoice
            </Link>
            <Link
              to="/orders"
              className="inline-flex min-h-12 items-center rounded-lg border border-line bg-white px-4 font-semibold text-ink"
            >
              Daftar pesanan
            </Link>
          </div>
        </div>
      ) : expired ? (
        <div className="space-y-4">
          <Alert tone="warn">Draft kedaluwarsa. Stok sudah dilepas. Silakan buat pesanan baru dari katalog.</Alert>
          <Link
            to="/catalog"
            className="inline-flex min-h-12 items-center rounded-lg bg-brand px-4 font-semibold text-white"
          >
            Mulai pesanan baru
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <Button onClick={checkPayment} disabled={busy}>
            {busy ? "Memeriksa..." : "Cek status pembayaran"}
          </Button>
          <p className="text-sm text-muted">
            Tombol ini tidak memeriksa rekening atau bank nyata. Server hanya menandai pembayaran simulasi berhasil.
          </p>
          {error ? <Alert tone="error">{error}</Alert> : null}
          {notice ? <Alert tone="info">{notice}</Alert> : null}
        </div>
      )}
    </div>
  );
}
