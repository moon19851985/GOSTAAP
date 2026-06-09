export type StatsPeriod = "all" | "year" | "month" | "day";

export function defaultMonth(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

export function defaultYear(): string {
  return String(new Date().getFullYear());
}

export function defaultDay(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export function statsQueryString(
  period: StatsPeriod,
  month: string,
  year: string,
  date: string
): string {
  const q = new URLSearchParams({ period });
  if (period === "month") q.set("month", month);
  if (period === "year") q.set("year", year);
  if (period === "day") q.set("date", date);
  return q.toString();
}
