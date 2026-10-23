import { useEffect, useMemo, useState } from "react";
import { get } from "../lib/api";
import { addToCart } from "../lib/cart";
import { rupiah, variantLabel } from "../lib/format";
import { navigate } from "../lib/router";
import type { Product } from "../lib/types";
import { Alert, Button, Field, Input, Link, PageHeader, ProductPhoto, Select, Spinner } from "../components/ui";

export default function ProductPage({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [variantId, setVariantId] = useState("");
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
        <Link to="/catalog" className="font-semibold text-brand underline">
          Kembali ke katalog
        </Link>
      </div>
    );
  }
  if (!product) return <Spinner label="Memuat produk" />;

  if (product.kind === "bundle") {
    return (
      <div className="space-y-6">
        <nav aria-label="Remah roti" className="text-sm">
          <Link to="/catalog" className="text-brand underline">
            Paket dan Produk
          </Link>
          <span className="text-muted"> / {product.title}</span>
        </nav>
        <PageHeader title={product.title} description={product.description} />
        <Alert tone="info">
          Isi dan harga paket bergantung pada fakultas. Sesuaikan paket untuk melihat rincian dan stok yang benar.
        </Alert>
        <div className="flex flex-wrap gap-3">
          <Link
            to={`/packages/${product.id}/customize`}
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand-dark"
          >
            Sesuaikan paket
          </Link>
          <Link
            to="/catalog"
            className="inline-flex min-h-12 items-center justify-center rounded-lg border border-line bg-white px-5 font-semibold text-ink"
          >
            Kembali ke katalog
          </Link>
        </div>
      </div>
    );
  }

  const available = variant?.stock ?? 0;
  const unitPrice = variant?.priceRp ?? product.priceRp;

  return (
    <div className="space-y-6">
      <nav aria-label="Remah roti" className="text-sm">
        <Link to="/catalog" className="text-brand underline">
          Paket dan Produk
        </Link>
        <span className="text-muted"> / {product.title}</span>
      </nav>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <ProductPhoto
            src={variant?.imagePath ?? product.imagePath}
            srcSet480={variant?.imagePath480 ?? null}
            alt={variant ? `Foto ${product.title} ${variantLabel(variant.attributes)}` : `Foto ${product.title}`}
            className="h-64 w-full rounded-xl border border-slate-200 sm:h-80"
            eager
          />
          <PageHeader title={product.title} description={product.description} />
          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <div>
              <dt className="text-muted">Jenis</dt>
              <dd className="font-semibold text-ink">Satuan</dd>
            </div>
            <div>
              <dt className="text-muted">Ketersediaan</dt>
              <dd className="font-semibold text-ink">{available > 0 ? `${available} tersedia` : "Habis"}</dd>
            </div>
            {variant ? (
              <div className="col-span-2">
                <dt className="text-muted">Spesifikasi</dt>
                <dd className="font-semibold text-ink">{variantLabel(variant.attributes)}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <aside className="h-fit space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-2xl font-bold text-ink">{rupiah(unitPrice)}</p>
          {(product.discountBasisPoints ?? 0) > 0 ? (
            <p className="text-sm text-muted">
              <s>{rupiah(variant?.basePriceRp ?? product.basePriceRp ?? unitPrice)}</s> · diskon{" "}
              {(product.discountBasisPoints ?? 0) / 100}%
            </p>
          ) : null}
          <p className="text-sm text-muted">Harga per unit, dihitung ulang di server saat checkout.</p>

          {product.variants.length > 1 ? (
            <Field id="variant" label="Pilih varian">
              <Select id="variant" value={variantId} onChange={(event) => setVariantId(event.target.value)}>
                {product.variants.map((item) => (
                  <option key={item.id} value={item.id} disabled={item.stock < 1}>
                    {variantLabel(item.attributes) || item.sku} ({item.stock} tersedia)
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field id="quantity" label="Jumlah">
            <Input
              id="quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={Math.max(1, Math.min(99, available))}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Math.min(99, Number(event.target.value) || 1)))}
            />
          </Field>

          <Button
            className="w-full"
            disabled={available < 1}
            onClick={() => {
              if (available < 1) return;
              if (!variant) {
                setNotice("Pilih varian terlebih dahulu.");
                return;
              }
              addToCart({
                productId: product.id,
                variantId: variant.id,
                facultyId: null,
                facultyName: null,
                title: product.title,
                variantLabel: variantLabel(variant.attributes),
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
