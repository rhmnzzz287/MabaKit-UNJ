import { useEffect, useMemo, useState } from "react";
import { get } from "../lib/api";
import { rupiah } from "../lib/format";
import type { CatalogResponse, Faculty, Product } from "../lib/types";
import { Alert, Button, ButtonLink, Card, Link, PageHeader, Price, ProductPhoto, SectionTitle, Select, Spinner } from "../components/ui";

function PackageCard({ product, facultyId }: { product: Product; facultyId: string }) {
  const options = product.facultyOptions ?? [];
  const selected = options.find((option) => option.facultyId === facultyId);
  const stock = selected ? selected.stock : product.stock;
  return (
    <Card className="card-lift group flex h-full flex-col overflow-hidden hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg">
      <ProductPhoto
        src={product.imagePath}
        alt={`Foto ${product.title}`}
        className="h-44 w-full border-b border-slate-100"
      />
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-ink">
            <Link to={`/packages/${product.id}/customize`} className="hover:underline">
              {product.title}
            </Link>
          </h2>
          <span className="shrink-0 rounded-full bg-brand-tint px-3 py-1 text-xs font-bold text-brand-dark">Paket</span>
        </div>
        <p className="text-sm leading-relaxed text-muted">{product.description}</p>
        <div className="mt-auto space-y-2">
          {selected ? (
            <Price finalRp={selected.priceRp} />
          ) : (
            <p className="text-lg font-bold tracking-tight text-ink">{`Mulai ${rupiah(product.priceRp)}`}</p>
          )}
          <p className="text-sm text-muted">
            {selected
              ? `Untuk ${selected.facultyName}. Stok tersedia ${selected.stock}.`
              : `${options.length} pilihan fakultas. Pilih fakultas untuk melihat isi dan harga.`}
          </p>
          <p className={`text-sm font-medium ${stock > 0 ? "text-brand-dark" : "text-danger"}`}>
            {stock > 0 ? "Siap dipesan" : "Stok habis"}
          </p>
        </div>
        <ButtonLink to={`/packages/${product.id}/customize`}>Sesuaikan paket</ButtonLink>
      </div>
    </Card>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <Card className="card-lift group flex h-full flex-col overflow-hidden hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg">
      <ProductPhoto
        src={product.imagePath}
        alt={`Foto ${product.title}`}
        className="h-44 w-full border-b border-slate-100"
      />
      <div className="flex flex-1 flex-col gap-3 p-6">
        <h2 className="text-lg font-bold tracking-tight text-ink">
          <Link to={`/products/${product.id}`} className="hover:underline">
            {product.title}
          </Link>
        </h2>
        <p className="text-sm leading-relaxed text-muted">{product.description}</p>
        <div className="mt-auto space-y-2">
          <Price
            finalRp={product.finalPriceRp ?? product.priceRp}
            baseRp={product.basePriceRp}
            discountBasisPoints={product.discountBasisPoints}
          />
          <p className={`text-sm font-medium ${product.stock > 0 ? "text-brand-dark" : "text-danger"}`}>
            {product.stock > 0 ? `Stok tersedia: ${product.stock}` : "Stok habis"}
          </p>
        </div>
        <ButtonLink to={`/products/${product.id}`} variant="secondary">
          Lihat detail
        </ButtonLink>
      </div>
    </Card>
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
    <div className="space-y-12">
      <PageHeader
        title="Paket dan Produk"
        description="Paket disusun per fakultas. Harga dan stok adalah data uji, bukan penawaran resmi kampus."
      />

      {error ? (
        <div className="space-y-4">
          <Alert tone="error">{error}</Alert>
          <Button variant="secondary" onClick={() => setReload((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      ) : null}
      {!data && !error ? <Spinner label="Memuat katalog" /> : null}

      {data ? (
        <>
          <section aria-labelledby="paket-heading" className="space-y-6">
            <SectionTitle
              id="paket-heading"
              title="Paket"
              description="Isi paket mengikuti fakultas yang dipilih."
              action={
                <div className="w-full sm:w-72">
                  <label htmlFor="faculty-filter" className="mb-2 block text-sm font-semibold text-ink">
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
              }
            />
            {packages.length === 0 ? (
              <Alert tone="warn">Belum ada paket yang dipublikasikan untuk pilihan ini.</Alert>
            ) : (
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {packages.map((product) => (
                  <li key={product.id} className="h-full">
                    <PackageCard product={product} facultyId={facultyId} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="produk-heading" className="space-y-6 border-t border-slate-200 pt-12">
            <SectionTitle
              id="produk-heading"
              title="Produk satuan"
              description="Beli satu per satu bila tidak memerlukan paket."
            />
            {filtered.length === 0 ? (
              <Alert tone="warn">Tidak ada produk satuan untuk fakultas ini.</Alert>
            ) : (
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((product) => (
                  <li key={product.id} className="h-full">
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
