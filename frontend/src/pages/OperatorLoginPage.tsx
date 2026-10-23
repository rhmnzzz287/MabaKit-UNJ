import { useEffect, useState } from "react";
import { ApiError, authenticate, opPost } from "../lib/api";
import { navigate } from "../lib/router";
import { operatorNext } from "../lib/workspace";
import { refreshAuth, useAuth } from "../lib/auth-store";
import { Alert, Button, Field, Input, Link, PageHeader } from "../components/ui";

export default function OperatorLoginPage() {
  const next = operatorNext(new URLSearchParams(window.location.search).get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const auth = useAuth("operator");
  const already = auth.state === "ready" && (auth.role === "staff" || auth.role === "admin") ? auth.role : null;

  useEffect(() => {
    if (already) navigate(next);
  }, [already, next]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authenticate("/api/auth/login?portal=operator", { email, password }, "operator");
      const body = await refreshAuth("operator");
      if (body.role !== "staff" && body.role !== "admin") {
        await opPost("/api/auth/logout?portal=operator");
        await refreshAuth("operator");
        setError("Akun ini bukan akun tim MabaKit. Gunakan halaman masuk pembeli.");
        return;
      }
      navigate(next);
    } catch (issue) {
      if (issue instanceof ApiError && issue.status === 429) setError(issue.message);
      else if (issue instanceof ApiError && issue.code === "wrong_portal") setError("Akun ini akun pembeli. Gunakan halaman masuk pembeli.");
      else if (issue instanceof ApiError && issue.code === "invalid_credentials") setError("Email atau kata sandi tidak cocok.");
      else setError(issue instanceof Error ? issue.message : "Masuk gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader
        title="Masuk operator"
        description="Halaman ini untuk tim MabaKit. Pembeli tidak perlu masuk di sini dan tidak mendapat akses workspace tim."
      />
      {already ? (
        <Alert tone="info">
          Sesi ini sudah masuk sebagai {already}.{" "}
          <Link to="/team" className="font-semibold underline">
            Buka workspace tim
          </Link>
          .
        </Alert>
      ) : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4" noValidate>
        <Field id="operator-email" label="Email operator">
          <Input
            id="operator-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            maxLength={254}
            required
          />
        </Field>
        <Field id="operator-password" label="Kata sandi">
          <Input
            id="operator-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Memeriksa..." : "Masuk"}
        </Button>
        <p className="text-sm text-muted">Role akun diperiksa server. Memilih halaman ini saja tidak memberi izin tim.</p>
      </form>

      <p>
        <Link to="/catalog" className="font-semibold text-brand underline">
          Kembali ke katalog
        </Link>
      </p>
      <p className="text-sm text-muted">
        Bukan tim MabaKit?{" "}
        <button type="button" onClick={() => navigate("/login")} className="font-semibold text-brand underline">
          Masuk sebagai pembeli
        </button>
        .
      </p>
    </div>
  );
}
