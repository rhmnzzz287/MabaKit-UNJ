import { useEffect, useState } from "react";
import { navigate } from "../lib/router";
import { useWorkspace } from "../lib/workspace";
import { get } from "../lib/api";
import { dateTime } from "../lib/format";
import type { Invoice } from "../lib/types";
import { Alert, Button, ButtonLink, Card, Link, PageHeader, Price, Spinner } from "../components/ui";

export default function InvoicePage({ id }: { id: string }) {
  const workspace = useWorkspace();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ recipient: string; subject: string; body: string; invoiceUrl: string; simulated: boolean } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (workspace.state === "loading") return;
    if (!workspace.user) navigate("/login?next=%2Forders");
  }, [workspace.state, workspace.user]);

  useEffect(() => {
    if (!workspace.user) return;
    let active = true;
    get<{ invoice: Invoice }>(`/api/orders/${id}/invoice`)
      .then((body) => {
        if (active) setInvoice(body.invoice);
      })
      .catch((issue: unknown) => {
        if (active) setError(issue instanceof Error ? issue.message : "Invoice gagal dimuat.");
      });
    return () => {
      active = false;
    };
  }, [id, workspace.user]);

  useEffect(() => {
    if (!invoice) return;
    let active = true;
    get<{ recipient: string; subject: string; body: string; invoiceUrl: string; simulated: boolean }>(`/api/orders/${id}/email-preview`)
      .then((body) => {
        if (active) setPreview(body);
      })
      .catch((issue: unknown) => {
        if (active) setPreviewError(issue instanceof Error ? issue.message : "Pratinjau email tidak tersedia.");
      });
    return () => {
      active = false;
    };
  }, [id, invoice]);

  if (error) {
    return (
      <div className="space-y-4">
        <Alert tone="error">{error}</Alert>
        <ButtonLink to="/orders" variant="secondary">
          Kembali ke daftar pesanan
        </ButtonLink>
      </div>
    );
  }
  if (!invoice) return <Spinner label="Memuat invoice" />;

  const { order } = invoice;

  return (
    <div className="space-y-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Invoice digital" description="Dibuat dari snapshot pesanan saat pembayaran simulasi dikonfirmasi." />
        <Button variant="secondary" onClick={() => window.print()}>
          Cetak
        </Button>
      </div>

      <div className="rounded-2xl border border-warn-fg/30 bg-warn-bg px-5 py-4 font-semibold text-warn-fg" role="note">
        Dokumen percobaan, bukan bukti pembayaran sah. {invoice.watermark}.
      </div>

      <article className="space-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="flex flex-wrap justify-between gap-6 border-b border-slate-200 pb-6">
          <div className="space-y-1">
            <p className="text-2xl font-black tracking-tight text-brand-dark">MabaKit</p>
            <p className="text-sm text-muted">Demo perlengkapan PKKMB</p>
          </div>
          <dl className="grid gap-2 text-sm">
            <div className="flex gap-3">
              <dt className="min-w-32 text-muted">Nomor invoice</dt>
              <dd className="font-mono font-semibold text-ink">{invoice.invoiceNumber}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="min-w-32 text-muted">Nomor pesanan</dt>
              <dd className="font-mono text-ink">{order.orderNumber}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="min-w-32 text-muted">Tanggal</dt>
              <dd className="text-ink">{dateTime(invoice.issuedAt)} WIB</dd>
            </div>
            <div className="flex gap-3">
              <dt className="min-w-32 text-muted">Mode</dt>
              <dd className="text-ink">{invoice.mode}</dd>
            </div>
          </dl>
        </header>

        <section className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-ink">Pemesan</h2>
            <p className="font-semibold text-ink">{order.buyerName}</p>
            <p className="text-sm text-muted">{order.contactPhone}</p>
            {order.email ? <p className="text-sm text-muted">{order.email}</p> : null}
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-ink">Pengambilan</h2>
            <p className="font-semibold text-ink">{order.pickup.label}</p>
            <p className="text-sm text-muted">{order.pickup.details}</p>
            <p className="text-sm text-muted">Jam layanan: {order.pickup.hours}</p>
          </div>
        </section>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <caption className="sr-only">Item pesanan</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-muted">
                <th scope="col" className="py-3">
                  Item
                </th>
                <th scope="col" className="py-3 text-right">
                  Jumlah
                </th>
                <th scope="col" className="py-3 text-right">
                  Harga
                </th>
                <th scope="col" className="py-3 text-right">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-3 text-ink">{item.title}</td>
                  <td className="py-3 text-right text-ink">{item.quantity}</td>
                  <td className="py-3 text-right">
                    <Price
                      finalRp={item.unitPriceRp}
                      baseRp={(item.discountBasisPoints ?? 0) > 0 ? item.basePriceRp : undefined}
                      discountBasisPoints={item.discountBasisPoints}
                      size="sm"
                    />
                  </td>
                  <td className="py-3 text-right font-medium text-ink">
                    <Price
                      finalRp={item.lineTotalRp}
                      baseRp={(item.discountBasisPoints ?? 0) > 0 ? (item.basePriceRp ?? item.unitPriceRp) * item.quantity : undefined}
                      discountBasisPoints={item.discountBasisPoints}
                      size="sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={3} className="py-5 text-right text-base">
                  Total
                </th>
                <td className="py-5 text-right">
                  <Price finalRp={order.totalRp} size="lg" />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="text-sm text-muted">
          Metode: {order.method ?? "-"}. Status pembayaran: {order.paymentStatus}. Status pemenuhan: {order.fulfillmentStatus}.
        </p>
      </article>

      <Card className="space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight text-ink">Pratinjau email invoice</h2>
          <p className="text-sm text-muted">
            Simulasi email, tidak ada email dikirim. Preview memakai snapshot email dan invoice pesanan ini.
          </p>
        </div>
        {previewError ? <Alert tone="warn">{previewError}</Alert> : null}
        {!preview && !previewError ? <p className="text-muted">Memuat pratinjau...</p> : null}
        {preview ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <dl className="grid gap-2 text-sm sm:grid-cols-[100px_minmax(0,1fr)]">
              <dt className="text-muted">Penerima</dt>
              <dd className="font-medium text-ink">{preview.recipient}</dd>
              <dt className="text-muted">Subject</dt>
              <dd className="font-medium text-ink">{preview.subject}</dd>
            </dl>
            <p className="whitespace-pre-line border-t border-slate-200 pt-3 text-sm text-ink">{preview.body}</p>
            <p className="text-sm font-semibold text-warn-fg">Simulasi email, tidak ada email dikirim.</p>
          </div>
        ) : null}
      </Card>

      <p className="no-print text-sm text-muted">
        <Link to="/orders" className="font-semibold text-brand-dark underline decoration-brand/40 underline-offset-4 hover:decoration-brand">
          Kembali ke daftar pesanan
        </Link>
      </p>
    </div>
  );
}
