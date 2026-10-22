export type ParsedAttributes = {
  attributes: Record<string, string>;
  imagePath: string | null;
};

// `foto` adalah metadata internal untuk gambar varian, tidak ikut ditampilkan
// atau disimpan di snapshot pesanan.
export function parseAttributes(raw: string): ParsedAttributes {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { attributes: {}, imagePath: null };
    }
    const { foto, ...rest } = parsed;
    const attributes: Record<string, string> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (typeof value === "string") attributes[key] = value;
    }
    return { attributes, imagePath: typeof foto === "string" ? foto : null };
  } catch {
    return { attributes: {}, imagePath: null };
  }
}
