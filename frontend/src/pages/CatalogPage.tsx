import { useEffect, useMemo, useState } from "react";
import { get } from "../lib/api";
import { rupiah } from "../lib/format";
import type { CatalogResponse, Faculty, Product } from "../lib/types";
import { Alert, Button, Link, PageHeader, ProductPhoto, Select, Spinner } from "../components/ui";

function PackageCard({ product, facultyId }: { product: Product; facultyId: string }) {
  const options = product.facultyOptions ?? [];
  const selected = options.find((option) => option.facultyId === facultyId);
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <ProductPhoto
        src={product.imagePath}
        alt={`Foto ${product.title}`}
        className="h-40 w-full border-b border-slate-200"
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="text-lg font-semibold text-ink">
          <Link to={`/packages/${product.id}/customize`} className="hover:underline">
            {product.title}
          </Link>
        </h2>
        <p className="text-sm text-muted">{product.description}</p>
        <p className="mt-auto text-lg font-bold text-ink">
          {selected ? rupiah(selected.priceRp) : `Mulai ${rupiah(product.priceRp)}`}
        </p>
        <p className="text-sm text-muted">
          {selected
            ? `Untuk ${selected.facultyName}. Stok tersedia ${selected.stock}.`
            : `Tersedia untuk ${options.length} fakultas. Pilih fakultas untuk melihat isi dan harga.`}
        </p>
        <Link
          to={`/packages/${product.id}/customize`}
          className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand px-4 font-semibold text-white hover:bg-brand-dark"
        >
          Sesuaikan paket
        </Link>
      </div>
    </article>
  );
}

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
        <div className="mt-auto flex flex-wrap items-baseline gap-2">
          <p className="text-lg font-bold text-ink">{rupiah(product.finalPriceRp ?? product.priceRp)}</p>
          {(product.discountBasisPoints ?? 0) > 0 ? (
            <>
              <p className="text-sm text-muted line-through">{rupiah(product.basePriceRp ?? product.priceRp)}</p>
              <span className="rounded bg-brand-tint px-2 py-0.5 text-xs font-bold text-brand-dark">
                -{(product.discountBasisPoints ?? 0) / 100}%
              </span>
            </>
          ) : null}
        </div>
        <p className={`text-sm ${product.stock > 0 ? "text-muted" : "font-medium text-danger"}`}>
          {product.stock > 0 ? `Stok tersedia: ${product.stock}` : "Stok habis"}
        </p>
        <Link
          to={`/products/${product.id}`}
          className="inline-flex min-h-12 items-center justify-center rounded-lg border border-line bg-white px-4 font-semibold text-ink hover:bg-brand-tint"
        >
          Lihat detail
        </Link>
      </div>
    </article>
  );
}

export default function CatalogPage() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [facultyId, setFacultyId] = useState("");

  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);
    get<CatalogResponse>("/api/catalog")
      .then((body) => {
        if (active) setData(body);
      })
      .catch((issue: unknown) => {
        if (active) setError(issue instanceof Error ? issue.message : "Katalog gagal dimuat.");
      });
    return () => {
      active = false;
    };
  }, [reload]);

  const faculties: Faculty[] = data?.faculties ?? [];
  const filtered = useMemo(() => {
    if (!data) return [];
    if (!facultyId) return data.products;
    return data.products.filter((product) => product.variants.some((variant) => variant.faculties.includes(facultyId)));
  }, [data, facultyId]);

  const packages = (data?.packages ?? []).filter(
    (product) => !facultyId || (product.facultyOptions ?? []).some((option) => option.facultyId === facultyId),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Paket dan Produk"
        description="Paket disusun per fakultas. Harga dan stok adalah data uji, bukan penawaran resmi kampus."
      />

      {error ? (
        <div className="space-y-3">
          <Alert tone="error">{error}</Alert>
          <Button variant="secondary" onClick={() => setReload((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      ) : null}
      {!data && !error ? <Spinner label="Memuat katalog" /> : null}

      {data ? (
        <>
          <section aria-labelledby="paket-heading" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="paket-heading" className="text-xl font-bold text-ink">
                  Paket
                </h2>
                <p className="text-sm text-muted">Isi paket mengikuti fakultas yang dipilih.</p>
              </div>
              <div className="w-full sm:w-72">
                <label htmlFor="faculty-filter" className="mb-1 block text-sm font-medium text-ink">
                  Filter fakultas
                </label>
                <Select id="faculty-filter" value={facultyId} onChange={(event) => setFacultyId(event.target.value)}>
                  <option value="">Semua fakultas</option>
                  {faculties.map((faculty) => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {packages.length === 0 ? (
              <Alert tone="warn">Belum ada paket yang dipublikasikan untuk pilihan ini.</Alert>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {packages.map((product) => (
                  <li key={product.id}>
                    <PackageCard product={product} facultyId={facultyId} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="produk-heading" className="space-y-4">
            <div>
              <h2 id="produk-heading" className="text-xl font-bold text-ink">
                Produk satuan
              </h2>
              <p className="text-sm text-muted">Beli satu per satu bila tidak memerlukan paket.</p>
            </div>
            {filtered.length === 0 ? (
              <Alert tone="warn">Tidak ada produk satuan untuk fakultas ini.</Alert>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((product) => (
                  <li key={product.id}>
                    <ProductCard product={product} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
