import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { io } from "socket.io-client";
import { api, API_URL, getToken } from "../src/lib/api";
import { showAlert } from "../src/lib/alert";
import { LogoutButton } from "../src/components/LogoutButton";
import { StatsPeriodFilter } from "../src/components/StatsPeriodFilter";
import { formatMoney } from "../src/lib/formatMoney";
import { colors } from "../src/theme/colors";
import {
  defaultDay,
  defaultMonth,
  defaultYear,
  statsQueryString,
  type StatsPeriod,
} from "../src/lib/statsPeriod";
import { formatOrderInvoice } from "../src/lib/orderInvoice";
import { printRestaurantInvoice } from "../src/lib/printRestaurantInvoice";

type PartyInfo = { name: string; phone: string | null; vehicle?: string | null };

type IncomingOrder = {
  id: string;
  invoiceNumber?: string | null;
  paymentMethod?: string | null;
  status: string;
  total: number;
  subtotal?: number;
  deliveryFee?: number;
  createdAt?: string;
  updatedAt?: string;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  deliveryAddress: string;
  items: { productName: string; quantity: number; lineTotal: number }[];
  customer?: PartyInfo | null;
  captain?: PartyInfo | null;
};

function formatPartyLine(p: PartyInfo | null | undefined, fallback: string) {
  if (!p?.name) return fallback;
  const phone = p.phone?.trim() ? p.phone : "بدون رقم";
  const vehicle = p.vehicle?.trim() ? ` — ${p.vehicle}` : "";
  return `${p.name} — ${phone}${vehicle}`;
}

function formatRestaurantDateTime(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" });
}

function RestaurantOrderTimestamps({
  order,
}: {
  order: Pick<IncomingOrder, "createdAt" | "pickedUpAt" | "deliveredAt" | "updatedAt" | "status">;
}) {
  const orderTime = formatRestaurantDateTime(order.createdAt);
  const handoverTime = formatRestaurantDateTime(order.pickedUpAt);
  const isDelivered = order.status === "DELIVERED";
  const customerTime = isDelivered
    ? formatRestaurantDateTime(order.deliveredAt ?? order.updatedAt)
    : null;

  return (
    <View style={styles.orderDates}>
      {orderTime ? <Text style={styles.orderDate}>🕐 وقت الطلب: {orderTime}</Text> : null}
      {handoverTime ? (
        <Text style={styles.orderDateHandover}>🛵 وقت تسليم الكابتن: {handoverTime}</Text>
      ) : (
        <Text style={styles.orderDatePending}>وقت تسليم الكابتن: لم يُسلَّم بعد</Text>
      )}
      {isDelivered && customerTime ? (
        <Text style={styles.orderDateDelivered}>✓ وقت استلام العميل: {customerTime}</Text>
      ) : (
        <Text style={styles.orderDatePending}>وقت استلام العميل: لم يُستلم بعد</Text>
      )}
    </View>
  );
}

function OrderMoneySummary({ order }: { order: IncomingOrder }) {
  const itemsTotal = order.items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
  const deliveryFee = order.deliveryFee ?? 0;
  const total = order.total;

  return (
    <View style={styles.moneySummary}>
      <View style={styles.moneyRow}>
        <Text style={styles.moneyLabel}>إجمالي الطلب</Text>
        <Text style={styles.moneyValue}>{formatMoney(itemsTotal)} ر.س</Text>
      </View>
      <View style={styles.moneyRow}>
        <Text style={styles.moneyLabel}>أجرة التوصيل</Text>
        <Text style={styles.moneyValue}>{formatMoney(deliveryFee)} ر.س</Text>
      </View>
      <View style={styles.moneyDivider} />
      <View style={styles.moneyRow}>
        <Text style={styles.moneyGrandLabel}>الإجمالي المدفوع</Text>
        <Text style={styles.moneyGrand}>{formatMoney(total)} ر.س</Text>
      </View>
    </View>
  );
}

const STATUS_LABEL: Record<string, string> = {
  PAID: "تم الدفع — بانتظار التحضير",
  PREPARING: "قيد التحضير",
  READY_FOR_PICKUP: "جاهز للاستلام",
  CAPTAIN_ASSIGNED: "الكابتن معيّن — في الطريق أو بالمطعم",
  PICKED_UP: "استلمه الكابتن — في الطريق للعميل",
  DELIVERING: "جاري التوصيل للعميل",
};

