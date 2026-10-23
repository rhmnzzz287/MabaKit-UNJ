import { useEffect, useState } from "react";
import { navigate } from "../lib/router";
import { useWorkspace } from "../lib/workspace";
import { get } from "../lib/api";
import { dateTime, rupiah } from "../lib/format";
import type { Invoice } from "../lib/types";
import { Alert, Button, Link, PageHeader, Spinner } from "../components/ui";

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
        <Link to="/orders" className="font-semibold text-brand underline">
          Kembali ke daftar pesanan
        </Link>
      </div>
    );
  }
  if (!invoice) return <Spinner label="Memuat invoice" />;

  const { order } = invoice;

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Invoice digital" description="Dibuat dari snapshot pesanan saat pembayaran simulasi dikonfirmasi." />
        <Button variant="secondary" onClick={() => window.print()}>
          Cetak
        </Button>
      </div>

      <div className="rounded-lg border border-warn-fg bg-warn-bg p-4 font-semibold text-warn-fg" role="note">
        Dokumen percobaan, bukan bukti pembayaran sah. {invoice.watermark}.
      </div>

      <article className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
        <header className="flex flex-wrap justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-lg font-bold text-ink">MabaKit</p>
            <p className="text-sm text-muted">Demo perlengkapan PKKMB</p>
          </div>
          <dl className="text-sm">
            <div className="flex gap-2">
              <dt className="text-muted">Nomor invoice</dt>
              <dd className="font-mono font-semibold text-ink">{invoice.invoiceNumber}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">Nomor pesanan</dt>
              <dd className="font-mono text-ink">{order.orderNumber}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">Tanggal</dt>
              <dd className="text-ink">{dateTime(invoice.issuedAt)} WIB</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">Mode</dt>
              <dd className="text-ink">{invoice.mode}</dd>
            </div>
          </dl>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Pemesan</h2>
            <p className="font-medium text-ink">{order.buyerName}</p>
            <p className="text-sm text-muted">{order.contactPhone}</p>
            {order.email ? <p className="text-sm text-muted">{order.email}</p> : null}
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Pengambilan</h2>
            <p className="font-medium text-ink">{order.pickup.label}</p>
            <p className="text-sm text-muted">{order.pickup.details}</p>
            <p className="text-sm text-muted">Jam layanan: {order.pickup.hours}</p>
          </div>
        </section>

        <table className="w-full text-left text-sm">
          <caption className="sr-only">Item pesanan</caption>
          <thead>
            <tr className="border-b border-slate-200 text-muted">
              <th scope="col" className="py-2">
                Item
              </th>
              <th scope="col" className="py-2 text-right">
                Jumlah
              </th>
              <th scope="col" className="py-2 text-right">
                Harga
              </th>
              <th scope="col" className="py-2 text-right">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-2 text-ink">{item.title}</td>
                <td className="py-2 text-right text-ink">{item.quantity}</td>
                <td className="py-2 text-right text-ink">
                  {(item.discountBasisPoints ?? 0) > 0 ? (
                    <s className="mr-2 text-xs text-muted">{rupiah(item.basePriceRp ?? item.unitPriceRp)}</s>
                  ) : null}
                  {rupiah(item.unitPriceRp)}
                </td>
                <td className="py-2 text-right font-medium text-ink">{rupiah(item.lineTotalRp)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3} className="py-4 text-right">
                Total
              </th>
              <td className="py-4 text-right text-lg font-bold text-ink">
                {order.totalRp === 0 ? "Gratis" : rupiah(order.totalRp)}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="text-sm text-muted">
          Metode: {order.method ?? "-"}. Status pembayaran: {order.paymentStatus}. Status pemenuhan:{" "}
          {order.fulfillmentStatus}.
        </p>
      </article>

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-ink">Pratinjau email invoice</h2>
        <p className="text-sm text-muted">
          Simulasi email, tidak ada email dikirim. Preview memakai snapshot email dan invoice pesanan ini.
        </p>
        {previewError ? <Alert tone="warn">{previewError}</Alert> : null}
        {!preview && !previewError ? <p className="text-muted">Memuat pratinjau...</p> : null}
        {preview ? (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <dl className="grid gap-2 text-sm sm:grid-cols-[120px_minmax(0,1fr)]">
              <dt className="text-muted">Penerima</dt>
              <dd className="font-medium text-ink">{preview.recipient}</dd>
              <dt className="text-muted">Subject</dt>
              <dd className="font-medium text-ink">{preview.subject}</dd>
            </dl>
            <p className="whitespace-pre-line text-sm text-ink">{preview.body}</p>
            <p className="text-sm font-medium text-warn-fg">Simulasi email, tidak ada email dikirim.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
