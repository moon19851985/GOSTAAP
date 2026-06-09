import { Platform } from "react-native";
import { formatMoney } from "./formatMoney";
import { showAlert } from "./alert";

export type RestaurantInvoiceItem = {
  productName: string;
  quantity: number;
  lineTotal: number;
};

export type RestaurantInvoicePrintData = {
  restaurantName: string;
  invoiceNumber?: string | null;
  orderId: string;
  createdAt?: string;
  deliveryAddress: string;
  customerName?: string;
  customerPhone?: string | null;
  items: RestaurantInvoiceItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
};

function formatPrintDate(iso?: string) {
  if (!iso) return new Date().toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" });
  return new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" });
}

function buildInvoiceHtml(data: RestaurantInvoicePrintData) {
  const itemsRows = data.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${item.productName}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:left">${formatMoney(item.lineTotal)} ر.س</td>
        </tr>`
    )
    .join("");

  const invoiceLine = data.invoiceNumber?.trim()
    ? data.invoiceNumber.trim()
    : "—";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>فاتورة ${invoiceLine}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1a1a1a; }
    h1 { color: #E85D04; margin: 0 0 8px; font-size: 22px; }
    .meta { background: #fafafa; padding: 12px; border-radius: 8px; margin: 16px 0; line-height: 1.8; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background: #E85D04; color: #fff; padding: 8px; }
    .totals { margin-top: 16px; text-align: right; line-height: 1.9; }
    .grand { font-size: 20px; font-weight: bold; color: #E85D04; margin-top: 8px; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <h1>${data.restaurantName}</h1>
  <div>فاتورة طلب</div>
  <div class="meta">
    <div><strong>رقم الفاتورة:</strong> ${invoiceLine}</div>
    <div><strong>التاريخ:</strong> ${formatPrintDate(data.createdAt)}</div>
    <div><strong>حالة الدفع:</strong> تم الدفع</div>
    <div><strong>العميل:</strong> ${data.customerName ?? "—"}${data.customerPhone ? ` — ${data.customerPhone}` : ""}</div>
    <div><strong>عنوان التوصيل:</strong> ${data.deliveryAddress}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>المنتج</th>
        <th>الكمية</th>
        <th>المبلغ</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>
  <div class="totals">
    <div>مجموع أصناف المطعم: ${formatMoney(data.subtotal)} ر.س</div>
    <div>أجرة التوصيل: ${formatMoney(data.deliveryFee)} ر.س</div>
    <div class="grand">إجمالي المبلغ المدفوع: ${formatMoney(data.total)} ر.س</div>
  </div>
</body>
</html>`;
}

export function printRestaurantInvoice(data: RestaurantInvoicePrintData) {
  if (Platform.OS !== "web") {
    showAlert("طباعة", "طباعة الفاتورة متاحة من المتصفح (الويب) على اللابتوب.");
    return;
  }

  const html = buildInvoiceHtml(data);
  const win = window.open("", "_blank", "width=520,height=760");
  if (!win) {
    showAlert("خطأ", "تعذّر فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة.");
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();

  setTimeout(() => {
    win.print();
  }, 350);
}
