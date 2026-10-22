import { useState } from "react";
import { ApiError, ensureSession, post } from "../lib/api";
import { Alert, Button, Field, Input } from "./ui";

export function OperatorLogin({
  role,
  title,
  onReady,
}: {
  role: "staff" | "admin";
  title: string;
  onReady: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await ensureSession();
      await post("/api/demo/operator", { role, code });
      onReady();
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Kode gagal diverifikasi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="text-sm text-muted">
        Kode demo diberikan koordinator secara langsung. Tidak ada login produksi, email, atau MFA di demo ini.
      </p>
      <Field id="operator-code" label="Kode operator" error={error ?? undefined}>
        <Input
          id="operator-code"
          type="password"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          required
        />
      </Field>
      <Button type="submit" disabled={busy}>
        {busy ? "Memeriksa..." : "Masuk"}
      </Button>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </form>
  );
}
