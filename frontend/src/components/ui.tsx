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
  primary:
    "bg-brand text-white shadow-sm hover:bg-brand-dark hover:shadow-md active:translate-y-px disabled:opacity-60 disabled:shadow-none",
  secondary:
    "border border-slate-300 bg-white text-ink hover:border-brand hover:bg-brand-tint active:translate-y-px disabled:opacity-60",
  quiet: "text-brand-dark underline decoration-brand/40 underline-offset-4 hover:decoration-brand disabled:opacity-60",
  danger:
    "border border-danger bg-white text-danger hover:bg-red-50 active:translate-y-px disabled:opacity-60",
} as const;

export function Button({
  children,
  type = "button",
  variant = "primary",
  onClick,
  disabled,
  className = "",
  full,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  variant?: keyof typeof BUTTON_STYLES;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  full?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 font-semibold transition-all duration-150 ${
        BUTTON_STYLES[variant]
      } ${full ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

/** Tautan berbentuk tombol, supaya CTA navigasi tidak butuh inline style berulang. */
export function ButtonLink({
  to,
  children,
  variant = "primary",
  className = "",
  external,
}: {
  to: string;
  children: ReactNode;
  variant?: keyof typeof BUTTON_STYLES;
  className?: string;
  external?: boolean;
}) {
  const classes = `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 font-semibold transition-all duration-150 ${
    BUTTON_STYLES[variant]
  } ${className}`;
  if (external) {
    return (
      <a href={to} className={classes} rel="noreferrer noopener" target="_blank">
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={classes}>
      {children}
    </Link>
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
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
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
  "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-ink transition-colors placeholder:text-slate-500 hover:border-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-50 disabled:text-muted";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CONTROL} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} min-h-24 py-3 ${props.className ?? ""}`} />;
}

export function Alert({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: ReactNode }) {
  const styles =
    tone === "error"
      ? "border-red-200 bg-red-50 text-danger"
      : tone === "warn"
        ? "border-amber-200 bg-warn-bg text-warn-fg"
        : "border-emerald-200 bg-brand-tint text-brand-dark";
  return (
    <div className={`rounded-xl border p-4 text-sm leading-relaxed ${styles}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "PAID" || status === "READY"
      ? "bg-brand-tint text-brand-dark ring-emerald-200"
      : status === "EXPIRED" || status === "CANCELLED"
        ? "bg-slate-100 text-muted ring-slate-200"
        : "bg-warn-bg text-warn-fg ring-amber-200";
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${tone}`}>
      {statusLabel(status)}
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description ? <p className="max-w-2xl text-muted">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}

/** Keterangan percobaan pembayaran. Hanya dipakai di alur pembayaran dan invoice. */
export function SimulasiBadge() {
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-warn-bg px-4 py-2 text-sm font-semibold text-warn-fg">
      <span aria-hidden="true" className="size-2 rounded-full bg-warn-fg" />
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
      <div
        className={`flex items-center justify-center bg-brand-tint text-sm font-medium text-brand-dark ${className}`}
        role="img"
        aria-label={alt}
      >
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
    <p className="flex items-center justify-center gap-3 py-12 text-muted" role="status">
      <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
      {label}...
    </p>
  );
}

/** Kartu dasar untuk konten berulang: paket, produk, ringkasan, form. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function SectionTitle({ id, title, description, action }: { id?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2">
        <h2 id={id} className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
          {title}
        </h2>
        {description ? <p className="max-w-2xl text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Baris harga: harga akhir tebal, harga dasar dicoret bila ada diskon. */
export function Price({
  finalRp,
  baseRp,
  discountBasisPoints,
  size = "md",
}: {
  finalRp: number;
  baseRp?: number;
  discountBasisPoints?: number;
  size?: "sm" | "md" | "lg";
}) {
  const money = (value: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
  const scale = size === "lg" ? "text-2xl sm:text-3xl" : size === "sm" ? "text-base" : "text-lg";
  const discounted = (discountBasisPoints ?? 0) > 0 && (baseRp ?? 0) > finalRp;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className={`${scale} font-bold tracking-tight text-ink`}>{finalRp === 0 ? "Gratis" : money(finalRp)}</span>
      {discounted ? (
        <>
          <span className="text-sm text-muted line-through">{money(baseRp ?? 0)}</span>
          <span className="rounded-md bg-brand-tint px-2 py-1 text-xs font-bold text-brand-dark">
            -{(discountBasisPoints ?? 0) / 100}%
          </span>
        </>
      ) : null}
    </div>
  );
}
