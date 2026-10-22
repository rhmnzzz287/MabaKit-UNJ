const PHONE_PATTERN = /^(?:\+62|62|0)8[1-9]\d{6,10}$/;

/** Hanya nomor seluler Indonesia. Mengembalikan E.164 (+62...) atau null. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s().-]/g, "");
  if (!PHONE_PATTERN.test(digits)) return null;
  const national = digits.replace(/^\+?62/, "").replace(/^0/, "");
  return `+62${national}`;
}
