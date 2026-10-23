import { useCallback, useEffect, useState } from "react";
import { ApiError, del, get, isAuthError, patch, post, put, upload } from "../lib/api";
import { dateTime, rupiah, variantLabel } from "../lib/format";
import type { AdminCatalog, AdminKpi, AdminProduct, AdminSummary, AdminVariant, Operator } from "../lib/types";
import { useOperatorWorkspace } from "../lib/workspace";
import { Alert, Button, Field, Input, Link, PageHeader, Select, Spinner, Textarea } from "../components/ui";

type AuditLog = {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: number;
};

type FacultyRow = AdminCatalog["faculties"][number];
type ActionError = { message: string; field?: string };

/** Koma desimal Indonesia diterima: "12,5" dan "12.5" sama-sama 1250 basis poin. */
export function percentToBasisPoints(value: FormDataEntryValue | null): number {
  const text = String(value ?? "0").trim().replace(",", ".");
  const percent = Number(text === "" ? "0" : text);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return -1;
  return Math.round(percent * 100);
}

const SECTIONS = [
  { id: "ringkasan", label: "Ringkasan" },
  { id: "pesanan", label: "Pesanan" },
  { id: "katalog", label: "Katalog" },
  { id: "paket", label: "Paket" },
  { id: "fakultas", label: "Fakultas" },
  { id: "stok", label: "Stok" },
  { id: "pickup", label: "Pengambilan" },
  { id: "akses", label: "Tim & izin" },
  { id: "audit", label: "Audit" },
] as const;

const COUNT_LABELS: [keyof AdminSummary["counts"], string][] = [
  ["pending", "Menunggu bayar"],
  ["paid", "Dibayar"],
  ["expired", "Kedaluwarsa"],
  ["ready", "Siap diambil"],
  ["pickedUp", "Sudah diambil"],
];

/** Aksi tulis: satu status sibuk, satu pesan galat, satu konfirmasi sukses, lalu muat ulang data. */
function useAction(onAuthError: () => void, refresh: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const exec = useCallback(
    async (action: () => Promise<string | void>): Promise<boolean> => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const message = await action();
        setNotice(typeof message === "string" ? message : "Tersimpan.");
        await refresh();
        return true;
      } catch (issue) {
        if (isAuthError(issue)) {
          onAuthError();
          return false;
        }
        setError({
          message: issue instanceof Error ? issue.message : "Aksi gagal.",
          field: issue instanceof ApiError ? issue.field : undefined,
        });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onAuthError, refresh],
  );

  return { busy, error, notice, exec };
}

type Action = ReturnType<typeof useAction>;

function fieldError(action: Action, name: string): string | undefined {
  return action.error?.field === name ? action.error.message : undefined;
}

