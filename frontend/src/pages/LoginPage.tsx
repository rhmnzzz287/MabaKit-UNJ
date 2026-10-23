import { useEffect, useState } from "react";
import { ApiError, authenticate } from "../lib/api";
import { navigate } from "../lib/router";
import { refreshAuth, useAuth } from "../lib/auth-store";
import { safeNext } from "../lib/workspace";
import { Alert, Button, Card, Field, Input, Link } from "../components/ui";

export default function LoginPage() {
  const next = safeNext(new URLSearchParams(window.location.search).get("next"), "/orders");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const auth = useAuth("buyer");

  useEffect(() => {
    if (auth.state === "ready" && auth.user) navigate(next);
  }, [auth.state, auth.user, next]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authenticate("/api/auth/login", { email, password });
      await refreshAuth("buyer");
      navigate(next);
    } catch (issue) {
      if (issue instanceof ApiError && issue.status === 429) setError(issue.message);
      else if (issue instanceof ApiError && issue.code === "invalid_credentials") {
        setError("Email atau kata sandi tidak cocok.");
      } else if (issue instanceof ApiError && issue.code === "wrong_portal") {
        setError("Akun ini akun operator. Gunakan halaman masuk operator di bawah.");
      } else setError(issue instanceof Error ? issue.message : "Masuk gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-8 py-4">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-black tracking-tight text-ink">Masuk</h1>
        <p className="text-muted">Masuk untuk checkout, melihat pesanan, dan menyimpan profil kontak.</p>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card className="space-y-6 p-6 sm:p-8">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <Field id="login-email" label="Email">
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              maxLength={254}
              required
            />
          </Field>
          <Field id="login-password" label="Kata sandi">
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          <Button type="submit" full disabled={busy}>
            {busy ? "Memeriksa..." : "Masuk"}
          </Button>
        </form>

        <p className="border-t border-slate-200 pt-6 text-center text-sm text-muted">
          Belum punya akun?{" "}
          <Link to={`/register?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-dark underline">
            Daftar
          </Link>
        </p>
      </Card>

      <div className="space-y-2 text-center text-sm text-muted">
        <p>
          Tim MabaKit masuk lewat{" "}
          <Link to="/operator/login" className="font-semibold text-brand-dark underline">
            halaman operator
          </Link>
          .
        </p>
        <p>
          Ingin melihat katalog dulu?{" "}
          <Link to="/catalog" className="font-semibold text-brand-dark underline">
            Buka katalog
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