const COMPLETED_STATUS_LABEL: Record<string, string> = {
  DELIVERED: "تم التسليم للعميل",
};

export default function RestaurantScreen() {
  const router = useRouter();
  const [incoming, setIncoming] = useState<IncomingOrder[]>([]);
  const [orderTab, setOrderTab] = useState<"active" | "completed">("active");
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [stats, setStats] = useState({ orderCount: 0, totalAmount: 0 });
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>("all");
  const [statsMonth, setStatsMonth] = useState(defaultMonth);
  const [statsYear, setStatsYear] = useState(defaultYear);
  const [statsDate, setStatsDate] = useState(defaultDay);
  const [restaurantName, setRestaurantName] = useState("المطعم");

  const loadOrders = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setOrdersLoading(true);
    setOrdersError(null);
    try {
      const filter = orderTab === "active" ? "active" : "completed";
      const res = await api<{ orders: IncomingOrder[] }>(
        `/api/orders/restaurant/incoming?filter=${filter}`
      );
      setIncoming(res.orders);
    } catch (e) {
      setIncoming([]);
      setOrdersError(e instanceof Error ? e.message : "تعذر تحميل الطلبات");
    } finally {
      if (!opts?.silent) setOrdersLoading(false);
    }
  }, [orderTab]);

  const loadStats = useCallback(async () => {
    try {
      const qs = statsQueryString(statsPeriod, statsMonth, statsYear, statsDate);
      const res = await api<{ orderCount: number; totalAmount: number }>(
        `/api/orders/restaurant/stats?${qs}`
      );
      setStats({
        orderCount: res.orderCount,
        totalAmount: Number(formatMoney(res.totalAmount)),
      });
    } catch {
      /* تجاهل */
    }
  }, [statsPeriod, statsMonth, statsYear, statsDate]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadOrders({ silent: true }), loadStats()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadOrders, loadStats]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    api<{ restaurant: { name: string } }>("/api/restaurant/me")
      .then((res) => setRestaurantName(res.restaurant.name))
      .catch(() => router.replace("/auth"));
  }, [router]);

  function handlePrintInvoice(order: IncomingOrder) {
    const itemsSubtotal = order.items.reduce((sum, item) => sum + Number(item.lineTotal), 0);

    printRestaurantInvoice({
      restaurantName,
      invoiceNumber: order.invoiceNumber,
      paymentMethod: order.paymentMethod,
      orderId: order.id,
      createdAt: order.createdAt,
      deliveryAddress: order.deliveryAddress,
      customerName: order.customer?.name,
      customerPhone: order.customer?.phone,
      items: order.items,
      subtotal: order.subtotal ?? itemsSubtotal,
      deliveryFee: order.deliveryFee ?? 0,
      total: order.total,
    });
  }

  useFocusEffect(
    useCallback(() => {
      void loadOrders();
      void loadStats();
    }, [loadOrders, loadStats])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      void loadOrders({ silent: true });
    }, 20000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  useEffect(() => {
    let socket: ReturnType<typeof io> | null = null;
    (async () => {
      const token = await getToken();
      if (!token) return;
      socket = io(API_URL, { auth: { token } });
      const onOrderEvent = () => {
        void loadOrders({ silent: true });
        void loadStats();
      };
      socket.on("order:paid", onOrderEvent);
      socket.on("order:update", onOrderEvent);
    })();
    return () => socket?.disconnect();
  }, [loadOrders, loadStats]);

  async function updateOrderStatus(
    orderId: string,
    status: "PREPARING" | "READY_FOR_PICKUP" | "PICKED_UP"
  ) {
    try {
      await api(`/api/orders/restaurant/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadOrders();
      const msg =
        status === "PREPARING"
          ? "بدأ تحضير الطلب"
          : status === "READY_FOR_PICKUP"
            ? "الطلب جاهز — سيظهر للكابتن"
            : "تم تسليم الطلب للكابتن";
      showAlert("تم", msg);
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "فشل تحديث الحالة");
    }
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refreshAll()} tintColor="#E85D04" />
      }
    >
      <View style={styles.topBar}>
        <View style={styles.topActions}>
          <LogoutButton redirectTo="/auth" />
          <Pressable style={styles.homeBtn} onPress={() => router.replace("/")}>
            <Text style={styles.homeBtnText}>الرئيسية</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>لوحة المطعم</Text>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>إحصائيات الطلبات</Text>
        <StatsPeriodFilter
          period={statsPeriod}
          onPeriodChange={setStatsPeriod}
          month={statsMonth}
          year={statsYear}
          date={statsDate}
          onMonthChange={setStatsMonth}
          onYearChange={setStatsYear}
          onDateChange={setStatsDate}
          theme="restaurant"
          surface="dark"
        />
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>عدد الطلبات</Text>
          <Text style={styles.statsValue}>{stats.orderCount}</Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>إجمالي المبيعات</Text>
          <Text style={styles.statsValue}>{formatMoney(stats.totalAmount)} ر.س</Text>
        </View>
      </View>

      <Text style={styles.section}>
        {orderTab === "active" ? "الطلبات الجارية" : "الطلبات المستلمة"}
      </Text>

      {orderTab === "completed" && (
        <Pressable style={styles.switchBtnOutline} onPress={() => setOrderTab("active")}>
          <Text style={styles.switchBtnOutlineText}>← الطلبات الجارية</Text>
        </Pressable>
      )}

      {ordersError ? <Text style={styles.ordersError}>{ordersError}</Text> : null}

      {ordersLoading ? (
        <ActivityIndicator color="#E85D04" style={{ marginVertical: 16 }} />
      ) : incoming.length === 0 ? (
        <Text style={styles.emptyOrders}>
          {orderTab === "active" ? "لا توجد طلبات جارية" : "لا توجد طلبات مستلمة"}
        </Text>
      ) : (
        incoming.map((order) => (
          <View key={order.id} style={styles.orderCard}>
            {formatOrderInvoice(order.invoiceNumber) ? (
              <Text style={styles.invoiceRef}>{formatOrderInvoice(order.invoiceNumber)}</Text>
            ) : null}
            <Text style={styles.orderStatus}>
              {orderTab === "active"
                ? STATUS_LABEL[order.status] ?? order.status
                : COMPLETED_STATUS_LABEL[order.status] ?? order.status}
            </Text>
            <RestaurantOrderTimestamps order={order} />
            <Text style={styles.orderAddr}>{order.deliveryAddress}</Text>
            <Text style={styles.partyLabel}>👤 العميل</Text>
            <Text style={styles.orderCustomer}>
              {formatPartyLine(order.customer, "بيانات العميل غير متوفرة")}
            </Text>
            <Text style={styles.partyLabel}>🛵 الكابتن</Text>
            <Text style={styles.orderCaptain}>
              {order.captain
                ? formatPartyLine(order.captain, "—")
                : "لم يُعيَّن كابتن بعد"}
            </Text>
            {order.items.map((item, idx) => (
              <Text key={idx} style={styles.orderItem}>
                {item.productName} × {item.quantity} — {formatMoney(item.lineTotal)} ر.س
              </Text>
            ))}
            <OrderMoneySummary order={order} />
            <Pressable style={styles.printBtn} onPress={() => handlePrintInvoice(order)}>
              <Text style={styles.printBtnText}>🖨️ طباعة الفاتورة</Text>
            </Pressable>
            {orderTab === "active" && order.status === "PAID" && (
              <Pressable style={styles.orderBtn} onPress={() => updateOrderStatus(order.id, "PREPARING")}>
                <Text style={styles.orderBtnText}>بدء التحضير</Text>
              </Pressable>
            )}
            {orderTab === "active" && order.status === "PREPARING" && (
              <Pressable
                style={[styles.orderBtn, styles.orderBtnReady]}
                onPress={() => updateOrderStatus(order.id, "READY_FOR_PICKUP")}
              >
                <Text style={styles.orderBtnText}>جاهز للاستلام</Text>
              </Pressable>
            )}
            {orderTab === "active" &&
              order.captain &&
              ["PREPARING", "READY_FOR_PICKUP", "CAPTAIN_ASSIGNED"].includes(order.status) && (
              <Pressable
                style={[styles.orderBtn, styles.orderBtnHandover]}
                onPress={() => updateOrderStatus(order.id, "PICKED_UP")}
              >
                <Text style={styles.orderBtnText}>تسليم للكابتن</Text>
              </Pressable>
            )}
          </View>
        ))
      )}

      {orderTab === "active" && !ordersLoading && (
        <Pressable style={styles.switchBtn} onPress={() => setOrderTab("completed")}>
          <Text style={styles.switchBtnText}>📦 الطلبات المستلمة</Text>
        </Pressable>
      )}

      <Pressable style={styles.homeLink} onPress={() => router.replace("/")}>
        <Text style={styles.homeLinkText}>← العودة للواجهة الرئيسية</Text>
      </Pressable>
    </ScrollView>
  );
}

const PAGE_PAD = 16;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: colors.bg,
  },
  topBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: PAGE_PAD,
  },
  topActions: { flexDirection: "row-reverse", gap: 8, alignItems: "center" },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "right",
    flex: 1,
    color: colors.text,
  },
  homeBtn: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.accentOrange,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  homeBtnText: { color: colors.accentOrange, fontWeight: "700" },
  statsCard: {
    backgroundColor: colors.bgCard,
    padding: PAGE_PAD,
    marginBottom: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  statsTitle: {
    fontWeight: "700",
    fontSize: 16,
    textAlign: "right",
    color: colors.accentOrange,
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statsLabel: { color: colors.textMuted, fontSize: 15, textAlign: "right" },
  statsValue: { fontWeight: "700", fontSize: 18, color: colors.text },
  homeLink: {
    marginTop: 12,
    padding: 14,
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  homeLinkText: { color: colors.accentOrange, fontWeight: "600", fontSize: 15 },
  section: {
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 8,
    textAlign: "right",
    color: colors.text,
    paddingHorizontal: PAGE_PAD,
  },
  emptyOrders: {
    textAlign: "center",
    color: colors.textDim,
    marginBottom: 8,
    paddingHorizontal: PAGE_PAD,
  },
  ordersError: {
    textAlign: "center",
    color: "#B45309",
    marginBottom: 8,
    fontWeight: "600",
    paddingHorizontal: PAGE_PAD,
  },
  switchBtn: {
    backgroundColor: colors.bgCard,
    padding: 14,
    marginTop: 8,
    marginBottom: 0,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  switchBtnText: { color: "#5EB3E8", fontWeight: "700" },
  switchBtnOutline: {
    backgroundColor: colors.bgCard,
    padding: 14,
    marginBottom: 0,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  switchBtnOutlineText: { color: colors.accentOrange, fontWeight: "700" },
  orderCard: {
    backgroundColor: colors.bgCard,
    padding: PAGE_PAD,
    paddingVertical: 14,
    borderRightWidth: 4,
    borderRightColor: colors.accentOrange,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  invoiceRef: {
    fontWeight: "700",
    fontSize: 15,
    color: colors.accentOrange,
    textAlign: "right",
    marginBottom: 6,
  },
  orderStatus: {
    fontWeight: "700",
    color: colors.accentOrange,
    textAlign: "right",
    marginBottom: 6,
  },
  orderDates: { marginBottom: 8, gap: 2 },
  orderDate: { textAlign: "right", color: colors.textMuted, fontSize: 12 },
  orderDateHandover: { textAlign: "right", color: "#5EB3E8", fontSize: 12, fontWeight: "600" },
  orderDateDelivered: { textAlign: "right", color: colors.success, fontSize: 12, fontWeight: "600" },
  orderDatePending: { textAlign: "right", color: colors.textDim, fontSize: 12 },
  orderAddr: { textAlign: "right", color: colors.textMuted, marginBottom: 8 },
  partyLabel: {
    textAlign: "right",
    fontWeight: "700",
    fontSize: 13,
    color: colors.text,
    marginTop: 4,
    marginBottom: 2,
  },
  orderCustomer: { textAlign: "right", color: colors.textMuted, marginBottom: 4 },
  orderCaptain: { textAlign: "right", color: "#5EB3E8", marginBottom: 8 },
  orderItem: { textAlign: "right", fontSize: 14, marginBottom: 2, color: colors.text },
  moneySummary: {
    backgroundColor: colors.bgElevated,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moneyRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  moneyLabel: { color: colors.textMuted, fontSize: 14, textAlign: "right" },
  moneyValue: { color: colors.text, fontWeight: "600", fontSize: 14 },
  moneyDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 6,
  },
  moneyGrandLabel: { color: colors.accentOrange, fontWeight: "700", fontSize: 15, textAlign: "right" },
  moneyGrand: { color: colors.accentOrange, fontWeight: "700", fontSize: 16 },
  printBtn: {
    backgroundColor: colors.bgElevated,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
  printBtnText: { color: colors.text, fontWeight: "700" },
  orderBtn: {
    backgroundColor: colors.accentOrange,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  orderBtnReady: { backgroundColor: colors.success },
  orderBtnHandover: { backgroundColor: "#0077B6" },
  orderBtnText: { color: "#FFF", fontWeight: "700" },
});
