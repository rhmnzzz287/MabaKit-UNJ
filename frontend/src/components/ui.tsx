import type { ReactNode } from "react";
import { navigate } from "../lib/router";
import { statusLabel } from "../lib/format";

export function Link({ to, children, className = "" }: { to: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

const BUTTON_STYLES = {
  primary: "bg-brand text-white hover:bg-brand-dark disabled:opacity-60",
  secondary: "border border-line bg-white text-ink hover:bg-brand-tint disabled:opacity-60",
  danger: "border border-danger bg-white text-danger hover:bg-red-50 disabled:opacity-60",
} as const;

export function Button({
  children,
  type = "button",
  variant = "primary",
  onClick,
  disabled,
  className = "",
}: {
  children: ReactNode;
  type?: "button" | "submit";
  variant?: keyof typeof BUTTON_STYLES;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-12 items-center justify-center rounded-lg px-5 font-semibold transition-colors ${BUTTON_STYLES[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-12 w-full rounded-lg border border-line bg-white px-3 text-base text-ink placeholder:text-muted ${props.className ?? ""}`}
    />
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: ReactNode }) {
  const styles =
    tone === "error"
      ? "border-danger bg-red-50 text-danger"
      : tone === "warn"
        ? "border-warn-fg bg-warn-bg text-warn-fg"
        : "border-brand bg-brand-tint text-brand-dark";
  return (
    <div className={`rounded-lg border p-3 text-sm ${styles}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "PAID" || status === "READY"
      ? "bg-brand-tint text-brand-dark border-brand"
      : status === "EXPIRED" || status === "CANCELLED"
        ? "bg-slate-100 text-muted border-line"
        : "bg-warn-bg text-warn-fg border-warn-fg";
  return <span className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${tone}`}>{statusLabel(status)}</span>;
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="space-y-2">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
      {description ? <p className="max-w-2xl text-muted">{description}</p> : null}
    </header>
  );
}

export function SimulasiBadge() {
  return (
    <p className="inline-flex items-center rounded-full bg-warn-bg px-3 py-1 text-sm font-semibold text-warn-fg">
      SIMULASI, bukan pembayaran nyata
    </p>
  );
}

export function Spinner({ label = "Memuat" }: { label?: string }) {
  return (
    <p className="py-8 text-center text-muted" role="status">
      {label}...
    </p>
  );
}
