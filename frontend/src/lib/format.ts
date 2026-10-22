export function rupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export function dateTime(value: number | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export function countdown(expiresAt: number, now = Date.now()): string {
  const remaining = Math.max(0, expiresAt - now);
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu pembayaran",
  PAID: "Sudah dibayar (simulasi)",
  EXPIRED: "Kedaluwarsa",
  UNFULFILLED: "Belum disiapkan",
  READY: "Siap diambil",
  PICKED_UP: "Sudah diambil",
  CANCELLED: "Dibatalkan",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function variantLabel(attributes: Record<string, string>): string {
  const entries = Object.entries(attributes);
  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join(", ") : "";
}
