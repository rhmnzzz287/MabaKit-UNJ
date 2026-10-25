import { useEffect, useMemo, useState } from "react";
import { get } from "../lib/api";
import { rupiah } from "../lib/format";
import type { CatalogResponse, Faculty, Product } from "../lib/types";
import { Alert, Button, ButtonLink, Card, Link, PageHeader, PhotoCarousel, Price, SectionTitle, Select, Spinner } from "../components/ui";

/** Foto varian produk satuan, tanpa duplikat: pembeli bisa lihat semua variasinya. */
function variantPhotos(product: Product) {
  const photos = product.variants.map((variant) => variant.imagePath).filter((photo): photo is string => Boolean(photo));
  if (photos.length > 0) return [...new Set(photos)];
  // Produk tanpa foto varian tetap dihitung berfoto selama punya foto utama,
  // supaya tidak ikut turun ke bawah daftar (mis. Kipas setelah foto logo dibuang).
  return product.imagePath ? [product.imagePath] : [];
}

/** Foto isi paket apa adanya: paket fakultas sudah punya foto komposit di depan. */
function packagePhotos(product: Product) {
  if (product.componentPhotos?.length) return product.componentPhotos;
  return product.imagePath ? [product.imagePath] : [];
}

/** Produk tanpa foto ditaruh paling bawah supaya grid tetap rapi. */
function photosFirst<T>(items: T[], photosOf: (item: T) => string[]) {
  return items
    .map((item, position) => ({ item, position, hasPhoto: photosOf(item).length > 0 ? 0 : 1 }))
    .sort((left, right) => left.hasPhoto - right.hasPhoto || left.position - right.position)
    .map((entry) => entry.item);
}

function PackageCard({ product, facultyId }: { product: Product; facultyId: string }) {
  const options = product.facultyOptions ?? [];
  const selected = options.find((option) => option.facultyId === facultyId);
  const stock = selected ? selected.stock : product.stock;
  // Starter Kit adalah pintu masuk ke semua paket fakultas, bukan satu paket berisi barang.
  const starter = product.id === "p-tier-starter";
  const href = starter ? "/starter-kit" : `/packages/${product.id}/customize`;
  return (
    <Card className="group flex h-full flex-col overflow-hidden transition-colors hover:border-slate-300">
      <PhotoCarousel photos={packagePhotos(product)} alt={`Foto isi ${product.title}`} className="border-b border-slate-100" />
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-ink">
            <Link to={href}>{product.title}</Link>
          </h2>
          <span className="shrink-0 rounded-md bg-brand-tint px-3 py-1 text-xs font-bold text-brand-dark">Paket</span>
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
        <ButtonLink to={href}>{starter ? "Lihat paket semua fakultas" : "Sesuaikan paket"}</ButtonLink>
      </div>
    </Card>
  );
}

function ProductCard({ product }: { product: Product }) {
  const photos = variantPhotos(product);
  return (
    <Card className="group flex h-full flex-col overflow-hidden transition-colors hover:border-slate-300">
      <PhotoCarousel
        photos={photos}
        alt={`Foto ${product.title}`}
        className="border-b border-slate-100"
      />
      <div className="flex flex-1 flex-col gap-3 p-6">
        <h2 className="text-lg font-bold tracking-tight text-ink">
          <Link to={`/products/${product.id}`}>{product.title}</Link>
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
  // Produk satuan disaring lewat fakultas variannya, paket lewat fakultas asalnya.
  // Produk tanpa fakultas (kaus kaki, gesper, rok) tetap tampil karena berlaku untuk semua.
  const filtered = useMemo(() => {
    if (!data) return [];
    const products = !facultyId
      ? data.products
      : data.products.filter(
          (product) =>
            product.variants.every((variant) => variant.faculties.length === 0) ||
            product.variants.some((variant) => variant.faculties.includes(facultyId)),
        );
    return photosFirst(products, variantPhotos);
  }, [data, facultyId]);

  // Katalog hanya menjual 3 tier; paket per fakultas dikumpulkan di halaman Starter Kit.
  const packages = useMemo(
    () => photosFirst((data?.packages ?? []).filter((product) => !product.facultyId), packagePhotos),
    [data],
  );

  return (
    <div className="space-y-12">
      <PageHeader
        title="Paket dan Produk"
        description="Tiga paket untuk semua fakultas. Harga dan stok adalah data uji, bukan penawaran resmi kampus."
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
              description="Berlaku untuk semua fakultas. Isi dan harga menyesuaikan fakultas yang dipilih."
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
              <Alert tone="warn">Belum ada paket yang dipublikasikan.</Alert>
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
