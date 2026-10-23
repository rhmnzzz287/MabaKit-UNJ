import type { ReactNode } from "react";
import { navigate } from "../lib/router";
import { photoSize } from "../lib/photo-size";
import { statusLabel } from "../lib/format";

export function Link({
  to,
  children,
  className = "",
  onClick,
  ariaCurrent,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  ariaCurrent?: "page";
}) {
  return (
    <a
      href={to}
      className={className}
      aria-current={ariaCurrent}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        onClick?.();
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
      className={`inline-flex min-h-12 items-center justify-center rounded-lg px-6 font-semibold transition-colors ${BUTTON_STYLES[variant]} ${className}`}
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
    <div className="space-y-2">
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

const CONTROL =
  "min-h-12 w-full rounded-lg border border-line bg-white px-4 text-base text-ink placeholder:text-muted";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CONTROL} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} min-h-24 py-2 ${props.className ?? ""}`} />;
}

export function Alert({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: ReactNode }) {
  const styles =
    tone === "error"
      ? "border-danger bg-red-50 text-danger"
      : tone === "warn"
        ? "border-warn-fg bg-warn-bg text-warn-fg"
        : "border-brand bg-brand-tint text-brand-dark";
  return (
    <div className={`rounded-lg border p-4 text-sm ${styles}`} role={tone === "error" ? "alert" : "status"}>
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
  return <span className={`inline-block rounded-full border px-4 py-2 text-sm font-medium ${tone}`}>{statusLabel(status)}</span>;
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="space-y-2">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
      {description ? <p className="max-w-2xl text-muted">{description}</p> : null}
    </header>
  );
}

/** Keterangan percobaan pembayaran. Hanya dipakai di alur pembayaran dan invoice. */
export function SimulasiBadge() {
  return (
    <p className="inline-flex items-center rounded-full bg-warn-bg px-4 py-2 text-sm font-semibold text-warn-fg">
      SIMULASI, bukan pembayaran nyata
    </p>
  );
}

/**
 * Foto produk memakai rasio asli (object-contain), lebar/tinggi eksplisit, dan srcset 480/960
 * hanya bila turunan tersebut ada di manifest. Tidak pernah di-upscale.
 */
export function ProductPhoto({
  src,
  srcSet480,
  alt,
  width,
  height,
  className = "",
  eager = false,
}: {
  src: string | null;
  srcSet480?: string | null;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  eager?: boolean;
}) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-brand-tint text-sm font-medium text-brand-dark ${className}`}>
        Foto belum tersedia
      </div>
    );
  }
  const intrinsic = photoSize(src);
  return (
    <img
      src={src}
      srcSet={srcSet480 ? `${srcSet480} 480w, ${src} 960w` : undefined}
      sizes={srcSet480 ? "(min-width: 768px) 480px, 100vw" : undefined}
      alt={alt}
      width={width ?? intrinsic?.[0] ?? 960}
      height={height ?? intrinsic?.[1] ?? 720}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`bg-white object-contain ${className}`}
    />
  );
}

export function Spinner({ label = "Memuat" }: { label?: string }) {
  return (
    <p className="py-8 text-center text-muted" role="status">
      {label}...
    </p>
  );
}
