import { useEffect, useMemo, useState } from "react";
import { get } from "../lib/api";
import { rupiah } from "../lib/format";
import type { CatalogResponse, Product } from "../lib/types";
import { Alert, Button, ButtonLink, Card, PageHeader, PhotoGrid, Price, Spinner } from "../components/ui";

/** Paket fakultas = paket yang terikat satu fakultas; tier umum punya facultyId kosong. */
function isFacultyPackage(product: Product) {
  return Boolean(product.facultyId);
}

/**
 * Foto barang satu per satu, tanpa foto komposit paket.
 * Komposit sudah memuat keempat barang, jadi menampilkannya di grid hanya memakan satu sel.
 */
function gridPhotos(product: Product) {
  const items = (product.componentPhotos ?? []).filter((photo) => photo !== product.imagePath);
  if (items.length > 0) return items;
  return product.imagePath ? [product.imagePath] : [];
}

function FacultyPackageCard({ product }: { product: Product }) {
  const own = (product.facultyOptions ?? []).find((option) => option.facultyId === product.facultyId);
  const stock = own ? own.stock : product.stock;
  const href = `/packages/${product.id}/customize`;
  return (
    <Card className="card-lift group flex h-full flex-col overflow-hidden hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg">
      <PhotoGrid
        photos={gridPhotos(product)}
        alt={`Foto isi ${product.title}`}
        className="border-b border-slate-100"
        eager
      />
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-ink">{product.title}</h2>
          <span className="shrink-0 rounded-md bg-brand-tint px-3 py-1 text-xs font-bold text-brand-dark">Paket</span>
        </div>
        <p className="text-sm leading-relaxed text-muted">{product.description}</p>
        {product.componentTitles?.length ? (
          <ul className="flex flex-wrap gap-2">
            {product.componentTitles.map((title) => (
              <li key={title} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-muted">
                {title}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-auto space-y-2">
          {own ? <Price finalRp={own.priceRp} /> : <p className="text-lg font-bold tracking-tight text-ink">{`Mulai ${rupiah(product.priceRp)}`}</p>}
          <p className={`text-sm font-medium ${stock > 0 ? "text-brand-dark" : "text-danger"}`}>
            {stock > 0 ? `Stok tersedia: ${stock}` : "Stok habis"}
          </p>
        </div>
        <ButtonLink to={href}>Sesuaikan paket</ButtonLink>
      </div>
    </Card>
  );
}

export default function StarterKitPage() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

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

  const facultyPackages = useMemo(() => (data?.packages ?? []).filter(isFacultyPackage), [data]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Starter Kit"
        description="Delapan paket fakultas, masing-masing berisi slayer, topi, kipas, dan kaus kaki dengan logo fakultasnya."
      />

      {error ? (
        <div className="space-y-4">
          <Alert tone="error">{error}</Alert>
          <Button variant="secondary" onClick={() => setReload((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      ) : null}
      {!data && !error ? <Spinner label="Memuat Starter Kit" /> : null}
      {data && facultyPackages.length === 0 ? <Alert tone="warn">Belum ada paket fakultas yang dipublikasikan.</Alert> : null}

      {facultyPackages.length > 0 ? (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {facultyPackages.map((product) => (
            <li key={product.id} className="h-full">
              <FacultyPackageCard product={product} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
