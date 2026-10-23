import { useEffect, useState } from "react";
import { cartLines, cartTotal, lineKey, removeLine, setQuantity, subscribeCart } from "../lib/cart";
import { rupiah } from "../lib/format";
import { Alert, Button, ButtonLink, Card, Link, PageHeader, Price } from "../components/ui";

export default function CartPage() {
  const [lines, setLines] = useState(cartLines);

  useEffect(() => subscribeCart(() => setLines(cartLines())), []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Keranjang"
        description="Periksa jumlah dan estimasi sebelum lanjut ke checkout simulasi."
        actions={
          lines.length > 0 ? (
            <ButtonLink to="/catalog" variant="secondary">
              Tambah item lain
            </ButtonLink>
          ) : undefined
        }
      />

      {lines.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <span aria-hidden="true" className="grid size-14 place-items-center rounded-2xl bg-brand-tint text-2xl">
            🛒
          </span>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-ink">Keranjang masih kosong</p>
            <p className="text-muted">Mulai dari paket fakultas atau produk satuan.</p>
          </div>
          <ButtonLink to="/catalog">Lihat katalog</ButtonLink>
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.5fr)]">
          <ul className="space-y-4">
            {lines.map((line) => {
              const key = lineKey(line);
              return (
                <li key={key}>
                  <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-semibold text-ink">{line.title}</p>
                      {line.facultyName ? (
                        <p className="text-sm text-muted">
                          Fakultas <span className="font-medium text-ink">{line.facultyName}</span>
                        </p>
                      ) : null}
                      {line.variantLabel && line.variantLabel !== line.facultyName ? (
                        <p className="text-sm text-muted">{line.variantLabel}</p>
                      ) : null}
                      <p className="text-sm text-muted">{rupiah(line.priceRp)} per unit</p>
                      {line.variantId === null ? (
                        <Link
                          to={`/packages/${line.productId}/customize`}
                          onClick={() => removeLine(key)}
                          className="inline-flex min-h-12 items-center text-sm font-semibold text-brand-dark underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
                        >
                          Ubah fakultas paket
                        </Link>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <label htmlFor={`qty-${key}`} className="text-sm font-medium text-muted">
                        Jumlah
                      </label>
                      <input
                        id={`qty-${key}`}
                        type="number"
                        min={1}
                        max={99}
                        value={line.quantity}
                        onChange={(event) => setQuantity(key, Math.max(1, Math.min(99, Number(event.target.value) || 1)))}
                        className="min-h-12 w-20 rounded-xl border border-slate-300 px-2 text-center text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:w-32 sm:flex-col sm:items-end">
                      <Price finalRp={line.priceRp * line.quantity} size="sm" />
                      <Button variant="danger" onClick={() => removeLine(key)}>
                        Hapus
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>

          <aside className="sticky top-24 h-fit space-y-6">
            <Card className="space-y-4 p-6">
              <h2 className="text-lg font-bold tracking-tight text-ink">Ringkasan</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Jumlah item</dt>
                  <dd className="font-medium text-ink">{lines.reduce((sum, line) => sum + line.quantity, 0)}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base">
                  <dt className="font-semibold text-ink">Total estimasi</dt>
                  <dd>
                    <Price finalRp={cartTotal()} />
                  </dd>
                </div>
              </dl>
              <ButtonLink to="/checkout" className="w-full">
                Lanjut checkout
              </ButtonLink>
              <p className="text-center text-sm text-muted">Checkout memerlukan akun pembeli.</p>
            </Card>
            <Alert tone="info">Total final dan ketersediaan stok dihitung ulang di server saat pesanan dibuat.</Alert>
          </aside>
        </div>
      )}
    </div>
  );
}
