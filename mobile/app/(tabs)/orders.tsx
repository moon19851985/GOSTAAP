import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { DarkScreen } from "../../src/components/DarkScreen";
import { api } from "../../src/lib/api";
import { isLoggedIn } from "../../src/lib/session";
import { showAlert } from "../../src/lib/alert";
import { formatMoney } from "../../src/lib/formatMoney";
import { colors } from "../../src/theme/colors";
import { formatOrderInvoice } from "../../src/lib/orderInvoice";

type CustomerOrder = {
  id: string;
  invoiceNumber?: string | null;
  status: string;
  total: number;
  deliveryFee: number;
  deliveryAddress: string;
  createdAt: string;
  captain?: { name: string; phone: string | null; vehicle: string | null } | null;
};

const STATUS_AR: Record<string, string> = {
  PAID: "تم الدفع",
  PREPARING: "قيد التحضير",
  READY_FOR_PICKUP: "جاهز للاستلام",
  CAPTAIN_ASSIGNED: "الكابتن في الطريق",
  PICKED_UP: "تم الاستلام",
  DELIVERING: "جاري التوصيل",
  DELIVERED: "تم التسليم",
};

const TRACKABLE = new Set([
  "PAID",
  "PREPARING",
  "READY_FOR_PICKUP",
  "CAPTAIN_ASSIGNED",
  "PICKED_UP",
  "DELIVERING",
]);

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "إلغاء", style: "cancel" },
    { text: "حذف", style: "destructive", onPress: onConfirm },
  ]);
}

export default function OrdersTab() {
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "history">("active");
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const loggedIn = await isLoggedIn();
    if (!loggedIn) {
      router.push("/auth");
      return;
    }
    try {
      const me = await api<{ user: { role: string } }>("/api/auth/me");
      setRole(me.user.role);
      if (me.user.role !== "CUSTOMER") {
        setOrders([]);
        return;
      }
      const filter = tab === "active" ? "active" : "history";
      const res = await api<{ orders: CustomerOrder[] }>(`/api/orders/my?filter=${filter}`);
      setOrders(res.orders);
    } catch {
      showAlert("خطأ", "تعذّر تحميل الطلبات");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [router, tab]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    load();
  }, [tab, load]);

  async function deleteOrder(orderId: string) {
    setDeletingId(orderId);
    try {
      await api(`/api/orders/${orderId}`, { method: "DELETE" });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "تعذّر حذف الطلب");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <DarkScreen title="الطلبات">
      <ScrollView contentContainerStyle={styles.content}>
        {role && role !== "CUSTOMER" ? (
          <View style={styles.roleRedirect}>
            <Text style={styles.hint}>
              {role === "RESTAURANT"
                ? "ادخل إلى لوحة المطعم لإدارة الطلبات."
                : "إدارة التوصيل من لوحة الكابتن."}
            </Text>
            {role === "CAPTAIN" && (
              <Pressable style={styles.captainBtn} onPress={() => router.push("/captain")}>
                <Text style={styles.captainBtnText}>🛵 لوحة الكابتن</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            <View style={styles.tabs}>
              <Pressable
                style={[styles.tabBtn, tab === "active" && styles.tabBtnActive]}
                onPress={() => setTab("active")}
              >
                <Text style={[styles.tabText, tab === "active" && styles.tabTextActive]}>
                  جارية
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tabBtn, tab === "history" && styles.tabBtnActive]}
                onPress={() => setTab("history")}
              >
                <Text style={[styles.tabText, tab === "history" && styles.tabTextActive]}>
                  سابقة
                </Text>
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
            ) : orders.length === 0 ? (
              <Text style={styles.empty}>
                {tab === "active" ? "لا توجد طلبات جارية" : "لا توجد طلبات سابقة"}
              </Text>
            ) : (
              orders.map((o) => (
                <View key={o.id} style={styles.orderCard}>
                  {formatOrderInvoice(o.invoiceNumber) ? (
                    <Text style={styles.invoiceRef}>{formatOrderInvoice(o.invoiceNumber)}</Text>
                  ) : null}
                  <Text style={styles.orderStatus}>{STATUS_AR[o.status] ?? o.status}</Text>
                  <Text style={styles.orderDate}>
                    {new Date(o.createdAt).toLocaleString("ar-SA")}
                  </Text>
                  <Text style={styles.orderAddr}>{o.deliveryAddress}</Text>
                  <Text style={styles.orderTotal}>
                    الإجمالي: {formatMoney(o.total)} ر.س
                  </Text>
                  {tab === "active" && TRACKABLE.has(o.status) && (
                    <Pressable
                      style={styles.trackBtn}
                      onPress={() => router.push(`/track/${o.id}`)}
                    >
                      <Text style={styles.trackBtnText}>📍 تتبع الطلب</Text>
                    </Pressable>
                  )}
                  {tab === "history" && (
                    <Pressable
                      style={styles.deleteBtn}
                      disabled={deletingId === o.id}
                      onPress={() =>
                        confirmAction("حذف الطلب", "حذف من القائمة؟", () => deleteOrder(o.id))
                      }
                    >
                      <Text style={styles.deleteBtnText}>
                        {deletingId === o.id ? "..." : "حذف"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </DarkScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 24 },
  roleRedirect: { alignItems: "center", marginTop: 48, gap: 16 },
  hint: { textAlign: "center", color: colors.textMuted, lineHeight: 24 },
  captainBtn: {
    backgroundColor: "#0077B6",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  captainBtnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  tabs: { flexDirection: "row-reverse", gap: 8, marginBottom: 16 },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  tabBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.textMuted, fontWeight: "700" },
  tabTextActive: { color: colors.bg },
  empty: { textAlign: "center", color: colors.textDim, marginTop: 32 },
  orderCard: {
    backgroundColor: colors.bgCard,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRightWidth: 3,
    borderRightColor: colors.accentOrange,
  },
  invoiceRef: {
    fontWeight: "700",
    fontSize: 15,
    color: colors.accentOrange,
    textAlign: "right",
    marginBottom: 4,
  },
  orderStatus: { fontWeight: "700", textAlign: "right", color: colors.accent },
  orderDate: { textAlign: "right", color: colors.textDim, fontSize: 12, marginTop: 4 },
  orderAddr: { textAlign: "right", color: colors.textMuted, marginTop: 4, fontSize: 13 },
  orderTotal: { textAlign: "right", color: colors.text, marginTop: 6, fontWeight: "700" },
  trackBtn: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.accentOrange,
  },
  trackBtnText: { color: colors.accentOrange, fontWeight: "700" },
  deleteBtn: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#3A2020",
  },
  deleteBtnText: { color: colors.danger, fontWeight: "700" },
});
