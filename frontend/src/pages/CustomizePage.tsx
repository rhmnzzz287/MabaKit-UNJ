import { useEffect, useMemo, useState } from "react";
import { ApiError, get } from "../lib/api";
import { addToCart } from "../lib/cart";
import { variantLabel } from "../lib/format";
import { navigate } from "../lib/router";
import type { CatalogResponse, PackageQuote } from "../lib/types";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  Field,
  Input,
  Link,
  Price,
  ProductPhoto,
  Select,
  Spinner,
} from "../components/ui";

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
        <h1 className="text-2xl font-bold tracking-tight text-ink">Sesuaikan paket</h1>
        <Alert tone="error">{error}</Alert>
        <ButtonLink to="/catalog" variant="secondary">
          Kembali ke katalog
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <nav aria-label="Remah roti" className="text-sm text-muted">
        <Link to="/catalog" className="font-medium text-brand-dark hover:underline">
          Paket dan Produk
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{quote?.package.title ?? "Paket"}</span>
      </nav>

      <div className="space-y-3">
        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">
          {quote?.package.title ?? "Sesuaikan paket"}
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          Pilih fakultas untuk melihat isi paket, harga, dan stok yang berlaku.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        <div className="space-y-6">
          <Card className="space-y-3 p-6">
            <Field id="faculty" label="Fakultas" hint="Mengganti fakultas mengganti isi, foto, harga, dan stok paket.">
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
            </Field>
            <p className="text-sm text-muted">Keranjang tidak otomatis diperbarui saat fakultas diganti.</p>
          </Card>

          {state === "loading" ? <Spinner label="Menghitung paket" /> : null}
          {error && quote ? <Alert tone="error">{error}</Alert> : null}

          {quote ? (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-6">
                <h2 className="text-xl font-bold tracking-tight text-ink">Isi paket untuk {quote.faculty.name}</h2>
                <span className="rounded-full bg-brand-tint px-3 py-1 text-xs font-bold text-brand-dark">
                  {quote.components.length} komponen
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {quote.components.map((component) => (
                  <li key={component.variantId} className="flex flex-wrap items-center gap-4 p-6">
                    <ProductPhoto
                      src={component.imagePath}
                      alt={`Foto ${component.title} ${variantLabel(component.attributes)}`}
                      className="h-20 w-24 rounded-lg border border-slate-200"
                      width={480}
                      height={320}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-semibold text-ink">{component.title}</p>
                      <p className="text-sm text-muted">{variantLabel(component.attributes) || component.sku}</p>
                      <p className="text-sm text-muted">
                        {component.quantity} unit x <Price finalRp={component.unitPriceRp} size="sm" />
                      </p>
                    </div>
                    <p className="font-bold text-ink">
                      <Price finalRp={component.lineTotalRp} size="sm" />
                    </p>
                  </li>
                ))}
              </ul>
              <div className="space-y-2 bg-slate-50 p-6">
                <p className="flex justify-between text-sm">
                  <span className="text-muted">Total satuan</span>
                  <span className="font-semibold text-ink">
                    <Price finalRp={quote.unitTotalRp} size="sm" />
                  </span>
                </p>
                {quote.savingsRp > 0 ? (
                  <p className="flex justify-between text-sm text-brand-dark">
                    <span>Selisih paket</span>
                    <span className="font-semibold">-{quote.savingsRp.toLocaleString("id-ID")} rupiah</span>
                  </p>
                ) : null}
              </div>
            </Card>
          ) : null}

          <Card className="space-y-3 p-6">
            <h2 className="text-xl font-bold tracking-tight text-ink">Daftar periksa</h2>
            <p className="text-sm text-muted">
              Daftar referensi MabaKit, bukan kewajiban resmi fakultas atau program studi.
            </p>
            {CHECKLIST.map((item) => (
              <label key={item} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-1 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="size-5 rounded border-slate-400 text-brand focus:ring-brand"
                  checked={checked.includes(item)}
                  onChange={(event) =>
                    setChecked((current) => (event.target.checked ? [...current, item] : current.filter((value) => value !== item)))
                  }
                />
                <span className="text-ink">{item}</span>
              </label>
            ))}
          </Card>
        </div>

        <Card className="sticky top-24 h-fit space-y-6 p-6">
          <div className="space-y-2">
            <p className="text-sm text-muted">Total paket</p>
            <Price finalRp={quote?.priceRp ?? 0} size="lg" />
            <p className={`text-sm font-medium ${quote?.available ? "text-brand-dark" : "text-danger"}`}>
              {quote ? (quote.available ? `Stok paket: ${quote.stock}` : "Stok paket habis untuk fakultas ini") : "Pilih fakultas"}
            </p>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <Field id="package-quantity" label="Jumlah paket">
              <Input
                id="package-quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={maxQuantity}
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Math.min(maxQuantity, Number(event.target.value) || 1)))}
              />
            </Field>
          </div>

          <Button
            full
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
            Harga dan stok dihitung ulang di server saat checkout. Paket fakultas berbeda menjadi baris keranjang
            terpisah.
          </p>
        </Card>
      </div>
    </div>
  );
}
