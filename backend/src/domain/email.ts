const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Normalisasi email untuk disimpan sebagai snapshot; bukan verifikasi deliverability. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  return EMAIL_PATTERN.test(email) ? email : null;
}
