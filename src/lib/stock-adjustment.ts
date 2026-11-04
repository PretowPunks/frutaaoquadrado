export function stockAdjustmentQuantity(value: string): number | null {
  if (!value.trim()) return null;
  const quantity = Number(value);
  return Number.isSafeInteger(quantity) && quantity >= 0 && quantity <= 2147483647
    ? quantity
    : null;
}