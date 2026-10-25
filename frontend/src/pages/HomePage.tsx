import { useEffect, useState } from "react";
import { get } from "../lib/api";
import type { CatalogResponse } from "../lib/types";
import { rupiah } from "../lib/format";
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

  const packages = data?.packages ?? [];
  // Beranda menampilkan 3 tier saja; paket fakultas dikumpulkan di halaman Starter Kit.
  const tiers = packages.filter((product) => !product.facultyId);
  const cheapest = packages.reduce<number | null>((lowest, item) => {
    const value = item.finalPriceRp ?? item.priceRp;
    return lowest === null || value < lowest ? value : lowest;
  }, null);

  return (
    <div className="space-y-16">
      <section className="relative -mx-4 overflow-hidden rounded-b-3xl">
        <img
          src="/products/hero-beranda-960.webp"
          srcSet="/products/hero-beranda-480.webp 480w, /products/hero-beranda-960.webp 960w"
          sizes="100vw"
          alt="Suasana PKKMB di kampus, mahasiswa baru berkumpul di satu area"
          width={960}
          height={640}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
        {/* Gradien gelap dari kiri supaya teks putih tetap terbaca di atas foto. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(100deg,rgba(6,78,59,0.95)_0%,rgba(6,78,59,0.88)_45%,rgba(6,78,59,0.62)_72%,rgba(6,78,59,0.38)_100%)]"
        />
        <div className="relative px-4 pb-14 pt-14 sm:px-8 sm:pb-20 sm:pt-20 lg:px-10 lg:pb-24 lg:pt-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-end lg:gap-16">
            <div className="max-w-2xl space-y-6">
              <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Satu paket, semua kebutuhan ospek.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-emerald-50">
                Belanja perlengkapan PKKMB satu per satu mudah ada yang terlewat. MabaKit menyusun komponennya per
                fakultas, dengan isi, harga, dan stok yang bisa diperiksa sebelum checkout.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <ButtonLink to="/catalog" variant="secondary">
                  Lihat paket
                </ButtonLink>
                <Link
                  to="/about"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/60 px-6 font-semibold text-white hover:bg-white/10"
                >
                  Cara kerja MabaKit
                </Link>
              </div>
            </div>
            {/* Angka ringkas jadi baris di ponsel, baris di kanan saat layar lebar. */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/30 pt-6 sm:grid-cols-3 lg:w-full lg:max-w-sm lg:grid-cols-1 lg:gap-0 lg:justify-self-end lg:divide-y lg:divide-white/20">
              <div className="lg:flex lg:items-baseline lg:justify-between lg:py-3 lg:first:pt-0 lg:last:pb-0">
                <dt className="text-sm text-emerald-100">Paket siap pakai</dt>
                <dd className="text-xl font-bold text-white">{data ? packages.length : "-"}</dd>
              </div>
              <div className="lg:flex lg:items-baseline lg:justify-between lg:py-3 lg:first:pt-0 lg:last:pb-0">
                <dt className="text-sm text-emerald-100">Fakultas</dt>
                <dd className="text-xl font-bold text-white">{data ? data.faculties.length : "-"}</dd>
              </div>
              <div className="lg:flex lg:items-baseline lg:justify-between lg:py-3 lg:first:pt-0 lg:last:pb-0">
                <dt className="text-sm text-emerald-100">Mulai dari</dt>
                <dd className="text-xl font-bold text-white">{cheapest === null ? "-" : rupiah(cheapest)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section aria-labelledby="paket-utama" className="space-y-6">
        <SectionTitle
          id="paket-utama"
          title="Paket"
          description="Tiga paket untuk semua fakultas. Pilih fakultas untuk melihat rincian yang berlaku."
          action={
            <Link to="/catalog" className="text-sm font-semibold text-brand-dark">
              Semua paket dan produk
            </Link>
          }
        />
        {error ? <Alert tone="error">{error}</Alert> : null}
        {!data && !error ? <Spinner label="Memuat paket" /> : null}
        {data && tiers.length === 0 ? <Alert tone="info">Belum ada paket yang dipublikasikan.</Alert> : null}
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((product) => {
            const options = product.facultyOptions ?? [];
            const onlyFaculty = options.length === 1 ? options[0].facultyName : null;
            const href = product.id === "p-tier-starter" ? "/starter-kit" : `/packages/${product.id}/customize`;
            return (
            <li key={product.id} className="card group flex flex-col overflow-hidden transition-colors hover:border-slate-300">
              <ProductPhoto
                src={product.imagePath}
                srcSet480={product.imagePath?.replace("-960.webp", "-480.webp")}
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
                  {onlyFaculty ?? `${options.length} pilihan fakultas`}
                </p>
                <ButtonLink to={href} className="mt-1">
                  {product.id === "p-tier-starter" ? "Lihat paket semua fakultas" : "Sesuaikan paket"}
                </ButtonLink>
              </div>
            </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="nilai" className="space-y-6">
        <SectionTitle id="nilai" title="Kenapa memesan lewat paket" description="Tiga hal yang membedakan belanja satuan dengan paket fakultas." />
        <dl className="max-w-3xl divide-y divide-slate-200 border-y border-slate-200">
          {VALUES.map((value) => (
            <div key={value.title} className="grid gap-2 py-6 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-8">
              <dt className="text-lg font-bold tracking-tight text-ink">{value.title}</dt>
              <dd className="text-sm leading-relaxed text-muted">{value.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="cara-pesan" className="card grid gap-8 p-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:p-10">
        <div className="space-y-4">
          <h2 id="cara-pesan" className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Cara memesan
          </h2>
          <p className="text-muted">Tiga langkah, tanpa perlu menghubungi admin untuk memesan.</p>
          <Link to="/contact" className="inline-block text-sm font-semibold text-brand-dark">
            Ada pertanyaan? Hubungi kami
          </Link>
        </div>
        <ol className="space-y-6 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
          {STEPS.map((step, index) => (
            <li key={step.title} className="border-t border-slate-300 pt-4 lg:border-slate-200">
              <p className="font-semibold text-ink">
                <span className="font-bold text-brand-dark">{index + 1}. </span>
                {step.title}
              </p>
              <p className="mt-1 text-sm text-muted">{step.body}</p>
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
