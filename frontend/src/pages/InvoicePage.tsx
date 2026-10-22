import { useEffect, useState } from "react";
import { get } from "../lib/api";
import { dateTime, rupiah } from "../lib/format";
import type { Invoice } from "../lib/types";
import { Alert, Button, Link, PageHeader, Spinner } from "../components/ui";

export default function InvoicePage({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [id]);

  if (error) {
    return (
      <div className="space-y-3">
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
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Invoice digital" description="Dibuat dari snapshot pesanan saat pembayaran simulasi dikonfirmasi." />
        <Button variant="secondary" onClick={() => window.print()}>
          Cetak
        </Button>
      </div>

      <div className="rounded-lg border border-warn-fg bg-warn-bg p-3 font-semibold text-warn-fg" role="note">
        {invoice.watermark}. Invoice ini bukan faktur pajak dan tidak diterbitkan sistem pembayaran nyata.
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
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Penerima</h2>
            <p className="font-medium text-ink">{order.recipientName}</p>
            <p className="text-sm text-muted">Pemesan: {order.buyerName}</p>
            <p className="text-sm text-muted">{order.contactPhone}</p>
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
                <td className="py-2 text-right text-ink">{rupiah(item.unitPriceRp)}</td>
                <td className="py-2 text-right font-medium text-ink">{rupiah(item.lineTotalRp)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3} className="py-3 text-right">
                Total
              </th>
              <td className="py-3 text-right text-lg font-bold text-ink">{rupiah(order.totalRp)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="text-sm text-muted">
          Metode: {order.method ?? "-"}. Status pembayaran: {order.paymentStatus}. Status pemenuhan:{" "}
          {order.fulfillmentStatus}.
        </p>
      </article>
    </div>
  );
}
