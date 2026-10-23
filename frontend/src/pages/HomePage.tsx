import { useEffect, useState } from "react";
import { get } from "../lib/api";
import { rupiah } from "../lib/format";
import type { CatalogResponse } from "../lib/types";
import { Alert, Link, PageHeader, ProductPhoto, Spinner } from "../components/ui";

const STEPS = [
  "Pilih paket sesuai fakultas.",
  "Sesuaikan isi dan jumlah di halaman penyesuaian.",
  "Masuk, checkout, lalu ikuti status pesanan sampai diambil.",
];

const VALUES = [
  {
    title: "Satu paket, isi lengkap",
    body: "Topi, kipas, kaus kaki, dan perlengkapan lain disusun per fakultas supaya tidak belanja terpisah.",
  },
  {
    title: "Harga terlihat sebelum bayar",
    body: "Rincian komponen dan total ditampilkan di halaman penyesuaian, lalu dihitung ulang di server saat checkout.",
  },
  {
    title: "Status pesanan jelas",
    body: "Lacak dari menunggu pembayaran, disiapkan, siap diambil, sampai diterima.",
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

  return (
    <div className="space-y-12">
      <section className="grid items-center gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-5">
          <p className="inline-flex rounded-full bg-brand-tint px-3 py-1 text-sm font-semibold text-brand-dark">
            Perlengkapan PKKMB untuk mahasiswa baru UNJ
          </p>
          <h1 className="text-3xl font-bold leading-tight text-ink sm:text-4xl">
            Siapkan kebutuhan ospek dalam satu paket, sesuai fakultas.
          </h1>
          <p className="max-w-xl text-lg text-muted">
            Membeli perlengkapan PKKMB satu per satu memakan waktu dan rawan ada yang terlewat. MabaKit menyusun
            komponennya per fakultas, dengan harga dan isi yang bisa diperiksa sebelum checkout.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/catalog"
              className="inline-flex min-h-12 items-center rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand-dark"
            >
              Lihat paket
            </Link>
            <Link
              to="/about"
              className="inline-flex min-h-12 items-center rounded-lg border border-line bg-white px-5 font-semibold text-ink hover:bg-brand-tint"
            >
              Tentang MabaKit
            </Link>
          </div>
          <p className="text-sm text-muted">Katalog dan keranjang dapat dilihat tanpa akun. Checkout memerlukan akun pembeli.</p>
        </div>
        <ProductPhoto
          src="/products/topi-feb-960.webp"
          srcSet480="/products/topi-feb-480.webp"
          alt="Topi PKKMB putih dengan label fakultas"
          className="h-64 w-full rounded-xl border border-slate-200 bg-white sm:h-80"
          eager
        />
      </section>

      <section aria-labelledby="paket-utama" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="paket-utama" className="text-2xl font-bold text-ink">
              Paket sesuai fakultas
            </h2>
            <p className="text-muted">Pilih fakultas untuk melihat isi, foto, harga, dan stok yang berlaku.</p>
          </div>
          <Link to="/catalog" className="font-semibold text-brand underline">
            Semua paket dan produk
          </Link>
        </div>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {!data && !error ? <Spinner label="Memuat paket" /> : null}
        {data && data.packages.length === 0 ? (
          <Alert tone="info">Belum ada paket yang dipublikasikan.</Alert>
        ) : null}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.packages ?? []).slice(0, 3).map((product) => (
            <li key={product.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-lg font-semibold text-ink">{product.title}</h3>
              <p className="flex-1 text-sm text-muted">{product.description}</p>
              <p className="text-lg font-bold text-ink">Mulai {rupiah(product.finalPriceRp ?? product.priceRp)}</p>
              <p className="text-sm text-muted">{(product.facultyOptions ?? []).length} pilihan fakultas</p>
              <Link
                to={`/packages/${product.id}/customize`}
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand px-4 font-semibold text-white hover:bg-brand-dark"
              >
                Sesuaikan paket
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="nilai" className="space-y-4">
        <h2 id="nilai" className="text-2xl font-bold text-ink">
          Kenapa memilih paket
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {VALUES.map((value) => (
            <li key={value.title} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-ink">{value.title}</h3>
              <p className="text-sm text-muted">{value.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cara-pesan" className="grid gap-6 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-2">
          <h2 id="cara-pesan" className="text-2xl font-bold text-ink">
            Cara memesan
          </h2>
          <p className="text-muted">Tiga langkah, tanpa perlu menghubungi admin untuk memesan.</p>
          <Link to="/contact" className="font-semibold text-brand underline">
            Ada pertanyaan? Hubungi kami
          </Link>
        </div>
        <ol className="space-y-3">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-tint font-semibold text-brand-dark">
                {index + 1}
              </span>
              <span className="text-ink">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <PageHeader
        title="Ambil di kampus, tanpa kurir"
        description="Pengambilan dilakukan di lokasi yang tertera pada halaman pembayaran dan invoice setelah pesanan siap. Layanan kurir belum tersedia pada versi ini."
      />
    </div>
  );
}