function Feedback({ action }: { action: Action }) {
  return (
    <>
      {action.error ? <Alert tone="error">{action.error.message}</Alert> : null}
      {action.notice ? (
        <p role="status" className="text-sm font-medium text-brand-dark">
          {action.notice}
        </p>
      ) : null}
    </>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-4 space-y-3">
      <div className="space-y-1">
        <h2 id={`${id}-title`} className="text-xl font-bold text-ink">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function CheckboxField({
  id,
  name = id,
  label,
  checked,
  onChange,
}: {
  id: string;
  name?: string;
  label: string;
  checked?: boolean;
  onChange?: (value: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center gap-3 text-ink">
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={onChange ? checked : undefined}
        defaultChecked={onChange ? undefined : checked}
        onChange={onChange ? (event) => onChange(event.target.checked) : undefined}
        className="h-5 w-5 rounded border-line accent-brand"
      />
      <span className="font-medium">{label}</span>
    </label>
  );
}

export default function AdminPage({ section = "ringkasan" }: { section?: string }) {
  const workspace = useOperatorWorkspace();
  const [denied, setDenied] = useState(false);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const active = SECTIONS.some((item) => item.id === section) ? section : "ringkasan";
  const role = workspace.state === "ready" ? workspace.role : null;
  const onAuthError = useCallback(() => setDenied(true), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Ringkasan dan katalog dipakai lintas bagian; akun dan audit dimuat saat dibuka.
      const [nextSummary, nextCatalog] = await Promise.all([
        get<AdminSummary>("/api/admin/summary"),
        get<AdminCatalog>("/api/admin/catalog"),
      ]);
      setSummary(nextSummary);
      setCatalog(nextCatalog);
      if (active === "akses") setOperators((await get<{ operators: Operator[] }>("/api/admin/operators")).operators);
      if (active === "audit") setAudit((await get<{ logs: AuditLog[] }>("/api/admin/audit")).logs);
    } catch (issue) {
      if (isAuthError(issue)) {
        setDenied(true);
        return;
      }
      setError(issue instanceof Error ? issue.message : "Data admin gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    if (role !== "admin" || denied) return;
    void load();
  }, [role, denied, load]);

  if (workspace.state === "loading") return <Spinner label="Memeriksa akses admin" />;

  if (denied || workspace.role !== "admin") {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Admin"
          description="Halaman ini hanya untuk akun admin yang diverifikasi server: katalog, paket, stok, fakultas, akses tim."
        />
        <Alert tone="error">
          {workspace.error ?? "Akun ini bukan admin. Masuk dengan akun admin untuk membuka halaman ini."}
        </Alert>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={workspace.reload}>
            Periksa ulang sesi
          </Button>
          <Link
            to="/operator/login?next=/admin"
            className="inline-flex min-h-12 items-center font-semibold text-brand underline"
          >
            Masuk sebagai admin
          </Link>
        </div>
      </div>
    );
  }

  if (!summary || !catalog) {
    return (
      <div className="space-y-4">
        <PageHeader title="Admin" />
        {error ? <Alert tone="error">{error}</Alert> : <Spinner label="Memuat data admin" />}
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
          {loading ? "Memuat..." : "Coba lagi"}
        </Button>
      </div>
    );
  }

  const singleVariants = catalog.products
    .filter((product) => product.kind === "single")
    .flatMap((product) =>
      product.variants.map((variant) => ({ id: variant.id, label: `${product.title} (${variant.sku})`, active: variant.active })),
    );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin"
        description="Setiap perubahan dicatat di audit log. Pembayaran tetap simulasi, tidak ada gateway pembayaran nyata."
      />

      <nav aria-label="Bagian admin" className="flex flex-wrap gap-2">
        {SECTIONS.map((item) => (
          <Link
            key={item.id}
            to={`/admin/${item.id}`}
            ariaCurrent={active === item.id ? "page" : undefined}
            className={`inline-flex min-h-12 items-center rounded-lg border px-4 text-sm font-semibold ${
              active === item.id ? "border-brand bg-brand-tint text-brand-dark" : "border-line bg-white text-ink hover:bg-brand-tint"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div hidden={active !== "ringkasan"}>
      <SummarySection summary={summary} onAuthError={onAuthError} refresh={load} />

      </div>
      <div hidden={active !== "pesanan"}>
      <Section
        id="pesanan"
        title="Pesanan"
        description="Antrean pemenuhan pesanan dikelola di halaman tim agar tidak ada dua tabel yang bisa berbeda."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {(["pending", "paid", "ready"] as const).map((key) => (
            <div key={key} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-muted">{COUNT_LABELS.find(([name]) => name === key)?.[1] ?? key}</p>
              <p className="text-2xl font-bold text-ink">{summary.counts[key]}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-muted">
            Tandai siap diambil dan selesaikan pesanan dari antrean tim. Perubahan status langsung terlihat di halaman
            pembeli.
          </p>
          <Link
            to="/team/orders"
            className="mt-2 inline-flex min-h-12 items-center font-semibold text-brand underline"
          >
            Buka antrean pesanan tim
          </Link>
        </div>
      </Section>

      </div>
      <div hidden={active !== "katalog"}>
      <CatalogSection catalog={catalog} onAuthError={onAuthError} refresh={load} />

      </div>
      <div hidden={active !== "paket"}>
      <Section
        id="paket"
        title="Paket"
        description="Harga dan komponen paket ditetapkan per fakultas. Paket hanya terbit bila semua komponennya varian aktif."
      >
        {catalog.products.filter((product) => product.kind === "bundle").length === 0 ? (
          <p className="text-muted">Belum ada produk paket. Buat produk berjenis paket di bagian Katalog.</p>
        ) : null}
        <ul className="space-y-4">
          {catalog.products
            .filter((product) => product.kind === "bundle")
            .map((product) => (
              <li key={product.id} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-ink">{product.title}</h3>
                  <span className="text-sm text-muted">
                    {product.active ? "Aktif" : "Nonaktif"} · versi {product.version}
                  </span>
                </div>
                {product.configs.length === 0 ? (
                  <p className="text-sm text-muted">Belum ada konfigurasi fakultas.</p>
                ) : (
                  <ul className="divide-y divide-slate-200 rounded-lg border border-line text-sm">
                    {product.configs.map((config) => (
                      <li key={config.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                        <div>
                          <p className="font-medium text-ink">{config.facultyName}</p>
                          <p className="text-muted">
                            {rupiah(config.priceRp)} · {config.components.length} komponen
                          </p>
                        </div>
                        <span
                          className={
                            config.published
                              ? "rounded-full border border-brand bg-brand-tint px-3 py-1 font-medium text-brand-dark"
                              : "rounded-full border border-line bg-slate-100 px-3 py-1 font-medium text-muted"
                          }
                        >
                          {config.published ? "Terbit" : "Draf"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <PackageEditor
                  key={product.id}
                  product={product}
                  faculties={catalog.faculties}
                  variantOptions={singleVariants}
                  onAuthError={onAuthError}
                  refresh={load}
                />
              </li>
            ))}
        </ul>
      </Section>

      </div>
      <div hidden={active !== "fakultas"}>
      <Section
        id="fakultas"
        title="Fakultas"
        description="Alias menormalkan label fakultas dari sumber eksternal ke satu identitas. Huruf besar, 2 sampai 12 karakter, tanpa spasi."
      >
        <ul className="space-y-3">
          {catalog.faculties.map((faculty) => (
            <li key={faculty.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-ink">{faculty.name}</h3>
                <span className="text-sm text-muted">{faculty.active ? "Aktif" : "Nonaktif"}</span>
              </div>
              <p className="mt-1 text-sm text-muted">
                Alias saat ini: {faculty.aliases.length ? faculty.aliases.join(", ") : "belum ada"}
              </p>
              <AliasForm
                key={`${faculty.id}:${faculty.aliases.join(",")}`}
                faculty={faculty}
                onAuthError={onAuthError}
                refresh={load}
              />
            </li>
          ))}
        </ul>
      </Section>

      </div>
      <div hidden={active !== "pickup"}>
        <Section id="pickup" title="Pengambilan" description="Perubahan hanya berlaku untuk pesanan baru; pesanan lama tetap memakai snapshot.">
          <PickupForm
            key={`${summary.settings?.pickup.version ?? 0}:${summary.settings?.pickup.label ?? ""}:${summary.settings?.pickup.details ?? ""}:${summary.settings?.pickup.hours ?? ""}`}
            summary={summary}
            onAuthError={onAuthError}
            refresh={load}
          />
        </Section>
      </div>

      <div hidden={active !== "stok"}>
      <Section
        id="stok"
        title="Stok"
        description="Stok fisik tidak boleh di bawah jumlah yang sudah direservasi pesanan berjalan."
      >
        <ul className="space-y-2">
          {summary.variants.map((variant) => (
            <StockRow
              key={`${variant.id}:${variant.stockOnHand}`}
              variant={variant}
              onAuthError={onAuthError}
              refresh={load}
            />
          ))}
        </ul>
      </Section>

      </div>
      <div hidden={active !== "ringkasan"}>
      <KpiSection onAuthError={onAuthError} />
      <SalesExportSection />

      </div>
      <div hidden={active !== "akses"}>
      <Section
        id="akses"
        title="Akses tim"
        description="Staff default dapat melihat dan memproses pesanan. Admin memegang katalog, stok, dan izin. Menonaktifkan akun langsung memutus semua sesi operator akun itu."
      >
        <CreateStaffForm onAuthError={onAuthError} refresh={load} />
        {operators.length === 0 ? <p className="text-muted">Belum ada akun staf atau admin.</p> : null}
        <ul className="space-y-2">
          {operators.map((operator) => (
            <OperatorRow
              key={operator.id}
              operator={operator}
              self={operator.id === workspace.user?.id}
              onAuthError={onAuthError}
              refresh={load}
            />
          ))}
        </ul>
      </Section>

      </div>
      <div hidden={active !== "audit"}>
      <Section id="audit" title="Audit" description="Seratus catatan terakhir. Respons audit tidak memuat email pelaku.">
        {audit.length === 0 ? <p className="text-muted">Belum ada catatan.</p> : null}
        {audit.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-slate-200 text-muted">
                <tr>
                  <th scope="col" className="p-3 font-medium">Waktu</th>
                  <th scope="col" className="p-3 font-medium">Aksi</th>
                  <th scope="col" className="p-3 font-medium">Entitas</th>
                  <th scope="col" className="p-3 font-medium">Pelaku</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {audit.map((log) => (
                  <tr key={log.id}>
                    <td className="p-3 text-muted">{dateTime(log.createdAt)}</td>
                    <td className="p-3 font-medium text-ink">{log.action}</td>
                    <td className="p-3 text-muted">
                      {log.entityType} {log.entityId.slice(0, 8)}
                    </td>
                    <td className="p-3 text-muted">{log.actorId ? log.actorId.slice(0, 8) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Section>      </div>

    </div>
  );
}

function SummarySection({
  summary,
  onAuthError,
  refresh,
}: {
  summary: AdminSummary;
  onAuthError: () => void;
  refresh: () => Promise<void>;
}) {
  const action = useAction(onAuthError, refresh);
  const settings = summary.settings;

  return (
    <Section
      id="ringkasan"
      title="Ringkasan"
      description="Angka diambil langsung dari basis data. Checkout yang ditutup tidak mengubah pesanan yang sudah ada."
    >
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {COUNT_LABELS.map(([key, label]) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="text-2xl font-bold text-ink">{summary.counts[key]}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-ink">Checkout</h3>
            <p className="text-sm text-muted">
              Status: {settings?.checkoutEnabled ? "terbuka" : "ditutup"}.
              {settings ? ` Diperbarui ${dateTime(settings.updatedAt)}.` : " Pengaturan belum terbaca."}
            </p>
          </div>
          <Button
            variant={settings?.checkoutEnabled ? "danger" : "primary"}
            disabled={action.busy}
            onClick={() =>
              void action.exec(async () => {
                await patch("/api/admin/settings", { checkoutEnabled: !settings?.checkoutEnabled });
                return settings?.checkoutEnabled ? "Checkout ditutup." : "Checkout dibuka.";
              })
            }
          >
            {action.busy ? "Menyimpan..." : settings?.checkoutEnabled ? "Jeda checkout" : "Buka checkout"}
          </Button>
        </div>
        <Feedback action={action} />
      </div>

    </Section>
  );
}

function PickupForm({
  summary,
  onAuthError,
  refresh,
}: {
  summary: AdminSummary;
  onAuthError: () => void;
  refresh: () => Promise<void>;
}) {
  const action = useAction(onAuthError, refresh);
  const pickup = summary.settings?.pickup;

  return (
    <form
      noValidate
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void action.exec(async () => {
          await patch("/api/admin/settings", {
            pickupLabel: String(data.get("pickupLabel") ?? ""),
            pickupDetails: String(data.get("pickupDetails") ?? ""),
            pickupServiceHours: String(data.get("pickupHours") ?? ""),
          });
          return "Instruksi pickup disimpan. Pesanan lama tetap memakai versi sebelumnya.";
        });
      }}
    >
      <div>
        <h3 className="text-lg font-semibold text-ink">Instruksi pickup</h3>
        <p className="text-sm text-muted">Versi snapshot {pickup?.version ?? "-"}. Perubahan berlaku untuk pesanan baru.</p>
      </div>
      <Field id="pickup-label" label="Nama lokasi" error={fieldError(action, "pickupLabel")}>
        <Input
          id="pickup-label"
          name="pickupLabel"
          defaultValue={pickup?.label ?? ""}
          maxLength={120}
          aria-describedby={fieldError(action, "pickupLabel") ? "pickup-label-error" : undefined}
        />
      </Field>
      <Field id="pickup-details" label="Detail lokasi">
        <Input id="pickup-details" name="pickupDetails" defaultValue={pickup?.details ?? ""} maxLength={300} />
      </Field>
      <Field id="pickup-hours" label="Jam layanan">
        <Input id="pickup-hours" name="pickupHours" defaultValue={pickup?.hours ?? ""} maxLength={120} />
      </Field>
      <Feedback action={action} />
      <Button type="submit" disabled={action.busy}>
        {action.busy ? "Menyimpan..." : "Simpan instruksi"}
      </Button>
    </form>
  );
}

function CatalogSection({
  catalog,
  onAuthError,
  refresh,
}: {
  catalog: AdminCatalog;
  onAuthError: () => void;
  refresh: () => Promise<void>;
}) {
  const action = useAction(onAuthError, refresh);

  return (
    <Section
      id="katalog"
      title="Katalog"
      description="Produk baru dibuat nonaktif agar tidak langsung tampil ke pembeli. Varian hanya bisa ditambah pada produk satuan."
    >
      <form
        noValidate
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void action.exec(async () => {
            await post("/api/admin/products", {
              kind: String(data.get("kind") ?? "single"),
              title: String(data.get("title") ?? ""),
              description: String(data.get("description") ?? ""),
            });
            return "Produk dibuat dan masih nonaktif.";
          }).then((ok) => {
            if (ok) form.reset();
          });
        }}
      >
        <h3 className="text-lg font-semibold text-ink">Produk baru</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="product-kind" label="Jenis">
            <Select id="product-kind" name="kind" defaultValue="single">
              <option value="single">Produk satuan</option>
              <option value="bundle">Paket</option>
            </Select>
          </Field>
          <Field id="product-title" label="Nama produk" error={fieldError(action, "title")}>
            <Input
              id="product-title"
              name="title"
              maxLength={80}
              aria-describedby={fieldError(action, "title") ? "product-title-error" : undefined}
            />
          </Field>
        </div>
        <Field id="product-description" label="Deskripsi">
          <Textarea id="product-description" name="description" maxLength={600} />
        </Field>
        <p className="text-sm text-muted">Foto diunggah dari galeri setelah produk dibuat. Maksimal lima foto per produk.</p>
        <Feedback action={action} />
        <Button type="submit" disabled={action.busy}>
          {action.busy ? "Menyimpan..." : "Buat produk"}
        </Button>
      </form>

      <ul className="space-y-4">
        {catalog.products.map((product) => (
          <ProductCard
            key={`${product.id}:${product.version}:${product.active ? 1 : 0}`}
            product={product}
            faculties={catalog.faculties}
            onAuthError={onAuthError}
            refresh={refresh}
          />
        ))}
      </ul>
    </Section>
  );
}

function ProductCard({
  product,
  faculties,
  onAuthError,
  refresh,
}: {
  product: AdminProduct;
  faculties: FacultyRow[];
  onAuthError: () => void;
  refresh: () => Promise<void>;
}) {
  const action = useAction(onAuthError, refresh);

  return (
    <li className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink">{product.title}</h3>
          <p className="text-sm text-muted">
            {product.kind === "bundle" ? "Paket" : "Produk satuan"} · versi {product.version} ·{" "}
            {product.active ? "aktif" : "nonaktif"}
          </p>
        </div>
        <Button
          variant={product.active ? "danger" : "secondary"}
          disabled={action.busy}
          onClick={() =>
            void action.exec(async () => {
              await patch(`/api/admin/products/${product.id}`, { active: !product.active });
              return product.active ? "Produk dinonaktifkan." : "Produk diaktifkan.";
            })
          }
        >
          {product.active ? "Nonaktifkan" : "Aktifkan"}
        </Button>
      </div>
      <Feedback action={action} />

      <form
        noValidate
        className="space-y-3 rounded-lg border border-line p-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const discountBasisPoints = percentToBasisPoints(data.get("discountPercent"));
          void action.exec(async () => {
            if (discountBasisPoints < 0) {
              throw new ApiError("invalid_payload", "Diskon harus angka 0 sampai 100.", 400, "discountPercent");
            }
            await patch(`/api/admin/products/${product.id}`, {
              title: String(data.get("title") ?? ""),
              description: String(data.get("description") ?? ""),
              ...(product.kind === "single" ? { discountBasisPoints } : {}),
              active: data.get("active") === "on",
            });
            return "Produk diperbarui.";
          });
        }}
      >
        <h4 className="font-semibold text-ink">Ubah produk</h4>
        <Field id={`title-${product.id}`} label="Nama produk">
          <Input id={`title-${product.id}`} name="title" defaultValue={product.title} maxLength={80} />
        </Field>
        <Field id={`description-${product.id}`} label="Deskripsi">
          <Textarea id={`description-${product.id}`} name="description" defaultValue={product.description} maxLength={600} />
        </Field>
        <div className="space-y-3 rounded-lg border border-line p-3">
          <h4 className="font-semibold text-ink">Galeri foto ({product.photos.length}/5)</h4>
          {product.photos.length ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {product.photos.map((photo, index) => (
                <li key={photo.id} className="space-y-2 rounded-lg border border-slate-200 p-2">
                  <img src={photo.url} alt="" width={photo.width} height={photo.height} className="h-24 w-full object-contain" />
                  {index === 0 ? <p className="text-xs font-semibold text-brand-dark">Sampul</p> : null}
                  <div className="flex flex-wrap gap-2">
                    {index > 0 ? (
                      <button
                        type="button"
                        className="min-h-10 rounded border border-line px-2 text-sm"
                        disabled={action.busy}
                        onClick={() =>
                          void action.exec(async () => {
                            const ids = [photo.id, ...product.photos.filter((item) => item.id !== photo.id).map((item) => item.id)];
                            await put(`/api/admin/products/${product.id}/photos/order`, { ids });
                            return "Sampul diperbarui.";
                          })
                        }
                      >
                        Jadikan sampul
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="min-h-10 rounded border border-danger px-2 text-sm text-danger"
                      disabled={action.busy}
                      onClick={() =>
                        void action.exec(async () => {
                          await del(`/api/admin/products/${product.id}/photos/${photo.id}`);
                          return "Foto dihapus.";
                        })
                      }
                    >
                      Hapus
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Belum ada foto. Gambar lama tetap tampil sampai foto baru diunggah.</p>
          )}
          {product.photos.length < 5 ? (
            <Field id={`photo-${product.id}`} label="Unggah foto" hint="JPEG, PNG, atau WebP. Maksimal 5 MiB dan 20 MP.">
              <input
                id={`photo-${product.id}`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="block w-full text-sm"
                disabled={action.busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  void action.exec(async () => {
                    await upload(`/api/admin/products/${product.id}/photos`, file);
                    return "Foto diunggah.";
                  });
                }}
              />
            </Field>
          ) : (
            <p className="text-sm text-muted">Batas lima foto tercapai. Hapus satu foto untuk mengunggah yang baru.</p>
          )}
        </div>
        <Field
          id={`discount-${product.id}`}
          label="Diskon (%)"
          hint={
            product.kind === "bundle"
              ? "Harga paket diatur per fakultas di bagian Paket, jadi diskon persen hanya untuk produk satuan."
              : "0 sampai 100. Boleh pakai koma, misalnya 12,5. Isi 100 untuk gratis."
          }
        >
          <Input
            id={`discount-${product.id}`}
            name="discountPercent"
            type="text"
            inputMode="decimal"
            defaultValue={((product.discountBasisPoints ?? 0) / 100).toString()}
            disabled={product.kind === "bundle"}
          />
        </Field>
        <CheckboxField id={`active-${product.id}`} name="active" label="Tampilkan di katalog" checked={product.active} />
        <Button type="submit" variant="secondary" disabled={action.busy}>
          {action.busy ? "Menyimpan..." : "Simpan produk"}
        </Button>
      </form>

      <div className="space-y-2">
        <h4 className="font-semibold text-ink">Varian ({product.variants.length})</h4>
        {product.variants.length === 0 ? <p className="text-sm text-muted">Belum ada varian.</p> : null}
        <ul className="space-y-2">
          {product.variants.map((variant) => (
            <VariantRow
              key={`${variant.id}:${variant.priceRp}:${variant.stockOnHand}:${variant.active ? 1 : 0}`}
              variant={variant}
              onAuthError={onAuthError}
              refresh={refresh}
            />
          ))}
        </ul>
      </div>

      {product.kind === "single" ? (
        <CreateVariantForm
          key={`create-variant-${product.id}`}
          product={product}
          faculties={faculties}
          onAuthError={onAuthError}
          refresh={refresh}
        />
      ) : null}
    </li>
  );
}

function VariantRow({
  variant,
  onAuthError,
  refresh,
}: {
  variant: AdminVariant;
  onAuthError: () => void;
  refresh: () => Promise<void>;
}) {
  const action = useAction(onAuthError, refresh);

  return (
    <li className="space-y-3 rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-ink">{variant.sku}</p>
          <p className="text-sm text-muted">
            {variantLabel(variant.attributes) || "Tanpa atribut"} · fisik {variant.stockOnHand} · direservasi{" "}
            {variant.stockReserved}
          </p>
        </div>
        <span className="flex flex-wrap items-center gap-2 text-sm">
          <span className={variant.active ? "font-medium text-brand-dark" : "font-medium text-muted"}>
            {variant.active ? "Aktif" : "Nonaktif"}
          </span>
          <span className={variant.sellable ? "font-medium text-brand-dark" : "font-medium text-danger"}>
            {variant.sellable ? "Dijual" : "Tidak dijual"}
          </span>
        </span>
      </div>
      <form
        noValidate
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void action.exec(async () => {
            await patch(`/api/admin/variants/${variant.id}`, {
              priceRp: Number(data.get("priceRp")),
              stockOnHand: Number(data.get("stockOnHand")),
              active: data.get("active") === "on",
              sellable: data.get("sellable") === "on",
            });
            return "Varian diperbarui.";
          });
        }}
      >
        <Field id={`price-${variant.id}`} label="Harga (Rp)">
          <Input
            id={`price-${variant.id}`}
            name="priceRp"
            type="number"
            inputMode="numeric"
            min={1}
            max={10000000}
            defaultValue={variant.priceRp}
          />
        </Field>
        <Field id={`onhand-${variant.id}`} label="Stok fisik">
          <Input
            id={`onhand-${variant.id}`}
            name="stockOnHand"
            type="number"
            inputMode="numeric"
            min={0}
            max={100000}
            defaultValue={variant.stockOnHand}
          />
        </Field>
        <div className="flex items-end">
          <CheckboxField id={`variant-active-${variant.id}`} name="active" label="Varian aktif" checked={variant.active} />
          <CheckboxField
            id={`variant-sellable-${variant.id}`}
            name="sellable"
            label="Boleh dijual"
            checked={variant.sellable}
          />
        </div>
        <div className="sm:col-span-3">
          <Feedback action={action} />
          <Button type="submit" variant="secondary" disabled={action.busy}>
            {action.busy ? "Menyimpan..." : "Simpan varian"}
          </Button>
        </div>
      </form>
    </li>
  );
}

function CreateVariantForm({
  product,
  faculties,
  onAuthError,
  refresh,
}: {
  product: AdminProduct;
  faculties: FacultyRow[];
  onAuthError: () => void;
  refresh: () => Promise<void>;
}) {
  const action = useAction(onAuthError, refresh);
  const [rows, setRows] = useState<{ key: string; value: string }[]>([{ key: "", value: "" }]);

  return (
    <form
      noValidate
      className="space-y-3 rounded-lg border border-line p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const attributes: Record<string, string> = {};
        for (const row of rows) {
          if (row.key.trim()) attributes[row.key.trim()] = row.value.trim();
        }
        const facultyId = String(data.get("facultyId") ?? "");
        void action.exec(async () => {
          await post(`/api/admin/products/${product.id}/variants`, {
            sku: String(data.get("sku") ?? ""),
            priceRp: Number(data.get("priceRp")),
            stockOnHand: Number(data.get("stockOnHand")),
            attributes,
            facultyId: facultyId ? facultyId : null,
            active: data.get("active") === "on",
          });
          return "Varian dibuat.";
        }).then((ok) => {
          if (ok) {
            form.reset();
            setRows([{ key: "", value: "" }]);
          }
        });
      }}
    >
      <h4 className="font-semibold text-ink">Varian baru</h4>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id={`sku-${product.id}`} label="SKU">
          <Input id={`sku-${product.id}`} name="sku" maxLength={40} placeholder="MABAKIT-001" />
        </Field>
        <Field id={`new-price-${product.id}`} label="Harga (Rp)">
          <Input id={`new-price-${product.id}`} name="priceRp" type="number" inputMode="numeric" min={1} max={10000000} />
        </Field>
        <Field id={`new-onhand-${product.id}`} label="Stok fisik">
          <Input
            id={`new-onhand-${product.id}`}
            name="stockOnHand"
            type="number"
            inputMode="numeric"
            min={0}
            max={100000}
            defaultValue={0}
          />
        </Field>
      </div>
      <Field
        id={`faculty-${product.id}`}
        label="Fakultas (opsional)"
        error={fieldError(action, "facultyId")}
        hint="Kosongkan bila varian ini berlaku untuk semua fakultas."
      >
        <Select
          id={`faculty-${product.id}`}
          name="facultyId"
          defaultValue=""
          aria-describedby={fieldError(action, "facultyId") ? `faculty-${product.id}-error` : `faculty-${product.id}-hint`}
        >
          <option value="">Semua fakultas</option>
          {faculties.map((faculty) => (
            <option key={faculty.id} value={faculty.id}>
              {faculty.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="space-y-2">
        <p className="font-medium text-ink">Atribut (opsional)</p>
        {rows.map((row, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor={`attr-key-${product.id}-${index}`} className="block text-sm text-muted">
                Kunci
              </label>
              <Input
                id={`attr-key-${product.id}-${index}`}
                value={row.key}
                maxLength={24}
                placeholder="ukuran"
                onChange={(event) =>
                  setRows(rows.map((item, position) => (position === index ? { ...item, key: event.target.value } : item)))
                }
              />
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor={`attr-value-${product.id}-${index}`} className="block text-sm text-muted">
                Nilai
              </label>
              <Input
                id={`attr-value-${product.id}-${index}`}
                value={row.value}
                maxLength={120}
                placeholder="L"
                onChange={(event) =>
                  setRows(rows.map((item, position) => (position === index ? { ...item, value: event.target.value } : item)))
                }
              />
            </div>
            <Button
              variant="secondary"
              disabled={rows.length === 1}
              onClick={() => setRows(rows.filter((_, position) => position !== index))}
            >
              Hapus
            </Button>
          </div>
        ))}
        <Button variant="secondary" disabled={rows.length >= 12} onClick={() => setRows([...rows, { key: "", value: "" }])}>
          Tambah atribut
        </Button>
      </div>

      <CheckboxField id={`new-active-${product.id}`} name="active" label="Langsung aktifkan varian" checked />
      <Feedback action={action} />
      <Button type="submit" disabled={action.busy}>
        {action.busy ? "Menyimpan..." : "Buat varian"}
      </Button>
    </form>
  );
}

function PackageEditor({
  product,
  faculties,
  variantOptions,
  onAuthError,
  refresh,
}: {
  product: AdminProduct;
  faculties: FacultyRow[];
  variantOptions: { id: string; label: string; active: boolean }[];
  onAuthError: () => void;
  refresh: () => Promise<void>;
}) {
  const action = useAction(onAuthError, refresh);
  const [facultyId, setFacultyId] = useState("");
  const [priceRp, setPriceRp] = useState("");
  const [published, setPublished] = useState(false);
  const [components, setComponents] = useState<{ variantId: string; quantity: number }[]>([
    { variantId: "", quantity: 1 },
  ]);
  const [localError, setLocalError] = useState<string | null>(null);

  function pickFaculty(nextId: string) {
    setFacultyId(nextId);
    setLocalError(null);
    const existing = product.configs.find((config) => config.facultyId === nextId);
    setPriceRp(existing ? String(existing.priceRp) : "");
    setPublished(existing ? existing.published : false);
    setComponents(
      existing && existing.components.length > 0
        ? existing.components.map((component) => ({ variantId: component.variantId, quantity: component.quantity }))
        : [{ variantId: "", quantity: 1 }],
    );
  }

  return (
    <form
      noValidate
      className="space-y-3 rounded-lg border border-line p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const filled = components.filter((component) => component.variantId);
        if (!facultyId) {
          setLocalError("Pilih fakultas lebih dulu.");
          return;
        }
        if (filled.length === 0) {
          setLocalError("Pilih minimal satu varian komponen.");
          return;
        }
        setLocalError(null);
        void action.exec(async () => {
          await put(`/api/admin/packages/${product.id}/configs/${facultyId}`, {
            priceRp: Number(priceRp),
            published,
            components: filled.map((component) => ({
              variantId: component.variantId,
              quantity: Math.max(1, Number(component.quantity) || 1),
            })),
          });
          return published ? "Konfigurasi paket disimpan dan diterbitkan." : "Konfigurasi paket disimpan sebagai draf.";
        });
      }}
    >
      <h4 className="font-semibold text-ink">Konfigurasi per fakultas</h4>
      <Field id={`pkg-faculty-${product.id}`} label="Fakultas">
        <Select
          id={`pkg-faculty-${product.id}`}
          value={facultyId}
          onChange={(event) => pickFaculty(event.target.value)}
        >
          <option value="">Pilih fakultas</option>
          {faculties.map((faculty) => (
            <option key={faculty.id} value={faculty.id}>
              {faculty.name}
              {product.configs.some((config) => config.facultyId === faculty.id) ? " (sudah ada)" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`pkg-price-${product.id}`} label="Harga paket (Rp)">
          <Input
            id={`pkg-price-${product.id}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={10000000}
            value={priceRp}
            onChange={(event) => setPriceRp(event.target.value)}
          />
        </Field>
        <div className="flex items-end">
          <CheckboxField id={`pkg-published-${product.id}`} label="Terbitkan paket" checked={published} onChange={setPublished} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-medium text-ink">Komponen</p>
        {components.map((component, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-[2]">
              <label htmlFor={`pkg-variant-${product.id}-${index}`} className="block text-sm text-muted">
                Varian
              </label>
              <Select
                id={`pkg-variant-${product.id}-${index}`}
                value={component.variantId}
                onChange={(event) =>
                  setComponents(
                    components.map((item, position) =>
                      position === index ? { ...item, variantId: event.target.value } : item,
                    ),
                  )
                }
              >
                <option value="">Pilih varian</option>
                {variantOptions
                  .filter((option) => option.active)
                  .map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
              </Select>
            </div>
            <div className="w-24">
              <label htmlFor={`pkg-qty-${product.id}-${index}`} className="block text-sm text-muted">
                Jumlah
              </label>
              <Input
                id={`pkg-qty-${product.id}-${index}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                value={component.quantity}
                onChange={(event) =>
                  setComponents(
                    components.map((item, position) =>
                      position === index ? { ...item, quantity: Number(event.target.value) } : item,
                    ),
                  )
                }
              />
            </div>
            <Button
              variant="secondary"
              disabled={components.length === 1}
              onClick={() => setComponents(components.filter((_, position) => position !== index))}
            >
              Hapus
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          disabled={components.length >= 20}
          onClick={() => setComponents([...components, { variantId: "", quantity: 1 }])}
        >
          Tambah komponen
        </Button>
      </div>

      {localError ? <Alert tone="error">{localError}</Alert> : null}
      {fieldError(action, "components") ? (
        <p id={`pkg-components-${product.id}-error`} className="text-sm font-medium text-danger" role="alert">
          {fieldError(action, "components")}
        </p>
      ) : null}
      <Feedback action={action} />
      <Button type="submit" disabled={action.busy}>
        {action.busy ? "Menyimpan..." : "Simpan konfigurasi"}
      </Button>
    </form>
  );
}

function AliasForm({
  faculty,
  onAuthError,
  refresh,
}: {
  faculty: FacultyRow;
  onAuthError: () => void;
  refresh: () => Promise<void>;
}) {
  const action = useAction(onAuthError, refresh);

  return (
    <form
      noValidate
      className="mt-2 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const aliases = String(data.get("aliases") ?? "")
          .split(/[\s,]+/)
          .map((alias) => alias.trim().toUpperCase())
          .filter(Boolean);
        void action.exec(async () => {
          await put(`/api/admin/faculties/${faculty.id}/aliases`, { aliases });
          return aliases.length ? "Alias disimpan." : "Semua alias dihapus.";
        });
      }}
    >
      <Field
        id={`aliases-${faculty.id}`}
        label="Alias"
        hint="Pisahkan dengan koma atau spasi, contoh FIS, FISH."
        error={fieldError(action, "aliases")}
      >
        <Input
          id={`aliases-${faculty.id}`}
          name="aliases"
          defaultValue={faculty.aliases.join(", ")}
          maxLength={200}
          aria-describedby={fieldError(action, "aliases") ? `aliases-${faculty.id}-error` : `aliases-${faculty.id}-hint`}
        />
      </Field>
      <Feedback action={action} />
      <Button type="submit" variant="secondary" disabled={action.busy}>
        {action.busy ? "Menyimpan..." : "Simpan alias"}
      </Button>
    </form>
  );
}

function StockRow({
  variant,
  onAuthError,
  refresh,
}: {
  variant: AdminSummary["variants"][number];
  onAuthError: () => void;
  refresh: () => Promise<void>;
}) {
  const action = useAction(onAuthError, refresh);

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <form
        noValidate
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void action.exec(async () => {
            await post(`/api/admin/variants/${variant.id}/stock`, { onHand: Number(data.get("onHand")) });
            return "Stok diperbarui.";
          });
        }}
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">
            {variant.title} ({variant.sku})
          </p>
          <p className="text-sm text-muted">
            {rupiah(variant.priceRp)} · fisik {variant.stockOnHand} · direservasi {variant.stockReserved} ·{" "}
            {variant.active ? "aktif" : "nonaktif"}
          </p>
        </div>
        <Field id={`stock-${variant.id}`} label="Stok fisik">
          <Input
            id={`stock-${variant.id}`}
            name="onHand"
            type="number"
            inputMode="numeric"
            min={0}
            max={100000}
            defaultValue={variant.stockOnHand}
            className="w-28"
          />
        </Field>
        <Button type="submit" variant="secondary" disabled={action.busy}>
          {action.busy ? "Menyimpan..." : "Simpan"}
        </Button>
      </form>
      <div className="mt-2">
        <Feedback action={action} />
      </div>
    </li>
  );
}

const PERMISSION_LABELS: [string, string][] = [
  ["orders.view", "Lihat pesanan"],
  ["orders.ready", "Tandai siap diambil"],
  ["orders.complete", "Catat serah terima"],
];

function SalesExportSection() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return (
    <section aria-labelledby="ekspor-heading" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 id="ekspor-heading" className="font-semibold text-ink">Ekspor penjualan</h2>
      <p className="text-sm text-muted">
        CSV semua transaksi berstatus dibayar pada rentang tanggal WIB. Tanpa nama, email, atau nomor telepon pembeli.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="export-from" label="Dari tanggal">
          <Input id="export-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field id="export-to" label="Sampai tanggal">
          <Input id="export-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </Field>
      </div>
      <a
        href={`/api/admin/export/sales.csv${suffix}`}
        className="inline-flex min-h-12 items-center rounded-lg bg-brand px-4 font-semibold text-white"
      >
        Unduh CSV
      </a>
    </section>
  );
}

function KpiSection({ onAuthError }: { onAuthError: () => void }) {
  const [period, setPeriod] = useState<AdminKpi["period"]>("today");
  const [kpi, setKpi] = useState<AdminKpi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    get<AdminKpi>(`/api/admin/kpi?period=${period}`)
      .then((body) => {
        if (active) setKpi(body);
      })
      .catch((issue: unknown) => {
        if (!active) return;
        if (isAuthError(issue)) {
          onAuthError();
          return;
        }
        setError(issue instanceof Error ? issue.message : "KPI gagal dimuat.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period, onAuthError]);

  return (
    <Section
      id="kinerja"
      title="Kinerja tim"
      description="Nilai pembayaran dihitung dari waktu bayar. Transisi siap diambil dan serah terima dihitung dari audit pelaku; data lama tanpa pelaku tidak ditebak."
    >
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="kpi-period" className="text-sm font-medium text-ink">
          Periode
        </label>
        <Select
          id="kpi-period"
          value={period}
          onChange={(event) => setPeriod(event.target.value as AdminKpi["period"])}
          className="max-w-48"
        >
          <option value="today">Hari ini</option>
          <option value="7d">7 hari</option>
          <option value="30d">30 hari</option>
          <option value="all">Semua</option>
        </Select>
        <span className="text-sm text-muted">Pembayaran simulasi, bukan pendapatan nyata.</span>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading && !kpi ? <Spinner label="Memuat KPI" /> : null}
      {kpi ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-muted">Nilai pembayaran</p>
              <p className="text-2xl font-bold text-ink">{rupiah(kpi.sales.paidValueRp)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-muted">Pesanan dibayar</p>
              <p className="text-2xl font-bold text-ink">{kpi.sales.paidOrders}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-muted">Transisi tanpa pelaku</p>
              <p className="text-2xl font-bold text-ink">
                {kpi.unattributed.readyCount + kpi.unattributed.completeCount}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-slate-200 text-muted">
                <tr>
                  <th className="px-3 py-2">Akun</th>
                  <th className="px-3 py-2">Siap diambil</th>
                  <th className="px-3 py-2">Serah terima</th>
                  <th className="px-3 py-2">Transisi terakhir</th>
                </tr>
              </thead>
              <tbody>
                {kpi.staff.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-medium text-ink">{row.name || row.email}</span>
                      <span className="block text-xs text-muted">
                        {row.role === "admin" ? "Admin" : "Staf"}
                        {row.disabled ? " · nonaktif" : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.readyCount}</td>
                    <td className="px-3 py-2">{row.completeCount}</td>
                    <td className="px-3 py-2">{row.lastTransitionAt ? dateTime(row.lastTransitionAt) : "Belum ada"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {kpi.unattributed.readyCount + kpi.unattributed.completeCount > 0 ? (
            <p className="text-sm text-muted">
              {kpi.unattributed.readyCount} transisi siap diambil dan {kpi.unattributed.completeCount} serah terima
              tercatat tanpa pelaku, tidak dimasukkan ke akun mana pun.
            </p>
          ) : null}
        </>
      ) : null}
    </Section>
  );
}

function CreateStaffForm({ onAuthError, refresh }: { onAuthError: () => void; refresh: () => Promise<void> }) {
  const action = useAction(onAuthError, refresh);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<string[]>(["orders.view", "orders.ready", "orders.complete"]);

  function toggle(permission: string) {
    setPermissions((current) =>
      current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission],
    );
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Tambah akun staf
      </Button>
    );
  }

  return (
    <form
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void action.exec(async () => {
          if (!permissions.includes("orders.view")) {
            throw new ApiError("invalid_payload", "Izin lihat pesanan wajib dipilih.", 400, "permissions");
          }
          await post("/api/admin/operators", { name, email, password, permissions });
          setName("");
          setEmail("");
          setPassword("");
          setOpen(false);
          return "Akun staf dibuat. Kata sandi awal tidak ditampilkan lagi.";
        });
      }}
    >
      <h3 className="font-semibold text-ink">Akun staf baru</h3>
      <Field id="staff-name" label="Nama" error={fieldError(action, "name")}>
        <Input id="staff-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
      </Field>
      <Field id="staff-email" label="Email" error={fieldError(action, "email")}>
        <Input
          id="staff-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
          required
        />
      </Field>
      <Field
        id="staff-password"
        label="Kata sandi awal"
        hint="Minimal 8 karakter. Sampaikan langsung ke staf; tidak ada email reset."
        error={fieldError(action, "password")}
      >
        <Input
          id="staff-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          maxLength={128}
          required
        />
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">Izin</legend>
        <div className="flex flex-wrap gap-3">
          {PERMISSION_LABELS.map(([value, label]) => (
            <label key={value} className="inline-flex min-h-12 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={permissions.includes(value)}
                onChange={() => toggle(value)}
                className="h-5 w-5 accent-emerald-700"
              />
              {label}
            </label>
          ))}
        </div>
        {fieldError(action, "permissions") ? (
          <p className="text-sm text-danger">{fieldError(action, "permissions")}</p>
        ) : null}
      </fieldset>
      <Feedback action={action} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={action.busy}>
          {action.busy ? "Menyimpan..." : "Buat akun"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={action.busy}>
          Batal
        </Button>
      </div>
    </form>
  );
}

function OperatorRow({
  operator,
  self,
  onAuthError,
  refresh,
}: {
  operator: Operator;
  self: boolean;
  onAuthError: () => void;
  refresh: () => Promise<void>;
}) {
  const action = useAction(onAuthError, refresh);
  const [confirming, setConfirming] = useState(false);
  const [permissions, setPermissions] = useState<string[]>(operator.permissions);

  return (
    <li className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">{operator.name || operator.email}</p>
          <p className="text-sm text-muted">{operator.email}</p>
          <p className="text-sm text-muted">
            {operator.role === "admin" ? "Admin" : "Tim"} · masuk terakhir {dateTime(operator.lastLoginAt)} ·{" "}
            {operator.activeSessions} sesi aktif{operator.disabled ? " · nonaktif" : ""}
          </p>
          <p className="mt-1 text-sm text-muted">
            Izin:{" "}
            {operator.permissions.length === 0
              ? "tidak ada"
              : operator.permissions
                  .map((permission) => PERMISSION_LABELS.find(([value]) => value === permission)?.[1] ?? permission)
                  .join(", ")}
          </p>
        </div>
        {operator.role === "admin" || self ? (
          <p className="text-sm text-muted">Akun admin tidak dapat diubah dari sini.</p>
        ) : confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-danger">Nonaktifkan akun dan cabut semua sesinya?</span>
            <Button
              variant="danger"
              disabled={action.busy}
              onClick={() =>
                void action.exec(async () => {
                  await post(`/api/admin/operators/${operator.id}/revoke`);
                  setConfirming(false);
                  return "Akun dinonaktifkan dan semua sesinya dicabut.";
                })
              }
            >
              {action.busy ? "Memproses..." : "Ya, nonaktifkan"}
            </Button>
            <Button variant="secondary" disabled={action.busy} onClick={() => setConfirming(false)}>
              Batal
            </Button>
          </div>
        ) : (
          <Button variant="danger" disabled={action.busy} onClick={() => setConfirming(true)}>
            Cabut akses
          </Button>
        )}
      </div>
      {operator.role === "staff" && !self && !operator.disabled ? (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <p className="text-sm font-medium text-ink">Izin staf</p>
          <div className="flex flex-wrap gap-3">
            {PERMISSION_LABELS.map(([value, label]) => (
              <label key={value} className="inline-flex min-h-12 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={permissions.includes(value)}
                  onChange={() =>
                    setPermissions((current) =>
                      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
                    )
                  }
                  className="h-5 w-5 accent-emerald-700"
                />
                {label}
              </label>
            ))}
          </div>
          <Button
            variant="secondary"
            disabled={action.busy || permissions.length === operator.permissions.length && permissions.every((value) => operator.permissions.includes(value))}
            onClick={() =>
              void action.exec(async () => {
                await patch(`/api/admin/operators/${operator.id}`, { permissions });
                return "Izin disimpan. Sesi operator ini dicabut dan harus masuk ulang.";
              })
            }
          >
            {action.busy ? "Menyimpan..." : "Simpan izin"}
          </Button>
        </div>
      ) : null}
      <Feedback action={action} />
    </li>
  );
}
