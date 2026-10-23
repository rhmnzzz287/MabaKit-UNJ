import { useEffect, useState } from "react";
import { ApiError, get, patch, post } from "../lib/api";
import { navigate } from "../lib/router";
import type { CatalogResponse, Profile } from "../lib/types";
import { useWorkspace } from "../lib/workspace";
import { Alert, Button, Field, Input, Link, PageHeader, Select, Spinner } from "../components/ui";

export default function ProfilePage() {
  const workspace = useWorkspace();
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
    <div className="space-y-6">
      <PageHeader
        title="Akun saya"
        description="Data ini menjadi isian awal checkout berikutnya. Pesanan yang sudah dibuat tetap memakai snapshot kontaknya."
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved ? <Alert tone="info">Profil tersimpan.</Alert> : null}

      <form onSubmit={submit} className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-4" noValidate>
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
        <Field id="profile-whatsapp" label="Nomor WhatsApp" hint="Gunakan data uji. Format 08xx atau 62xx." error={fieldError.whatsapp}>
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
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Menyimpan..." : "Simpan profil"}
          </Button>
          <Button variant="secondary" onClick={() => void signOut()} disabled={busy}>
            Keluar
          </Button>
        </div>
        {profile ? <p className="text-sm text-muted">Terakhir diperbarui {new Date(profile.updatedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB.</p> : null}
      </form>

      <p className="text-sm text-muted">
        Lihat{" "}
        <Link to="/orders" className="font-semibold text-brand underline">
          pesanan saya
        </Link>{" "}
        atau kembali ke{" "}
        <Link to="/catalog" className="font-semibold text-brand underline">
          katalog
        </Link>
        .
      </p>
    </div>
  );
}
