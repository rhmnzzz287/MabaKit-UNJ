import { useEffect, useState } from "react";
import { removeLine, setQuantity, subscribeCart, cartLines, cartTotal } from "../lib/cart";
import { rupiah } from "../lib/format";
import { Alert, Button, Link, PageHeader } from "../components/ui";

export default function CartPage() {
  const [lines, setLines] = useState(cartLines);

  useEffect(() => subscribeCart(() => setLines(cartLines())), []);

  return (
    <div className="space-y-6">
      <PageHeader title="Keranjang" description="Periksa jumlah dan estimasi sebelum lanjut ke checkout simulasi." />

      {lines.length === 0 ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-muted">Keranjang masih kosong.</p>
          <Link to="/" className="inline-flex min-h-12 items-center rounded-lg bg-brand px-4 font-semibold text-white">
            Lihat katalog
          </Link>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {lines.map((line) => (
              <li key={`${line.productId}:${line.variantId ?? ""}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="font-semibold text-ink">{line.title}</p>
                  {line.variantLabel ? <p className="text-sm text-muted">{line.variantLabel}</p> : null}
                  <p className="text-sm text-muted">{rupiah(line.priceRp)} per unit</p>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor={`qty-${line.productId}`} className="text-sm text-muted">
                    Jumlah
                  </label>
                  <input
                    id={`qty-${line.productId}`}
                    type="number"
                    min={1}
                    max={99}
                    value={line.quantity}
                    onChange={(event) => setQuantity(line.productId, line.variantId, Number(event.target.value) || 1)}
                    className="min-h-12 w-20 rounded-lg border border-line bg-white px-2 text-center text-base"
                  />
                </div>
                <p className="w-32 font-semibold text-ink">{rupiah(line.priceRp * line.quantity)}</p>
                <Button variant="danger" onClick={() => removeLine(line.productId, line.variantId)}>
                  Hapus
                </Button>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-lg">
              Total estimasi <strong className="text-ink">{rupiah(cartTotal())}</strong>
            </p>
            <Link
              to="/checkout"
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand-dark"
            >
              Lanjut checkout
            </Link>
          </div>
          <Alert tone="info">Total final dihitung ulang di server saat pesanan dibuat.</Alert>
        </>
      )}
    </div>
  );
}
