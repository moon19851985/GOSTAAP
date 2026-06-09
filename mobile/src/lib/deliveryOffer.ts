import { formatMoney } from "./formatMoney";

/** تسمية عرض التوصيل للعميل — null = لا تعرض شيئاً */
export function formatOfferDeliveryLabel(fee: number | null | undefined): string | null {
  if (fee == null || !Number.isFinite(fee)) return null;
  if (fee <= 0) return "توصيل مجاني";
  return `توصيل ${formatMoney(fee)} ر.س`;
}
