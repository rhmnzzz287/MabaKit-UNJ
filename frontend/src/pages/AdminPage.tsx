import { useCallback, useEffect, useState } from "react";
import { ApiError, get, patch, post } from "../lib/api";
import { dateTime, rupiah } from "../lib/format";
import type { AdminSummary } from "../lib/types";
import { Alert, Button, Field, Input, PageHeader, Spinner } from "../components/ui";
import { OperatorLogin } from "../components/OperatorLogin";

type AuditLog = { id: string; action: string; entityType: string; entityId: string; createdAt: number };

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [details, setDetails] = useState("");
  const [hours, setHours] = useState("");

  const load = useCallback(async () => {
    try {
      const body = await get<AdminSummary>("/api/admin/summary");
      setSummary(body);
      setLabel(body.settings?.pickup.label ?? "");
      setDetails(body.settings?.pickup.details ?? "");
      setHours(body.settings?.pickup.hours ?? "");
      const logs = await get<{ logs: AuditLog[] }>("/api/admin/audit");
      setAudit(logs.logs);
      setAuthorized(true);
    } catch (issue) {
      if (issue instanceof ApiError && (issue.status === 401 || issue.status === 403)) {
        setAuthorized(false);
        return;
      }
      setError(issue instanceof Error ? issue.message : "Data admin gagal dimuat.");
      setAuthorized(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Aksi gagal.");
    } finally {
      setBusy(false);
    }
  }

  if (authorized === null) return <Spinner label="Memeriksa akses admin" />;
  if (!authorized) {
    return (
      <div className="space-y-6">
        <PageHeader title="Admin" description="Area operator admin demo: katalog, stok, instruksi pickup, jeda checkout, audit." />
        <OperatorLogin role="admin" title="Masuk sebagai admin" onReady={() => void load()} />
      </div>
    );
  }
  if (!summary) return <Spinner label="Memuat data admin" />;

  return (
    <div className="space-y-8">
      <PageHeader title="Admin" description="Semua aksi tercatat di audit log. Tidak ada tombol untuk mengaktifkan gateway pembayaran." />
      {error ? <Alert tone="error">{error}</Alert> : null}

      <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Object.entries(summary.counts).map(([key, value]) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm capitalize text-muted">{key}</p>
            <p className="text-2xl font-bold text-ink">{value}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Checkout</h2>
          <Button
            variant={summary.settings?.checkoutEnabled ? "danger" : "primary"}
            disabled={busy}
            onClick={() =>
              run(() => patch("/api/admin/settings", { checkoutEnabled: !summary.settings?.checkoutEnabled }))
            }
          >
            {summary.settings?.checkoutEnabled ? "Jeda checkout" : "Buka checkout"}
          </Button>
        </div>
        <p className="text-sm text-muted">
          Status: {summary.settings?.checkoutEnabled ? "terbuka" : "ditutup"}. Menutup checkout tidak mengubah pesanan
          yang sudah ada.
        </p>
      </section>

      <form
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => patch("/api/admin/settings", { pickupLabel: label, pickupDetails: details, pickupServiceHours: hours }));
        }}
      >
        <h2 className="text-lg font-semibold text-ink">Instruksi pickup</h2>
        <p className="text-sm text-muted">
          Snapshot versi {summary.settings?.pickup.version ?? "-"}. Perubahan hanya berlaku untuk pesanan baru.
        </p>
        <Field id="pickup-label" label="Nama lokasi">
          <Input id="pickup-label" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={120} required />
        </Field>
        <Field id="pickup-details" label="Detail lokasi">
          <Input id="pickup-details" value={details} onChange={(event) => setDetails(event.target.value)} maxLength={300} />
        </Field>
        <Field id="pickup-hours" label="Jam layanan">
          <Input id="pickup-hours" value={hours} onChange={(event) => setHours(event.target.value)} maxLength={120} />
        </Field>
        <Button type="submit" disabled={busy}>
          Simpan instruksi
        </Button>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Stok</h2>
        <ul className="space-y-2">
          {summary.variants.map((variant) => (
            <li key={variant.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex-1">
                <p className="font-medium text-ink">
                  {variant.title} ({variant.sku})
                </p>
                <p className="text-sm text-muted">
                  {rupiah(variant.priceRp)} · fisik {variant.stockOnHand} · direservasi {variant.stockReserved}
                </p>
              </div>
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = Number(new FormData(event.currentTarget).get("onHand"));
                  void run(() => post(`/api/admin/variants/${variant.id}/stock`, { onHand: value }));
                }}
              >
                <label htmlFor={`stock-${variant.id}`} className="text-sm text-muted">
                  Stok fisik
                </label>
                <Input
                  id={`stock-${variant.id}`}
                  name="onHand"
                  type="number"
                  min={variant.stockReserved}
                  defaultValue={variant.stockOnHand}
                  className="w-24"
                />
                <Button type="submit" variant="secondary" disabled={busy}>
                  Simpan
                </Button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Audit terakhir</h2>
        {audit.length === 0 ? <p className="text-muted">Belum ada catatan.</p> : null}
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white text-sm">
          {audit.map((log) => (
            <li key={log.id} className="flex flex-wrap justify-between gap-2 p-3">
              <span className="font-medium text-ink">{log.action}</span>
              <span className="text-muted">
                {log.entityType} {log.entityId.slice(0, 8)} · {dateTime(log.createdAt)} WIB
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
