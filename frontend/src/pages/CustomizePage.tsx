import { useEffect, useMemo, useState } from "react";
import { ApiError, get } from "../lib/api";
import { addToCart } from "../lib/cart";
import { rupiah, variantLabel } from "../lib/format";
import { navigate } from "../lib/router";
import type { CatalogResponse, PackageQuote } from "../lib/types";
import { Alert, Button, Link, PageHeader, ProductPhoto, Select, Spinner } from "../components/ui";

const CHECKLIST = [
  "Periksa ukuran sebelum memesan",
  "Periksa label fakultas pada tiap barang",
  "Siapkan bukti pesanan saat mengambil",
];

export default function CustomizePage({ id }: { id: string }) {
  const [faculties, setFaculties] = useState<CatalogResponse["faculties"]>([]);
  const [facultyId, setFacultyId] = useState("");
  const [quote, setQuote] = useState<PackageQuote | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    get<CatalogResponse>("/api/catalog")
      .then((body) => {
        if (!active) return;
        setFaculties(body.faculties);
        const preferred = body.faculties.find((faculty) =>
          (body.packages.find((product) => product.id === id)?.facultyOptions ?? []).some(
            (option) => option.facultyId === faculty.id,
          ),
        );
        setFacultyId(preferred?.id ?? "");
      })
      .catch((issue: unknown) => {
        if (!active) return;
        setError(issue instanceof Error ? issue.message : "Katalog gagal dimuat.");
        setState("error");
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!facultyId) return;
    let active = true;
    setState("loading");
    setError(null);
    get<PackageQuote>(`/api/packages/${id}/quote?faculty=${encodeURIComponent(facultyId)}`)
      .then((body) => {
        if (!active) return;
        setQuote(body);
        setState("ready");
      })
      .catch((issue: unknown) => {
        if (!active) return;
        setQuote(null);
        setError(issue instanceof ApiError ? issue.message : "Rincian paket gagal dimuat.");
        setState("error");
      });
    return () => {
      active = false;
    };
  }, [id, facultyId]);

  const maxQuantity = useMemo(() => Math.max(1, Math.min(99, quote?.stock ?? 1)), [quote]);

  if (state === "error" && !quote) {
    return (
      <div className="space-y-4">
        <PageHeader title="Sesuaikan paket" />
        <Alert tone="error">{error}</Alert>
        <Link to="/catalog" className="font-semibold text-brand underline">
          Kembali ke katalog
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Remah roti" className="text-sm">
        <Link to="/catalog" className="text-brand underline">
          Paket dan Produk
        </Link>
        <span className="text-muted"> / {quote?.package.title ?? "Paket"}</span>
      </nav>
      <PageHeader
        title={quote?.package.title ?? "Sesuaikan paket"}
        description="Pilih fakultas untuk melihat isi paket, harga, dan stok yang berlaku."
      />

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label htmlFor="faculty" className="mb-2 block font-medium text-ink">
              Fakultas
            </label>
            <Select
              id="faculty"
              value={facultyId}
              onChange={(event) => {
                const next = event.target.value;
                if (quote && next !== facultyId) {
                  const confirmed = window.confirm(
                    `Ganti fakultas ke ${faculties.find((faculty) => faculty.id === next)?.name ?? "pilihan baru"}? Isi paket, foto, harga, dan stok akan dihitung ulang.`,
                  );
                  if (!confirmed) return;
                }
                setFacultyId(next);
                setNotice(null);
              }}
            >
              <option value="">Pilih fakultas</option>
              {faculties.map((faculty) => (
                <option key={faculty.id} value={faculty.id}>
                  {faculty.name}
                </option>
              ))}
            </Select>
            <p className="mt-2 text-sm text-muted">
              Mengganti fakultas mengganti isi, foto, harga, dan stok paket. Keranjang tidak otomatis diperbarui.
            </p>
          </div>

          {state === "loading" ? <Spinner label="Menghitung paket" /> : null}
          {error && quote ? <Alert tone="error">{error}</Alert> : null}

          {quote ? (
            <section aria-labelledby="isi-paket" className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
              <h2 id="isi-paket" className="text-lg font-semibold text-ink">
                Isi paket untuk {quote.faculty.name}
              </h2>
              <ul className="space-y-4">
                {quote.components.map((component) => (
                  <li key={component.variantId} className="flex flex-wrap items-center gap-4 border-b border-slate-100 pb-4">
                    <ProductPhoto
                      src={component.imagePath}
                      alt={`Foto ${component.title} ${variantLabel(component.attributes)}`}
                      className="h-20 w-24 rounded-lg border border-slate-200"
                      width={480}
                      height={320}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-ink">{component.title}</p>
                      <p className="text-sm text-muted">{variantLabel(component.attributes)}</p>
                      <p className="text-sm text-muted">
                        {component.quantity} unit, {rupiah(component.unitPriceRp)} per unit
                      </p>
                    </div>
                    <p className="font-semibold text-ink">{rupiah(component.lineTotalRp)}</p>
                  </li>
                ))}
              </ul>
              <p className="flex justify-between border-t border-slate-200 pt-4">
                <span className="text-muted">Total satuan</span>
                <span className="text-ink">{rupiah(quote.unitTotalRp)}</span>
              </p>
              {quote.savingsRp > 0 ? (
                <p className="flex justify-between text-brand-dark">
                  <span>Selisih paket</span>
                  <span>{rupiah(quote.savingsRp)}</span>
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-ink">Daftar periksa</h2>
            <p className="text-sm text-muted">Daftar referensi MabaKit, bukan kewajiban resmi fakultas atau program studi.</p>
            {CHECKLIST.map((item) => (
              <label key={item} className="flex min-h-12 items-center gap-4">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={checked.includes(item)}
                  onChange={(event) =>
                    setChecked((current) => (event.target.checked ? [...current, item] : current.filter((value) => value !== item)))
                  }
                />
                <span className="text-ink">{item}</span>
              </label>
            ))}
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-2xl font-bold text-ink">{quote ? rupiah(quote.priceRp) : "-"}</p>
          <p className="text-sm text-muted">
            {quote ? (quote.available ? `Stok paket: ${quote.stock}` : "Stok paket habis untuk fakultas ini") : "Pilih fakultas"}
          </p>

          <div className="space-y-2">
            <label htmlFor="package-quantity" className="block font-medium text-ink">
              Jumlah paket
            </label>
            <input
              id="package-quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={maxQuantity}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Math.min(maxQuantity, Number(event.target.value) || 1)))}
              className="min-h-12 w-full rounded-lg border border-line bg-white px-4 text-base"
            />
          </div>

          <Button
            className="w-full"
            disabled={!quote?.available}
            onClick={() => {
              if (!quote) return;
              addToCart({
                productId: quote.package.id,
                variantId: null,
                facultyId: quote.faculty.id,
                facultyName: quote.faculty.name,
                title: quote.package.title,
                variantLabel: quote.faculty.name,
                priceRp: quote.priceRp,
                quantity: Math.min(quantity, maxQuantity),
              });
              navigate("/cart");
            }}
          >
            {quote?.available ? "Tambah paket ke keranjang" : "Belum tersedia"}
          </Button>
          {notice ? <Alert tone="info">{notice}</Alert> : null}
          <p className="text-sm text-muted">
            Harga dan stok dihitung ulang di server saat checkout. Paket fakultas berbeda menjadi baris keranjang terpisah.
          </p>
        </aside>
      </div>
    </div>
  );
}
