import { useEffect, useRef, useState } from "react";
import { ApiError, get, post } from "../lib/api";
import { cartLines, cartTotal, checkoutPayload, clearCart, lineKey, newCheckoutKey, subscribeCart, updateLine } from "../lib/cart";
import { rupiah } from "../lib/format";
import { navigate } from "../lib/router";
import type { CatalogResponse, PackageQuote, Profile } from "../lib/types";
import { useWorkspace } from "../lib/workspace";
import { Alert, Button, Field, Input, Link, PageHeader, SimulasiBadge, Spinner } from "../components/ui";

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

  const payloadPreview = JSON.stringify(checkoutPayload({ buyerName, contactPhone, email, method }));

  /** Ambil harga server terbaru. Perubahan harga harus dikonfirmasi pembeli sebelum order dibuat. */
  async function requote(): Promise<string | null> {
    const catalog = await get<CatalogResponse>("/api/catalog");
    const note: string[] = [];
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
      if (priceRp === null) return `${line.title} sudah tidak tersedia. Hapus dari keranjang untuk melanjutkan.`;
      if (priceRp !== line.priceRp) {
        note.push(`${line.title}: ${rupiah(line.priceRp)} menjadi ${rupiah(priceRp)}`);
        updateLine(lineKey(line), { priceRp });
      }
    }
    return note.length
      ? `Harga berubah dan sudah diperbarui di keranjang. Periksa total baru lalu tekan Buat pesanan lagi untuk menyetujui. ${note.join("; ")}`
      : null;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldError({});
    try {
      const changed = await requote();
      if (changed) {
        setError(changed);
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
      <div className="space-y-4">
        <PageHeader title="Checkout" />
        <Alert tone="info">Keranjang kosong. Tambahkan paket atau produk terlebih dahulu.</Alert>
        <Link to="/catalog" className="font-semibold text-brand underline">
          Lihat katalog
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Checkout"
          description="Pesanan dibuat atas nama akun yang sedang masuk. Kontak di bawah menjadi snapshot pesanan ini."
        />
        <SimulasiBadge />
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4" noValidate>
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
          <Field id="contactPhone" label="Nomor WhatsApp" hint="Dipakai tim untuk mencocokkan pesanan saat pengambilan." error={fieldError.contactPhone}>
            <Input
              id="contactPhone"
              inputMode="tel"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              autoComplete="tel"
              required
            />
          </Field>
          <Field id="email" label="Email pesanan" hint="Hanya untuk pratinjau invoice. Tidak ada email dikirim." error={fieldError.email}>
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

          <fieldset className="space-y-2">
            <legend className="font-medium text-ink">Metode pengambilan</legend>
            <label className="flex min-h-12 items-center gap-4 rounded-lg border border-slate-200 px-4">
              <input type="radio" name="delivery" value="pickup" checked readOnly className="size-4" />
              <span className="text-ink">Ambil di kampus</span>
            </label>
            <label className="flex min-h-12 items-center gap-4 rounded-lg border border-slate-200 px-4 opacity-60">
              <input type="radio" name="delivery" value="courier" disabled className="size-4" />
              <span className="text-muted">Kurir, segera tersedia</span>
            </label>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="font-medium text-ink">Metode pembayaran simulasi</legend>
            {METHODS.map((option) => (
              <label key={option.value} className="flex min-h-12 items-center gap-4 rounded-lg border border-slate-200 px-4">
                <input
                  type="radio"
                  name="method"
                  value={option.value}
                  checked={method === option.value}
                  onChange={() => setMethod(option.value)}
                  className="size-4"
                />
                <span className="text-ink">{option.label}</span>
              </label>
            ))}
          </fieldset>

          <Alert tone="info">Tidak ada pembayaran atau penagihan nyata pada versi ini.</Alert>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Membuat pesanan..." : "Buat pesanan simulasi"}
          </Button>
        </form>

        <aside className="h-fit space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-ink">Ringkasan</h2>
          <ul className="space-y-2 text-sm">
            {lines.map((line) => (
              <li key={`${line.productId}:${line.variantId ?? ""}:${line.facultyId ?? ""}`} className="flex justify-between gap-4">
                <span className="text-ink">
                  {line.title} x {line.quantity}
                  {line.facultyName ? <span className="block text-muted">Fakultas {line.facultyName}</span> : null}
                </span>
                <span className="font-medium text-ink">{rupiah(line.priceRp * line.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between border-t border-slate-200 pt-4 text-lg">
            <span>Total estimasi</span>
            <strong className="text-ink">{rupiah(cartTotal())}</strong>
          </p>
          <p className="text-sm text-muted">Harga final dan stok dihitung ulang di server saat pesanan dibuat.</p>
        </aside>
      </div>
    </div>
  );
}
