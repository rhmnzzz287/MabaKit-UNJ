import { useEffect, useState } from "react";
import { ApiError, get, patch, post } from "../lib/api";
import { navigate } from "../lib/router";
import type { CatalogResponse, Profile } from "../lib/types";
import { useOperatorWorkspace, useWorkspace } from "../lib/workspace";
import { Alert, Button, Card, Field, Input, Link, PageHeader, Select, Spinner } from "../components/ui";

export default function ProfilePage() {
  const workspace = useWorkspace();
  const operator = useOperatorWorkspace();
  const operatorRole = operator.state === "ready" && (operator.role === "staff" || operator.role === "admin") ? operator.role : null;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [faculties, setFaculties] = useState<CatalogResponse["faculties"]>([]);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (workspace.state === "loading") return;
    if (!workspace.user) {
      navigate("/login?next=%2Fprofile");
      return;
    }
    let active = true;
    Promise.all([get<{ profile: Profile | null }>("/api/profile"), get<CatalogResponse>("/api/catalog")])
      .then(([profileBody, catalog]) => {
        if (!active) return;
        setProfile(profileBody.profile);
        setFaculties(catalog.faculties);
        setName(profileBody.profile?.name ?? workspace.user?.name ?? "");
        setWhatsapp(profileBody.profile?.whatsapp ?? workspace.user?.whatsapp ?? "");
        setFacultyId(profileBody.profile?.facultyId ?? workspace.user?.facultyId ?? "");
      })
      .catch((issue: unknown) => {
        if (active) setError(issue instanceof Error ? issue.message : "Profil gagal dimuat.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspace.state, workspace.user]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    setFieldError({});
    try {
      const body = await patch<{ profile: Profile }>("/api/profile", { name, whatsapp, facultyId: facultyId || null });
      setProfile(body.profile);
      setSaved(true);
      workspace.reload();
    } catch (issue) {
      if (issue instanceof ApiError && issue.field) setFieldError({ [issue.field]: issue.message });
      else setError(issue instanceof Error ? issue.message : "Profil gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await post("/api/auth/logout");
      window.location.assign("/");
    } finally {
      setBusy(false);
    }
  }

  if (workspace.state === "loading" || loading) return <Spinner label="Memuat profil" />;
  if (!workspace.user) return <Spinner label="Mengalihkan ke halaman masuk" />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Profil saya"
        description="Data ini menjadi isian awal checkout berikutnya. Pesanan yang sudah dibuat tetap memakai snapshot kontaknya."
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved ? <Alert tone="info">Profil tersimpan.</Alert> : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
        <Card className="p-6 sm:p-8">
          <form onSubmit={submit} className="space-y-6" noValidate>
            <Field id="profile-email" label="Email akun" hint="Email akun tidak dapat diubah pada demo ini.">
              <Input id="profile-email" type="email" value={profile?.email ?? workspace.user.email} readOnly disabled />
            </Field>
            <Field id="profile-name" label="Nama" hint="Nama yang dipakai pada pesanan baru." error={fieldError.name}>
              <Input
                id="profile-name"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                maxLength={80}
                required
              />
            </Field>
            <Field
              id="profile-whatsapp"
              label="Nomor WhatsApp"
              hint="Gunakan data uji. Format 08xx atau 62xx."
              error={fieldError.whatsapp}
            >
              <Input
                id="profile-whatsapp"
                name="whatsapp"
                inputMode="tel"
                value={whatsapp}
                onChange={(event) => setWhatsapp(event.target.value)}
                autoComplete="tel"
                required
              />
            </Field>
            <Field
              id="profile-faculty"
              label="Fakultas"
              hint="Dipakai sebagai pilihan awal saat menyesuaikan paket. Tetap dapat diganti per pesanan."
              error={fieldError.facultyId}
            >
              <Select id="profile-faculty" value={facultyId} onChange={(event) => setFacultyId(event.target.value)}>
                <option value="">Belum dipilih</option>
                {faculties.map((faculty) => (
                  <option key={faculty.id} value={faculty.id}>
                    {faculty.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-6">
              <Button type="submit" disabled={busy}>
                {busy ? "Menyimpan..." : "Simpan profil"}
              </Button>
              <Button variant="secondary" onClick={() => void signOut()} disabled={busy}>
                Keluar
              </Button>
            </div>
            {profile ? (
              <p className="text-sm text-muted">
                Terakhir diperbarui{" "}
                {new Date(profile.updatedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB.
              </p>
            ) : null}
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3 p-6">
            <h2 className="font-bold text-ink">Pintasan</h2>
            <Link to="/orders" className="block min-h-12 rounded-xl px-3 py-3 font-medium text-brand-dark hover:bg-brand-tint">
              Pesanan saya
            </Link>
            <Link to="/catalog" className="block min-h-12 rounded-xl px-3 py-3 font-medium text-brand-dark hover:bg-brand-tint">
              Paket dan produk
            </Link>
            <Link to="/contact" className="block min-h-12 rounded-xl px-3 py-3 font-medium text-brand-dark hover:bg-brand-tint">
              Hubungi kami
            </Link>
            {/* Portal operator punya sesi sendiri, jadi pembeli yang sudah masuk tetap bisa masuk sebagai tim. */}
            {operatorRole ? (
              <Link
                to={operatorRole === "admin" ? "/admin/ringkasan" : "/team"}
                className="block min-h-12 rounded-xl px-3 py-3 font-medium text-brand-dark hover:bg-brand-tint"
              >
                {operatorRole === "admin" ? "Panel admin" : "Workspace tim"}
              </Link>
            ) : (
              <Link
                to="/operator/login?next=%2Fteam"
                className="block min-h-12 rounded-xl px-3 py-3 font-medium text-brand-dark hover:bg-brand-tint"
              >
                Masuk sebagai operator
              </Link>
            )}
          </Card>
          <Alert tone="info">
            Akun demo. Jangan memakai kata sandi yang juga dipakai di layanan lain.
          </Alert>
        </div>
      </div>
    </div>
  );
}
