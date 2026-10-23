export type CartLine = {
  productId: string;
  variantId: string | null;
  facultyId: string | null;
  facultyName: string | null;
  title: string;
  variantLabel: string;
  priceRp: number;
  quantity: number;
};

const KEY = "mabakit.cart.v2";
const listeners = new Set<() => void>();

/** Kunci baris: konfigurasi berbeda (termasuk fakultas) tidak boleh tergabung. */
export function lineKey(line: Pick<CartLine, "productId" | "variantId" | "facultyId">): string {
  return `${line.productId}::${line.variantId ?? ""}::${line.facultyId ?? ""}`;
}

function read(): CartLine[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return (parsed as CartLine[]).filter(
      (line) => line && typeof line.productId === "string" && typeof line.priceRp === "number" && typeof line.quantity === "number",
    );
  } catch {
    return [];
  }
}

function write(lines: CartLine[]): void {
  localStorage.setItem(KEY, JSON.stringify(lines));
  for (const listener of listeners) listener();
}

export function cartLines(): CartLine[] {
  return read();
}

export function cartCount(): number {
  return read().reduce((total, line) => total + line.quantity, 0);
}

export function cartTotal(): number {
  return read().reduce((total, line) => total + line.quantity * line.priceRp, 0);
}

export function subscribeCart(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function addToCart(line: CartLine): void {
  const lines = read();
  const key = lineKey(line);
  const existing = lines.find((item) => lineKey(item) === key);
  if (existing) existing.quantity = Math.min(99, existing.quantity + line.quantity);
  else lines.push(line);
  write(lines);
}

export function updateLine(key: string, changes: Partial<Pick<CartLine, "quantity" | "facultyId" | "facultyName" | "variantLabel" | "priceRp">>): void {
  write(
    read()
      .map((line) => (lineKey(line) === key ? { ...line, ...changes } : line))
      .filter((line) => line.quantity > 0),
  );
}

/** Penggantian aman: baris lama hilang hanya setelah baris baru tersimpan. */
export function replaceLine(key: string, line: CartLine): void {
  const lines = read().filter((item) => lineKey(item) !== key);
  const target = lines.find((item) => lineKey(item) === lineKey(line));
  if (target) target.quantity = Math.min(99, target.quantity + line.quantity);
  else lines.push(line);
  write(lines);
}

export function setQuantity(key: string, quantity: number): void {
  updateLine(key, { quantity: Math.max(1, Math.min(99, quantity)) });
}

export function removeLine(key: string): void {
  write(read().filter((line) => lineKey(line) !== key));
}

export function clearCart(): void {
  write([]);
}

export function newCheckoutKey(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 32);
}

export function checkoutPayload(status: { buyerName: string; contactPhone: string; email: string; method: string }) {
  return {
    ...status,
    departmentId: null,
    items: read().map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      facultyId: line.facultyId,
      quantity: line.quantity,
    })),
  };
}
