import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { formatMoney } from "../lib/formatMoney";
import { formatOrderInvoice } from "../lib/orderInvoice";
import {
  formatInvoicePaymentStatus,
  formatInvoiceTotalLabel,
  formatPaymentMethodLabel,
} from "../lib/orderPayment";
import type { CustomerOrderInvoice } from "../lib/customerOrderInvoice";
import { showAlert } from "../lib/alert";

type Props = {
  visible: boolean;
  orderId: string | undefined;
  onClose: () => void;
};

export function OrderInvoiceSheet({ visible, orderId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [invoice, setInvoice] = useState<CustomerOrderInvoice | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const data = await api<CustomerOrderInvoice>(`/api/orders/${orderId}/invoice`);
      setInvoice(data);
    } catch (e) {
      setInvoice(null);
      showAlert("خطأ", e instanceof Error ? e.message : "تعذّر تحميل الفاتورة");
      onClose();
    } finally {
      setLoading(false);
    }
  }, [orderId, onClose]);

  useEffect(() => {
    if (visible && orderId) {
      setInvoice(null);
      void load();
    }
  }, [visible, orderId, load]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 16, maxHeight: "90%" },
          ]}
        >
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeBtn}>✕</Text>
            </Pressable>
            <Text style={styles.title}>تفاصيل الطلب</Text>
          </View>

          {loading ? (
            <ActivityIndicator color="#E85D04" style={{ marginVertical: 32 }} />
          ) : invoice ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {formatOrderInvoice(invoice.invoiceNumber) ? (
                <Text style={styles.invoiceRef}>
                  {formatOrderInvoice(invoice.invoiceNumber)}
                </Text>
              ) : null}
              <Text style={styles.meta}>
                {new Date(invoice.createdAt).toLocaleString("ar-SA", {
                  timeZone: "Asia/Riyadh",
                })}
              </Text>
              <Text style={styles.meta}>
                طريقة الدفع: {formatPaymentMethodLabel(invoice.paymentMethod)}
              </Text>
              <Text style={styles.meta}>
                حالة الدفع: {formatInvoicePaymentStatus(invoice.paymentMethod)}
              </Text>
              <Text style={styles.address}>📍 {invoice.deliveryAddress}</Text>

              <Text style={styles.sectionTitle}>الأصناف</Text>
              {invoice.items.map((item, idx) => (
                <View key={`${item.productName}-${idx}`} style={styles.itemRow}>
                  <View style={styles.itemMain}>
                    <Text style={styles.itemName}>{item.productName}</Text>
                    <Text style={styles.itemRestaurant}>{item.restaurantName}</Text>
                  </View>
                  <View style={styles.itemQtyPrice}>
                    <Text style={styles.itemQty}>×{item.quantity}</Text>
                    <Text style={styles.itemPrice}>{formatMoney(item.lineTotal)} ر.س</Text>
                  </View>
                </View>
              ))}

              <View style={styles.totalsBox}>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>إجمالي الطلب</Text>
                  <Text style={styles.totalValue}>{formatMoney(invoice.subtotal)} ر.س</Text>
                </View>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>أجرة التوصيل</Text>
                  <Text style={styles.totalValue}>
                    {formatMoney(invoice.deliveryFee)} ر.س
                  </Text>
                </View>
                <View style={[styles.totalLine, styles.grandLine]}>
                  <Text style={styles.grandLabel}>
                    {formatInvoiceTotalLabel(invoice.paymentMethod)}
                  </Text>
                  <Text style={styles.grandValue}>{formatMoney(invoice.total)} ر.س</Text>
                </View>
              </View>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "800", color: "#1a1a1a" },
  closeBtn: { fontSize: 22, color: "#888", padding: 4 },
  scrollContent: { paddingBottom: 24 },
  invoiceRef: {
    fontWeight: "800",
    fontSize: 16,
    color: "#E85D04",
    textAlign: "right",
    marginBottom: 6,
  },
  meta: { textAlign: "right", color: "#666", fontSize: 13, marginBottom: 4 },
  address: {
    textAlign: "right",
    color: "#333",
    fontSize: 14,
    marginBottom: 14,
    lineHeight: 22,
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 15,
    textAlign: "right",
    marginBottom: 10,
    color: "#1a1a1a",
  },
  itemRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  itemMain: { flex: 1, marginLeft: 8 },
  itemName: { fontWeight: "700", textAlign: "right", color: "#1a1a1a", fontSize: 14 },
  itemRestaurant: { textAlign: "right", color: "#888", fontSize: 12, marginTop: 2 },
  itemQtyPrice: { alignItems: "flex-end" },
  itemQty: { color: "#666", fontSize: 12, marginBottom: 4 },
  itemPrice: { fontWeight: "700", color: "#E85D04", fontSize: 14 },
  totalsBox: {
    marginTop: 16,
    backgroundColor: "#FFF3EB",
    borderRadius: 12,
    padding: 14,
  },
  totalLine: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  totalLabel: { color: "#555", fontSize: 14 },
  totalValue: { fontWeight: "600", color: "#333", fontSize: 14 },
  grandLine: { marginTop: 6, marginBottom: 0 },
  grandLabel: { fontWeight: "800", fontSize: 16, color: "#1a1a1a" },
  grandValue: { fontWeight: "800", fontSize: 18, color: "#E85D04" },
});
