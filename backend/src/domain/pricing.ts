export const MAX_DISCOUNT_BASIS_POINTS = 10_000;

/** Persen disimpan basis poin; pembulatan rupiah setengah ke atas. */
export function finalUnitPrice(basePriceRp: number, discountBasisPoints: number): number {
  if (!Number.isInteger(basePriceRp) || basePriceRp < 0) return 0;
  const bps = Number.isInteger(discountBasisPoints) ? Math.min(MAX_DISCOUNT_BASIS_POINTS, Math.max(0, discountBasisPoints)) : 0;
  return Math.floor((basePriceRp * (MAX_DISCOUNT_BASIS_POINTS - bps) + 5_000) / MAX_DISCOUNT_BASIS_POINTS);
}
