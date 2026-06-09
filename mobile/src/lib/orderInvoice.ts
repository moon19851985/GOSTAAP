/** يُعرض فقط بعد الدفع عندما يكون invoiceNumber موجوداً */
export function formatOrderInvoice(invoiceNumber?: string | null): string | null {
  if (!invoiceNumber?.trim()) return null;
  return `رقم الفاتورة: ${invoiceNumber.trim()}`;
}
