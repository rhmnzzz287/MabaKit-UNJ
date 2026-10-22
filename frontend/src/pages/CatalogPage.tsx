import { useEffect, useState } from "react";
import { get } from "../lib/api";
import { rupiah } from "../lib/format";
import type { Product } from "../lib/types";
import { Alert, Link, PageHeader, ProductPhoto, Spinner } from "../components/ui";

function ProductCard({ product }: { product: Product }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <ProductPhoto
        src={product.imagePath}
        alt={`Foto ${product.title}`}
        className="h-40 w-full border-b border-slate-200"
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="text-lg font-semibold text-ink">
          <Link to={`/products/${product.id}`} className="hover:underline">
            {product.title}
          </Link>
        </h2>
        <p className="text-sm text-muted">{product.description}</p>
        <p className="mt-auto text-lg font-bold text-ink">{rupiah(product.priceRp)}</p>
        <p className={`text-sm ${product.stock > 0 ? "text-muted" : "font-medium text-danger"}`}>
          {product.stock > 0 ? `Stok tersedia: ${product.stock}` : "Stok habis"}
        </p>
        <Link
          to={`/products/${product.id}`}
          className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand px-4 font-semibold text-white hover:bg-brand-dark"
        >
          Lihat detail
        </Link>
      </div>
    </article>
  );
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setProducts(null);
    setError(null);
    get<{ products: Product[] }>("/api/catalog")
      .then((body) => {
        if (active) setProducts(body.products);
      })
      .catch((issue: unknown) => {
        if (active) setError(issue instanceof Error ? issue.message : "Katalog gagal dimuat.");
      });
    return () => {
      active = false;
    };
  }, [reload]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perlengkapan PKKMB"
        description="Katalog contoh untuk demo simulasi. Harga dan stok adalah data uji, bukan penawaran resmi kampus."
      />
      {error ? (
        <div className="space-y-3">
          <Alert tone="error">{error}</Alert>
          <button
            type="button"
            onClick={() => setReload((value) => value + 1)}
            className="min-h-12 rounded-lg border border-line bg-white px-4 font-semibold text-ink"
          >
            Coba lagi
          </button>
        </div>
      ) : null}
      {!products && !error ? <Spinner label="Memuat katalog" /> : null}
      {products && products.length === 0 ? (
        <Alert tone="warn">Belum ada produk aktif. Hubungi admin untuk membuka katalog.</Alert>
      ) : null}
      {products && products.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm text-muted">Setiap paket berisi beberapa barang. Rincian komponen tertera di halaman produk.</p>
    </div>
  );
}
