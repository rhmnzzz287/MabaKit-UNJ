export type ImageInfo = { contentType: string; width: number; height: number };

function u16(b: Uint8Array, i: number): number {
  return (b[i] << 8) | b[i + 1];
}
function u32(b: Uint8Array, i: number): number {
  return ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
}
/** WebP/RIFF menyimpan angka little-endian. */
function le16(b: Uint8Array, i: number): number {
  return b[i] | (b[i + 1] << 8);
}
function le24(b: Uint8Array, i: number): number {
  return b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
}
function le32(b: Uint8Array, i: number): number {
  return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
}

/** Baca dimensi dari header JPEG/PNG/WebP tanpa decoding piksel. */
export function imageInfo(bytes: Uint8Array, contentType: string): ImageInfo | null {
  if (contentType === "image/png") {
    const png = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < 24 || png.some((value, index) => bytes[index] !== value)) return null;
    return { contentType, width: u32(bytes, 16), height: u32(bytes, 20) };
  }
  if (contentType === "image/jpeg") {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1];
      const length = u16(bytes, i + 2);
      if (marker >= 0xc0 && marker <= 0xc3 && i + 9 <= bytes.length) {
        return { contentType, width: u16(bytes, i + 7), height: u16(bytes, i + 5) };
      }
      i += 2 + length;
    }
    return null;
  }
  if (contentType === "image/webp") {
    if (bytes.length < 30) return null;
    const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
    if (ascii(0, 4) !== "RIFF" || ascii(8, 12) !== "WEBP") return null;
    const chunk = ascii(12, 16);
    if (chunk === "VP8X") {
      // Bit 0x02 pada byte flag menandai animasi; galeri hanya menerima gambar diam.
      if ((bytes[20] & 0x02) !== 0) return null;
      return { contentType, width: 1 + le24(bytes, 24), height: 1 + le24(bytes, 27) };
    }
    if (chunk === "VP8L") {
      if (bytes[20] !== 0x2f) return null;
      const bits = le32(bytes, 21);
      return { contentType, width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
    }
    if (chunk === "VP8 ") {
      if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
      return { contentType, width: le16(bytes, 26) & 0x3fff, height: le16(bytes, 28) & 0x3fff };
    }
    return null;
  }
  return null;
}
