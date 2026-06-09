/** Format a stored order amount — never recalculate from location. */
export function formatMoney(amount: number | string | undefined | null): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}
