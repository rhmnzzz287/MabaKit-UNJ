import { useEffect, useMemo, useState } from "react";
import { get } from "../lib/api";
import { addToCart } from "../lib/cart";
import { rupiah, variantLabel } from "../lib/format";
import { navigate } from "../lib/router";
import type { Product } from "../lib/types";
import { Alert, Button, Link, PageHeader, Spinner } from "../components/ui";

export default function ProductPage({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    get<{ product: Product }>(`/api/catalog/${id}`)
      .then((body) => {
        if (!active) return;
        setProduct(body.product);
        setVariantId(body.product.variants[0]?.id ?? "");
      })
      .catch((issue: unknown) => {
        if (active) setError(issue instanceof Error ? issue.message : "Produk gagal dimuat.");
      });
    return () => {
      active = false;
    };
  }, [id]);

  const variant = useMemo(
    () => product?.variants.find((item) => item.id === variantId) ?? null,
    [product, variantId],
  );

  if (error) {
    return (
      <div className="space-y-4">
        <Alert tone="error">{error}</Alert>
        <Link to="/" className="font-semibold text-brand underline">
          Kembali ke katalog
        </Link>
      </div>
    );
  }
  if (!product) return <Spinner label="Memuat produk" />;

  const available = product.kind === "bundle" ? product.stock : (variant?.stock ?? 0);
  const unitPrice = product.kind === "bundle" ? product.priceRp : (variant?.priceRp ?? product.priceRp);

  return (
    <div className="space-y-6">
      <nav aria-label="Remah roti" className="text-sm">
        <Link to="/" className="text-brand underline">
          Katalog
        </Link>
        <span className="text-muted"> / {product.title}</span>
      </nav>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="flex h-56 items-center justify-center rounded-xl bg-brand-tint text-sm font-medium text-brand-dark">
            Foto belum tersedia
          </div>
          <PageHeader title={product.title} description={product.description} />
          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <div>
              <dt className="text-muted">Jenis</dt>
              <dd className="font-semibold text-ink">{product.kind === "bundle" ? "Paket" : "Satuan"}</dd>
            </div>
            <div>
              <dt className="text-muted">Ketersediaan</dt>
              <dd className="font-semibold text-ink">{available > 0 ? `${available} tersedia` : "Habis"}</dd>
            </div>
            {variant ? (
              <div>
                <dt className="text-muted">Spesifikasi</dt>
                <dd className="font-semibold text-ink">{variantLabel(variant.attributes)}</dd>
              </div>
            ) : null}
            {product.components?.length ? (
              <div className="col-span-2">
                <dt className="text-muted">Isi paket</dt>
                <dd>
                  <ul className="mt-1 space-y-1">
                    {product.components.map((component) => (
                      <li key={component.variantId} className="text-ink">
                        {component.sku} x {component.quantity}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <aside className="h-fit space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-2xl font-bold text-ink">{rupiah(unitPrice)}</p>
          <p className="text-sm text-muted">Harga per unit, dihitung ulang di server saat checkout.</p>

          {product.kind === "single" && product.variants.length > 1 ? (
            <fieldset className="space-y-2">
              <legend className="font-medium text-ink">Pilih varian</legend>
              {product.variants.map((item) => (
                <label key={item.id} className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 px-3">
                  <input
                    type="radio"
                    name="variant"
                    value={item.id}
                    checked={variantId === item.id}
                    onChange={() => setVariantId(item.id)}
                    className="size-4"
                  />
                  <span className="text-ink">
                    {variantLabel(item.attributes)} ({item.stock} tersedia)
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}

          <div className="space-y-1">
            <label htmlFor="quantity" className="block font-medium text-ink">
              Jumlah
            </label>
            <input
              id="quantity"
              type="number"
              min={1}
              max={Math.max(1, Math.min(99, available))}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Math.min(99, Number(event.target.value) || 1)))}
              className="min-h-12 w-full rounded-lg border border-line bg-white px-3 text-base"
            />
          </div>

          <Button
            className="w-full"
            disabled={available < 1}
            onClick={() => {
              if (available < 1) return;
              if (product.kind === "single" && !variant) {
                setNotice("Pilih varian terlebih dahulu.");
                return;
              }
              addToCart({
                productId: product.id,
                variantId: product.kind === "single" ? (variant?.id ?? null) : null,
                title: product.title,
                variantLabel: variant ? variantLabel(variant.attributes) : "",
                priceRp: unitPrice,
                quantity: Math.min(quantity, available),
              });
              navigate("/cart");
            }}
          >
            {available < 1 ? "Stok habis" : "Tambah ke keranjang"}
          </Button>
          {notice ? <Alert tone="error">{notice}</Alert> : null}
        </aside>
      </div>
    </div>
  );
}
