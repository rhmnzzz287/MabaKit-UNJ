import { useEffect, useRef, useState } from "react";
import { ApiError, get, post } from "../lib/api";
import { cartLines, checkoutPayload, clearCart, lineKey, newCheckoutKey, subscribeCart, updateLine } from "../lib/cart";
import { rupiah } from "../lib/format";
import { navigate } from "../lib/router";
import type { CatalogResponse, PackageQuote, Profile } from "../lib/types";
import { useWorkspace } from "../lib/workspace";
import { Alert, Button, ButtonLink, Card, Field, Input, PageHeader, Price, SimulasiBadge, Spinner } from "../components/ui";

const METHODS = [
  { value: "QRIS", label: "QRIS (simulasi)" },
  { value: "BANK_TRANSFER", label: "Transfer bank (simulasi)" },
  { value: "EWALLET", label: "E-wallet (simulasi)" },
] as const;

export default function CheckoutPage() {
  const workspace = useWorkspace();
  const [lines, setLines] = useState(cartLines);
  const [buyerName, setBuyerName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<string>("QRIS");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [requoteError, setRequoteError] = useState<string | null>(null);
  const draftKey = useRef<string | null>(null);
  const fingerprint = useRef("");

  useEffect(() => subscribeCart(() => setLines(cartLines())), []);

  useEffect(() => {
    if (workspace.state === "loading") return;
    if (!workspace.user) {
      navigate("/login?next=%2Fcheckout");
      return;
    }
    let active = true;
    get<{ profile: Profile | null }>("/api/profile")
      .then((body) => {
        if (!active) return;
        setBuyerName(body.profile?.name ?? workspace.user?.name ?? "");
        setContactPhone(body.profile?.whatsapp ?? workspace.user?.whatsapp ?? "");
        setEmail(body.profile?.email ?? workspace.user?.email ?? "");
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [workspace.state, workspace.user]);

  const cartFingerprint = lines
    .map((line) => [line.productId, line.variantId ?? "", line.facultyId ?? "", line.quantity, line.priceRp].join(":"))
    .join("|");

  useEffect(() => {
    if (workspace.state === "loading" || !workspace.user || lines.length === 0) return;
    let active = true;
    void requote()
      .then((result) => {
        if (!active) return;
        if (result.error) {
          setError(result.error);
          setRequoteError(result.error);
          setServerTotal(null);
          return;
        }
        setRequoteError(null);
        setServerTotal(result.totalRp);
        if (result.note) setError(result.note);
      })
      .catch((issue: unknown) => {
        if (!active) return;
        const message = issue instanceof Error ? issue.message : "Gagal memeriksa total pesanan.";
        setError(message);
        setRequoteError(message);
        setServerTotal(null);
      });
    return () => {
      active = false;
    };
  }, [workspace.state, workspace.user, cartFingerprint]);

  const payloadPreview = JSON.stringify(checkoutPayload({ buyerName, contactPhone, email, method }));

  /** Ambil harga server terbaru. Perubahan harga harus dikonfirmasi pembeli sebelum order dibuat. */
  async function requote(): Promise<{ totalRp: number; note: string | null; error: string | null }> {
    const catalog = await get<CatalogResponse>("/api/catalog");
    const note: string[] = [];
    let totalRp = 0;
    for (const line of cartLines()) {
      let priceRp: number | null = null;
      if (line.variantId === null) {
        if (!line.facultyId) continue;
        const quote = await get<PackageQuote>(
          `/api/packages/${encodeURIComponent(line.productId)}/quote?faculty=${encodeURIComponent(line.facultyId)}`,
        );
        priceRp = quote.priceRp;
      } else {
        const product = catalog.products.find((entry) => entry.id === line.productId);
        priceRp = product?.variants.find((variant) => variant.id === line.variantId)?.priceRp ?? null;
      }
      if (priceRp === null) {
        return { totalRp: 0, note: null, error: `${line.title} sudah tidak tersedia. Hapus dari keranjang untuk melanjutkan.` };
      }
      if (priceRp !== line.priceRp) {
        note.push(`${line.title}: ${rupiah(line.priceRp)} menjadi ${rupiah(priceRp)}`);
        updateLine(lineKey(line), { priceRp });
      }
      totalRp += priceRp * line.quantity;
    }
    return {
      totalRp,
      note: note.length
        ? `Harga berubah dan sudah diperbarui di keranjang. Periksa total baru lalu tekan Buat pesanan lagi untuk menyetujui. ${note.join("; ")}`
        : null,
      error: null,
    };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldError({});
    try {
      const quote = await requote();
      setServerTotal(quote.error ? null : quote.totalRp);
      setRequoteError(quote.error);
      if (quote.error) {
        setError(quote.error);
        return;
      }
      if (quote.note) {
        setError(quote.note);
        return;
      }
      if (fingerprint.current !== payloadPreview || !draftKey.current) {
        draftKey.current = newCheckoutKey();
        fingerprint.current = payloadPreview;
      }
      const body = await post<{ order: { id: string; totalRp: number } }>("/api/checkout/create", {
        ...checkoutPayload({ buyerName, contactPhone, email, method }),
        idempotencyKey: draftKey.current,
      });
      clearCart();
      if (body.order.totalRp === 0) navigate(`/orders/${body.order.id}`);
      else navigate(`/orders/${body.order.id}/payment`);
    } catch (issue) {
      if (issue instanceof ApiError && issue.field) setFieldError({ [issue.field]: issue.message });
      else if (issue instanceof ApiError && issue.status === 401) setError("Sesi akun berakhir. Masuk kembali untuk melanjutkan.");
      else setError(issue instanceof Error ? issue.message : "Checkout gagal.");
    } finally {
      setBusy(false);
    }
  }

  if (workspace.state === "loading" || !ready) return <Spinner label="Menyiapkan checkout" />;
  if (!workspace.user) return <Spinner label="Mengalihkan ke halaman masuk" />;

  if (lines.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Checkout" />
        <Card className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <p className="text-lg font-semibold text-ink">Keranjang kosong</p>
          <p className="text-muted">Tambahkan paket atau produk terlebih dahulu.</p>
          <ButtonLink to="/catalog">Lihat katalog</ButtonLink>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Checkout"
          description="Pesanan dibuat atas nama akun yang sedang masuk. Kontak di bawah menjadi snapshot pesanan ini."
        />
        <SimulasiBadge />
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
        <form onSubmit={submit} className="space-y-8" noValidate>
          <Card className="space-y-6 p-6">
            <h2 className="text-lg font-bold tracking-tight text-ink">Kontak pesanan</h2>
            <Field id="buyerName" label="Nama pemesan" error={fieldError.buyerName}>
              <Input
                id="buyerName"
                value={buyerName}
                onChange={(event) => setBuyerName(event.target.value)}
                autoComplete="name"
                maxLength={80}
                required
              />
            </Field>
            <Field
              id="contactPhone"
              label="Nomor WhatsApp"
              hint="Dipakai tim untuk mencocokkan pesanan saat pengambilan."
              error={fieldError.contactPhone}
            >
              <Input
                id="contactPhone"
                inputMode="tel"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                autoComplete="tel"
                required
              />
            </Field>
            <Field
              id="email"
              label="Email pesanan"
              hint="Hanya untuk pratinjau invoice. Tidak ada email dikirim."
              error={fieldError.email}
            >
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                maxLength={254}
                required
              />
            </Field>
          </Card>

          <Card className="space-y-6 p-6">
            <fieldset className="space-y-3">
              <legend className="text-lg font-bold tracking-tight text-ink">Metode pengambilan</legend>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-brand bg-brand-tint px-4">
                <input type="radio" name="delivery" value="pickup" checked readOnly className="size-5 text-brand" />
                <span className="font-medium text-ink">Ambil di kampus</span>
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 opacity-70">
                <input type="radio" name="delivery" value="courier" disabled className="size-5" />
                <span className="text-muted">Kurir, segera tersedia</span>
              </label>
            </fieldset>

            {serverTotal === null ? null : serverTotal === 0 ? (
              <Alert tone="info">
                Tidak perlu pembayaran karena total pesanan ini Rp 0. Pesanan langsung dibuat tanpa metode pembayaran.
              </Alert>
            ) : (
              <>
                <fieldset className="space-y-3 border-t border-slate-200 pt-6">
                  <legend className="text-lg font-bold tracking-tight text-ink">Metode pembayaran simulasi</legend>
                  {METHODS.map((option) => (
                    <label
                      key={option.value}
                      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 transition-colors ${
                        method === option.value ? "border-brand bg-brand-tint" : "border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name="method"
                        value={option.value}
                        checked={method === option.value}
                        onChange={() => setMethod(option.value)}
                        className="size-5 text-brand"
                      />
                      <span className="text-ink">{option.label}</span>
                    </label>
                  ))}
                </fieldset>

                <Alert tone="info">Tidak ada pembayaran atau penagihan nyata pada versi ini.</Alert>
              </>
            )}

            <Button type="submit" full disabled={busy}>
              {busy ? "Membuat pesanan..." : "Buat pesanan simulasi"}
            </Button>
          </Card>
        </form>

        <Card className="sticky top-24 h-fit space-y-4 p-6">
          <h2 className="text-lg font-bold tracking-tight text-ink">Ringkasan</h2>
          <ul className="space-y-3 text-sm">
            {lines.map((line) => (
              <li key={`${line.productId}:${line.variantId ?? ""}:${line.facultyId ?? ""}`} className="flex justify-between gap-4">
                <span className="min-w-0 text-ink">
                  {line.title} x {line.quantity}
                  {line.facultyName ? <span className="block text-muted">Fakultas {line.facultyName}</span> : null}
                </span>
                <span className="shrink-0 font-medium text-ink">{rupiah(line.priceRp * line.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <span className="font-semibold text-ink">Total</span>
            {serverTotal === null ? (
              requoteError ? (
                <span className="text-sm font-medium text-danger">Total gagal diperiksa</span>
              ) : (
                <span className="text-sm text-muted">Memeriksa total...</span>
              )
            ) : (
              <Price finalRp={serverTotal} />
            )}
          </div>
          <p className="text-sm text-muted">Total di atas dihitung server. Harga final dan stok dihitung ulang saat pesanan dibuat.</p>
        </Card>
      </div>
    </div>
  );
}
