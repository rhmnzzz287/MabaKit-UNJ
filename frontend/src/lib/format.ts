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
  PAID: "Sudah dibayar",
  EXPIRED: "Kedaluwarsa",
  UNFULFILLED: "Sedang disiapkan",
  READY: "Siap diambil",
  PICKED_UP: "Sudah diterima",
  CANCELLED: "Dibatalkan",
  BANK_TRANSFER: "Transfer bank",
  EWALLET: "E-wallet",
  QRIS: "QRIS",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function variantLabel(attributes: Record<string, string>): string {
  const entries = Object.entries(attributes).filter(([key]) => key !== "foto" && key !== "foto480");
  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join(", ") : "";
}

/** Empat langkah timeline pembeli. Langkah yang belum terjadi tetap terlihat abu-abu. */
export function timeline(order: { paymentStatus: string; fulfillmentStatus: string }): { label: string; done: boolean }[] {
  const paid = order.paymentStatus === "PAID";
  const ready = order.fulfillmentStatus === "READY" || order.fulfillmentStatus === "PICKED_UP";
  const received = order.fulfillmentStatus === "PICKED_UP";
  return [
    { label: "Menunggu pembayaran", done: paid },
    { label: "Sedang disiapkan", done: paid },
    { label: "Siap diambil", done: ready },
    { label: "Sudah diterima", done: received },
  ];
}
