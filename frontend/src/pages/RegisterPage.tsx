import { useState } from "react";
import { ApiError, authenticate } from "../lib/api";
import { safeNext } from "../lib/workspace";
import { Alert, Button, Card, Field, Input, Link } from "../components/ui";

export default function RegisterPage() {
  const next = safeNext(new URLSearchParams(window.location.search).get("next"), "/orders");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldError({});
    try {
      await authenticate("/api/auth/register", { name, email, password });
      window.location.assign(next);
    } catch (issue) {
      if (issue instanceof ApiError && issue.field) setFieldError({ [issue.field]: issue.message });
      else setError(issue instanceof Error ? issue.message : "Pendaftaran gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-8 py-4">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-black tracking-tight text-ink">Daftar akun</h1>
        <p className="text-muted">Akun demo dipakai untuk checkout, riwayat pesanan, dan profil kontak.</p>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card className="space-y-6 p-6 sm:p-8">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <Field id="register-name" label="Nama" error={fieldError.name}>
            <Input
              id="register-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={80}
              required
            />
          </Field>
          <Field id="register-email" label="Email" error={fieldError.email}>
            <Input
              id="register-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              maxLength={254}
              required
            />
          </Field>
          <Field
            id="register-password"
            label="Kata sandi"
            hint="Minimal 8 karakter dan tidak boleh memuat bagian email."
            error={fieldError.password}
          >
            <Input
              id="register-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </Field>
          <Button type="submit" full disabled={busy}>
            {busy ? "Mendaftar..." : "Daftar"}
          </Button>
        </form>

        <p className="border-t border-slate-200 pt-6 text-center text-sm text-muted">
          Sudah punya akun?{" "}
          <Link to={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-dark underline">
            Masuk
          </Link>
        </p>
      </Card>
    </div>
  );
}
