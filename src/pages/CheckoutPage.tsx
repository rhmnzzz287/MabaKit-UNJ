import { useEffect, useState } from "react";
import { ApiError, ensureSession, post } from "../lib/api";
import { cartLines, cartTotal, checkoutPayload, clearCart, subscribeCart } from "../lib/cart";
import { rupiah } from "../lib/format";
import { navigate } from "../lib/router";
import type { Order } from "../lib/types";
import { Alert, Button, Field, Input, Link, PageHeader, SimulasiBadge } from "../components/ui";

const METHODS = [
  { value: "BANK_TRANSFER", label: "Transfer bank (simulasi)" },
  { value: "EWALLET", label: "E-wallet (simulasi)" },
  { value: "QRIS", label: "QRIS (simulasi)" },
] as const;

export default function CheckoutPage() {
  const [lines, setLines] = useState(cartLines);
  const [buyerName, setBuyerName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("BANK_TRANSFER");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeCart(() => setLines(cartLines())), []);

  if (lines.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Checkout" />
        <Alert tone="warn">Keranjang kosong. Tambahkan produk sebelum checkout.</Alert>
        <Link to="/" className="font-semibold text-brand underline">
          Lihat katalog
        </Link>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldError(null);
    setBusy(true);
    try {
      await ensureSession();
      const body = await post<{ order: Order }>(
        "/api/checkout/create",
        checkoutPayload({ buyerName, recipientName, contactPhone, method }),
      );
      clearCart();
      navigate(`/orders/${body.order.id}/payment`);
    } catch (issue) {
      if (issue instanceof ApiError) {
        if (issue.code === "invalid_phone" || issue.code === "invalid_name") setFieldError(issue.message);
        else setError(issue.message);
      } else {
        setError("Checkout gagal. Coba lagi.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <PageHeader title="Checkout" description="Isi data fiktif untuk demo. Tidak ada email, OTP, atau pembayaran nyata." />
      <SimulasiBadge />

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <Field id="buyerName" label="Nama pemesan">
            <Input
              id="buyerName"
              name="buyerName"
              value={buyerName}
              onChange={(event) => setBuyerName(event.target.value)}
              autoComplete="name"
              required
              maxLength={80}
              aria-describedby={fieldError ? "buyerName-error" : undefined}
            />
          </Field>
          <Field id="recipientName" label="Nama penerima" hint="Boleh sama dengan nama pemesan.">
            <Input
              id="recipientName"
              name="recipientName"
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              maxLength={80}
              required
            />
          </Field>
          <Field id="contactPhone" label="Nomor WhatsApp" hint="Format 08xx. Nomor uji saja, jangan data pribadi nyata." error={fieldError ?? undefined}>
            <Input
              id="contactPhone"
              name="contactPhone"
              inputMode="tel"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              autoComplete="tel"
              required
              aria-describedby={fieldError ? "contactPhone-error" : "contactPhone-hint"}
            />
          </Field>

          <fieldset className="space-y-2">
            <legend className="font-medium text-ink">Metode pembayaran</legend>
            {METHODS.map((option) => (
              <label key={option.value} className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 px-3">
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
            <p className="text-sm text-muted">Tidak ada nomor rekening atau QR nyata di demo ini.</p>
          </fieldset>

          <div className="rounded-lg bg-brand-tint p-3 text-sm text-brand-dark">
            <p className="font-semibold">Pengambilan barang</p>
            <p>Lokasi dan jam layanan muncul di halaman pembayaran dan invoice. Tanpa jadwal atau slot pickup.</p>
          </div>
        </div>

        <aside className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-ink">Rincian</h2>
          <ul className="space-y-2 text-sm">
            {lines.map((line) => (
              <li key={`${line.productId}:${line.variantId ?? ""}`} className="flex justify-between gap-2">
                <span className="text-muted">
                  {line.title} x {line.quantity}
                </span>
                <span className="font-medium text-ink">{rupiah(line.priceRp * line.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between border-t border-slate-200 pt-2 text-lg">
            <span>Total</span>
            <strong>{rupiah(cartTotal())}</strong>
          </p>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Membuat pesanan..." : "Lanjut ke pembayaran simulasi"}
          </Button>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <p className="text-sm text-muted">Draft berlaku 30 menit. Setelah itu stok dilepas otomatis.</p>
        </aside>
      </div>
    </form>
  );
}
