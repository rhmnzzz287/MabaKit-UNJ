export type CartLine = { productId: string; variantId: string | null; title: string; variantLabel: string; priceRp: number; quantity: number };

const KEY = "mabakit.cart.v1";
const listeners = new Set<() => void>();

function read(): CartLine[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
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
  return () => listeners.delete(listener);
}

export function addToCart(line: CartLine): void {
  const lines = read();
  const existing = lines.find((item) => item.productId === line.productId && item.variantId === line.variantId);
  if (existing) existing.quantity = Math.min(99, existing.quantity + line.quantity);
  else lines.push(line);
  write(lines);
}

export function setQuantity(productId: string, variantId: string | null, quantity: number): void {
  const lines = read()
    .map((line) =>
      line.productId === productId && line.variantId === variantId
        ? { ...line, quantity: Math.max(1, Math.min(99, quantity)) }
        : line,
    )
    .filter((line) => line.quantity > 0);
  write(lines);
}

export function removeLine(productId: string, variantId: string | null): void {
  write(read().filter((line) => !(line.productId === productId && line.variantId === variantId)));
}

export function clearCart(): void {
  write([]);
}

export function newCheckoutKey(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 32);
}

export function checkoutPayload(status: { buyerName: string; recipientName: string; contactPhone: string; method: string }) {
  return {
    ...status,
    departmentId: null,
    items: read().map((line) => ({ productId: line.productId, variantId: line.variantId, quantity: line.quantity })),
  };
}
