import { useEffect, useState } from "react";
import { get } from "../lib/api";
import type { CatalogResponse } from "../lib/types";
import { Alert, ButtonLink, Card, Link, Price, ProductPhoto, SectionTitle, Spinner } from "../components/ui";

const STEPS = [
  { title: "Pilih paket", body: "Tentukan fakultas, lalu periksa isi dan harga paketnya." },
  { title: "Sesuaikan", body: "Ubah jumlah komponen dan lihat total sebelum masuk keranjang." },
  { title: "Checkout dan lacak", body: "Masuk, checkout, lalu ikuti status sampai barang diambil." },
];

const VALUES = [
  {
    title: "Isi lengkap per fakultas",
    body: "Topi, kipas, kaus kaki, dan komponen lain disusun mengikuti kebutuhan fakultas, bukan daftar belanja terpisah.",
  },
  {
    title: "Harga diperiksa server",
    body: "Total di halaman penyesuaian dihitung ulang saat checkout, jadi harga dan stok tidak bisa diubah dari browser.",
  },
  {
    title: "Status yang bisa diikuti",
    body: "Empat tahap jelas: menunggu pembayaran, sedang disiapkan, siap diambil, dan sudah diterima.",
  },
];

export default function HomePage() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
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
  }, []);

  const packages = (data?.packages ?? []).slice(0, 3);
  const cheapest = packages.reduce<number | null>((lowest, item) => {
    const value = item.finalPriceRp ?? item.priceRp;
    return lowest === null || value < lowest ? value : lowest;
  }, null);

  return (
    <div className="space-y-16">
      <section className="hero-wash -mx-4 overflow-hidden rounded-b-3xl px-4 pb-12 pt-8 sm:-mx-8 sm:px-8">
        <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-sm font-semibold text-brand-dark">
              <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
              Perlengkapan PKKMB mahasiswa baru UNJ
            </p>
            <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-ink sm:text-5xl">
              Satu paket, semua kebutuhan ospek.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted">
              Belanja perlengkapan PKKMB satu per satu mudah ada yang terlewat. MabaKit menyusun komponennya per
              fakultas, dengan isi, harga, dan stok yang bisa diperiksa sebelum checkout.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink to="/catalog">Lihat paket</ButtonLink>
              <ButtonLink to="/about" variant="secondary">
                Cara kerja MabaKit
              </ButtonLink>
            </div>
            <dl className="grid max-w-lg grid-cols-2 gap-x-6 gap-y-4 border-t border-emerald-200/70 pt-6 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-muted">Paket siap pakai</dt>
                <dd className="text-xl font-bold text-ink">{data ? packages.length : "-"}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Fakultas</dt>
                <dd className="text-xl font-bold text-ink">{data ? data.faculties.length : "-"}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Mulai dari</dt>
                <dd className="text-xl font-bold text-ink">{cheapest === null ? "-" : <Price finalRp={cheapest} size="sm" />}</dd>
              </div>
            </dl>
          </div>
          <div className="relative">
            <div className="card overflow-hidden p-2">
              <ProductPhoto
                src="/products/topi-feb-960.webp"
                srcSet480="/products/topi-feb-480.webp"
                alt="Topi PKKMB putih dengan label fakultas Ekonomi dan Bisnis"
                className="h-64 w-full rounded-xl sm:h-96"
                eager
              />
            </div>
            <p className="absolute -bottom-4 left-4 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-ink shadow-lg ring-1 ring-slate-200">
              Topi, kipas, kaus kaki, dan lainnya
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="paket-utama" className="space-y-6">
        <SectionTitle
          id="paket-utama"
          title="Paket sesuai fakultas"
          description="Setiap paket punya isi dan harga sendiri. Pilih fakultas untuk melihat rincian yang berlaku."
          action={
            <Link to="/catalog" className="text-sm font-semibold text-brand-dark underline decoration-brand/40 underline-offset-4 hover:decoration-brand">
              Semua paket dan produk
            </Link>
          }
        />
        {error ? <Alert tone="error">{error}</Alert> : null}
        {!data && !error ? <Spinner label="Memuat paket" /> : null}
        {data && data.packages.length === 0 ? <Alert tone="info">Belum ada paket yang dipublikasikan.</Alert> : null}
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((product) => (
            <li key={product.id} className="card card-lift group flex flex-col overflow-hidden hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg">
              <ProductPhoto
                src={product.imagePath}
                alt={`Paket ${product.title}`}
                className="h-44 w-full border-b border-slate-100"
              />
              <div className="flex flex-1 flex-col gap-3 p-6">
                <h3 className="text-lg font-bold tracking-tight text-ink">{product.title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-muted">{product.description}</p>
                <Price
                  finalRp={product.finalPriceRp ?? product.priceRp}
                  baseRp={product.basePriceRp}
                  discountBasisPoints={product.discountBasisPoints}
                />
                <p className="text-sm text-muted">
                  {(product.facultyOptions ?? []).length} pilihan fakultas, mulai dari harga tersebut
                </p>
                <ButtonLink to={`/packages/${product.id}/customize`} className="mt-1">
                  Sesuaikan paket
                </ButtonLink>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="nilai" className="space-y-6">
        <SectionTitle id="nilai" title="Kenapa memesan lewat paket" description="Tiga hal yang membedakan belanja satuan dengan paket fakultas." />
        <ul className="grid gap-6 md:grid-cols-3">
          {VALUES.map((value, index) => (
            <li key={value.title} className="card space-y-3 p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-tint text-sm font-black text-brand-dark">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="text-lg font-bold text-ink">{value.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{value.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cara-pesan" className="card grid gap-8 p-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:p-10">
        <div className="space-y-4">
          <h2 id="cara-pesan" className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Cara memesan
          </h2>
          <p className="text-muted">Tiga langkah, tanpa perlu menghubungi admin untuk memesan.</p>
          <Link to="/contact" className="inline-block text-sm font-semibold text-brand-dark underline decoration-brand/40 underline-offset-4 hover:decoration-brand">
            Ada pertanyaan? Hubungi kami
          </Link>
        </div>
        <ol className="space-y-6">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-black text-white">
                {index + 1}
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-ink">{step.title}</p>
                <p className="text-sm text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Card className="flex flex-wrap items-center justify-between gap-6 bg-brand-dark p-8 text-white md:p-10">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Ambil di kampus, tanpa kurir</h2>
          <p className="max-w-xl text-emerald-50">
            Lokasi pengambilan tertera di halaman pembayaran dan invoice setelah pesanan siap. Layanan kurir belum
            tersedia pada versi ini.
          </p>
        </div>
        <ButtonLink to="/catalog" variant="secondary">
          Mulai pilih paket
        </ButtonLink>
      </Card>
    </div>
  );
}
