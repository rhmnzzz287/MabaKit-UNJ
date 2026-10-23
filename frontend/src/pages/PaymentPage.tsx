import { useEffect, useState } from "react";
import { navigate } from "../lib/router";
import { useWorkspace } from "../lib/workspace";
import { ApiError, get, post } from "../lib/api";
import { countdown, dateTime, statusLabel } from "../lib/format";
import type { Order } from "../lib/types";
import { Alert, Button, ButtonLink, Card, Link, PageHeader, Price, SimulasiBadge, Spinner, StatusBadge } from "../components/ui";

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
        <ButtonLink to="/orders" variant="secondary">
          Lihat pesanan saya
        </ButtonLink>
      </div>
    );
  }
  if (!order) return <Spinner label="Memuat pesanan" />;

  const paid = order.paymentStatus === "PAID";
  const expired = order.paymentStatus === "EXPIRED" || (!paid && order.expiresAt <= now);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={`Pembayaran ${order.orderNumber}`}
          description="Halaman ini mensimulasikan konfirmasi pembayaran. Tidak ada uang yang dikirim dan tidak ada bank yang dihubungi."
        />
        <SimulasiBadge />
      </div>
      <Alert tone="info">Tidak ada pembayaran atau penagihan nyata pada versi ini.</Alert>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <div className="space-y-8">
          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold tracking-tight text-ink">Tagihan simulasi</h2>
              <StatusBadge status={order.paymentStatus} />
            </div>
            <Price finalRp={order.totalRp} size="lg" />
            <dl className="space-y-2 border-t border-slate-200 pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Metode</dt>
                <dd className="font-medium text-ink">{order.method ? METHOD_LABEL[order.method] : "-"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Dibuat</dt>
                <dd className="font-medium text-ink">{dateTime(order.createdAt)} WIB</dd>
              </div>
              {!paid && !expired ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Sisa waktu draft</dt>
                  <dd className="font-mono font-semibold text-ink">{countdown(order.expiresAt, now)}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-bold tracking-tight text-ink">Item</h2>
            <ul className="divide-y divide-slate-100">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="text-ink">
                    {item.title} x {item.quantity}
                  </span>
                  <Price finalRp={item.lineTotalRp} size="sm" />
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-2 p-6">
            <h2 className="text-lg font-bold tracking-tight text-ink">Pengambilan</h2>
            <p className="font-semibold text-ink">{order.pickup.label}</p>
            <p className="text-sm text-muted">{order.pickup.details}</p>
            <p className="text-sm text-muted">Jam layanan: {order.pickup.hours}</p>
            <p className="text-sm text-muted">
              Pengambilan dilakukan setelah panitia menandai pesanan siap. Tidak ada booking jadwal.
            </p>
          </Card>

          {paid ? (
            <Card className="space-y-4 p-6">
              <Alert tone="info">
                {order.method === "FREE"
                  ? `Pesanan gratis dibuat tanpa pembayaran. Status ${statusLabel(order.fulfillmentStatus)}.`
                  : `Pesanan simulasi berhasil dibuat. Status ${statusLabel(order.fulfillmentStatus)}.`}{" "}
                Invoice digital tersedia dan bukan bukti pembayaran nyata.
              </Alert>
              <ButtonLink to={`/orders/${order.id}/invoice`} className="w-full">
                Lihat invoice
              </ButtonLink>
              <ButtonLink to="/orders" variant="secondary" className="w-full">
                Daftar pesanan
              </ButtonLink>
            </Card>
          ) : expired ? (
            <Card className="space-y-4 p-6">
              <Alert tone="warn">Draft kedaluwarsa. Stok sudah dilepas. Silakan buat pesanan baru dari katalog.</Alert>
              <ButtonLink to="/catalog" className="w-full">
                Mulai pesanan baru
              </ButtonLink>
            </Card>
          ) : (
            <Card className="space-y-4 p-6">
              <Button full onClick={checkPayment} disabled={busy}>
                {busy ? "Memeriksa..." : "Cek status pembayaran"}
              </Button>
              <p className="text-sm text-muted">
                Tombol ini tidak memeriksa rekening atau bank nyata. Server hanya menandai pembayaran simulasi berhasil.
              </p>
              {error ? <Alert tone="error">{error}</Alert> : null}
              {notice ? <Alert tone="info">{notice}</Alert> : null}
              <Link
                to="/orders"
                className="block text-center text-sm font-semibold text-brand-dark underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
              >
                Kembali ke daftar pesanan
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
