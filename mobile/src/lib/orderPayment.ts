export type PayMethod = "VISA" | "MADA" | "COD" | string | null | undefined;

export function isCodPayment(method: PayMethod): boolean {
  return method === "COD";
}

export function formatPaymentMethodLabel(method: PayMethod): string {
  if (method === "VISA") return "Visa";
  if (method === "MADA") return "مدى mada";
  if (method === "COD") return "دفع عند الاستلام";
  return "غير محدد";
}

/** نص حالة الدفع في الفاتورة — لا يُظهر «تم الدفع» لطلبات COD */
export function formatInvoicePaymentStatus(method: PayMethod): string {
  if (isCodPayment(method)) return "دفع عند الاستلام — غير مدفوع بعد";
  if (method === "VISA" || method === "MADA") return "تم الدفع";
  return "تم الدفع";
}

export function formatInvoiceTotalLabel(method: PayMethod): string {
  if (isCodPayment(method)) return "الإجمالي المستحق";
  return "الإجمالي المدفوع";
}
