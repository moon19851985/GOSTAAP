import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { DarkScreen } from "../src/components/DarkScreen";
import { LogoutButton } from "../src/components/LogoutButton";
import { api } from "../src/lib/api";
import { formatMoney } from "../src/lib/formatMoney";
import { formatOrderInvoice } from "../src/lib/orderInvoice";
import {
  formatInvoicePaymentStatus,
  formatPaymentMethodLabel,
} from "../src/lib/orderPayment";
import { showAlert } from "../src/lib/alert";
import { colors } from "../src/theme/colors";

type Tab =
  | "overview"
  | "orders"
  | "invoices"
  | "restaurants"
  | "captains"
  | "customers";

type Finance = {
  restaurantCommissionPct: number;
  captainCommissionPct: number;
  collected: number;
  deliveredRevenue: number;
  inProgressHeld: number;
  restaurantGross: number;
  restaurantCommission: number;
  restaurantNetOwed: number;
  restaurantPending: number;
  restaurantPaid: number;
  captainGross: number;
  captainCommission: number;
  captainNetOwed: number;
  captainPending: number;
  captainPaid: number;
  platformCommission: number;
  platformHeld: number;
  platformAfterPayouts: number;
};

type PaymentBreakdown = Record<string, { orderCount: number; totalAmount: number }>;

type RestaurantRow = {
  id: string;
  name: string;
  email: string;
  orderCount: number;
  salesGross: number;
  platformCommission: number;
  salesNet: number;
  paidOut: number;
  pending: number;
};

type CaptainRow = {
  id: string;
  name: string;
  email: string;
  isOnline: boolean;
  deliveredCount: number;
  feesGross: number;
  platformCommission: number;
  feesNet: number;
  paidOut: number;
  pending: number;
};

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  orderCount: number;
  spentTotal: number;
};

type OrderRow = {
  id: string;
  invoiceNumber?: string | null;
  status: string;
  total: number;
  deliveryFee: number;
  deliveryAddress: string;
  createdAt: string;
  paymentMethod?: string | null;
  customerName: string;
  customerEmail: string;
  captainName?: string | null;
  restaurantNames?: string | null;
};

type InvoiceRow = {
  orderId: string;
  invoiceNumber: string;
  status: string;
  total: number;
  createdAt: string;
  paymentMethod?: string | null;
  customerName: string;
  customerEmail: string;
  codPending?: boolean;
};

const ORDER_STATUS_AR: Record<string, string> = {
  PAID: "مؤكد",
  PREPARING: "يحضّر المطعم",
  READY_FOR_PICKUP: "جاهز للاستلام",
  CAPTAIN_ASSIGNED: "كابتن معيّن",
  PICKED_UP: "تم الاستلام",
  DELIVERING: "جاري التوصيل",
  DELIVERED: "مُسلَّم",
  CANCELLED: "ملغي",
};

const ORDER_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "PAID", label: "جديد" },
  { key: "PREPARING", label: "تحضير" },
  { key: "DELIVERING", label: "توصيل" },
  { key: "DELIVERED", label: "مُسلَّم" },
];

export default function AdminScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [finance, setFinance] = useState<Finance | null>(null);
  const [userCounts, setUserCounts] = useState({ customers: 0, restaurants: 0, captains: 0 });
  const [orderCounts, setOrderCounts] = useState({
    paid: 0,
    delivered: 0,
    active: 0,
    today: 0,
    todayRevenue: 0,
  });
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown>({});
  const [restaurants, setRestaurants] = useState<RestaurantRow[]>([]);
  const [captains, setCaptains] = useState<CaptainRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [orderFilter, setOrderFilter] = useState("all");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutTarget, setPayoutTarget] = useState<{
    type: "RESTAURANT" | "CAPTAIN";
    id: string;
    name: string;
    pending: number;
  } | null>(null);
  const [restCommissionInput, setRestCommissionInput] = useState("12");
  const [capCommissionInput, setCapCommissionInput] = useState("8");
  const [savingCommission, setSavingCommission] = useState(false);

  const loadOrders = useCallback(async (status: string) => {
    const qs = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
    const res = await api<{ orders: OrderRow[] }>(`/api/admin/orders${qs}`);
    setOrders(res.orders);
  }, []);

  const load = useCallback(async () => {
    const [overview, rest, caps, cust, inv] = await Promise.all([
      api<{
        users: { customers: number; restaurants: number; captains: number };
        orders: {
          paid: number;
          delivered: number;
          active: number;
          today: number;
          todayRevenue: number;
        };
        paymentBreakdown: PaymentBreakdown;
        finance: Finance;
      }>("/api/admin/overview"),
      api<{ restaurants: RestaurantRow[] }>("/api/admin/restaurants"),
      api<{ captains: CaptainRow[] }>("/api/admin/captains"),
      api<{ customers: CustomerRow[] }>("/api/admin/customers"),
      api<{ invoices: InvoiceRow[] }>("/api/admin/invoices"),
    ]);
    setUserCounts(overview.users);
    setOrderCounts(overview.orders);
    setPaymentBreakdown(overview.paymentBreakdown);
    setFinance(overview.finance);
    setRestCommissionInput(String(overview.finance.restaurantCommissionPct));
    setCapCommissionInput(String(overview.finance.captainCommissionPct));
    setRestaurants(rest.restaurants);
    setCaptains(caps.captains);
    setCustomers(cust.customers);
    setInvoices(inv.invoices);
    await loadOrders(orderFilter);
  }, [loadOrders, orderFilter]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const me = await api<{ user: { role: string } }>("/api/auth/me");
          if (cancelled) return;
          if (me.user.role !== "ADMIN") {
            showAlert("غير مصرح", "لوحة الإدارة للمدير فقط");
            router.replace("/account");
            return;
          }
          await load();
        } catch {
          if (!cancelled) router.replace("/auth");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [load, router])
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "فشل التحديث");
    } finally {
      setRefreshing(false);
    }
  }

  async function changeOrderFilter(key: string) {
    setOrderFilter(key);
    try {
      await loadOrders(key);
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "فشل تحميل الطلبات");
    }
  }

  async function saveCommission() {
    const restaurantCommissionPct = Number(restCommissionInput.replace(",", "."));
    const captainCommissionPct = Number(capCommissionInput.replace(",", "."));
    if (
      !Number.isFinite(restaurantCommissionPct) ||
      !Number.isFinite(captainCommissionPct) ||
      restaurantCommissionPct < 0 ||
      captainCommissionPct < 0 ||
      restaurantCommissionPct > 50 ||
      captainCommissionPct > 50
    ) {
      showAlert("تنبيه", "أدخل نسباً بين 0 و 50");
      return;
    }
    setSavingCommission(true);
    try {
      const res = await api<{ finance: Finance }>("/api/admin/commission", {
        method: "PATCH",
        body: JSON.stringify({ restaurantCommissionPct, captainCommissionPct }),
      });
      setFinance(res.finance);
      setRestCommissionInput(String(res.finance.restaurantCommissionPct));
      setCapCommissionInput(String(res.finance.captainCommissionPct));
      await load();
      showAlert("تم", "حُفظت نسب العمولة");
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setSavingCommission(false);
    }
  }

  async function submitPayout() {
    if (!payoutTarget) return;
    const amount = Number(payoutAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      showAlert("تنبيه", "أدخل مبلغاً صحيحاً");
      return;
    }
    try {
      await api("/api/admin/payouts", {
        method: "POST",
        body: JSON.stringify({
          type: payoutTarget.type,
          beneficiaryId: payoutTarget.id,
          amount,
          note: "تسليم من لوحة الإدارة",
        }),
      });
      showAlert("تم", `سُجّل تسليم ${formatMoney(amount)} ر.س لـ ${payoutTarget.name}`);
      setPayoutTarget(null);
      setPayoutAmount("");
      await load();
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "فشل التسجيل");
    }
  }

  if (loading) {
    return (
      <DarkScreen title="لوحة الإدارة">
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </DarkScreen>
    );
  }

  return (
    <DarkScreen title="لوحة الإدارة">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.topRow}>
          <LogoutButton redirectTo="/auth" />
          <Pressable onPress={() => router.replace("/")}>
            <Text style={styles.link}>الرئيسية</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          متابعة العملاء والمطاعم والكباتن والطلبات والفواتير والتحليلات المالية.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          <View style={styles.tabs}>
            {(
              [
                ["overview", "ملخص"],
                ["orders", "طلبات"],
                ["invoices", "فواتير"],
                ["restaurants", "مطاعم"],
                ["captains", "كباتن"],
                ["customers", "عملاء"],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <Pressable
                key={key}
                style={[styles.tab, tab === key && styles.tabActive]}
                onPress={() => setTab(key)}
              >
                <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {tab === "overview" && finance && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>اليوم</Text>
            <Stat label="طلبات اليوم" value={String(orderCounts.today)} />
            <Stat
              label="إيراد اليوم"
              value={`${formatMoney(orderCounts.todayRevenue)} ر.س`}
            />

            <Text style={styles.sectionTitle}>المستخدمون</Text>
            <View style={styles.rowStats}>
              <MiniStat label="عملاء" value={userCounts.customers} />
              <MiniStat label="مطاعم" value={userCounts.restaurants} />
              <MiniStat label="كباتن" value={userCounts.captains} />
            </View>

            <Text style={styles.sectionTitle}>الطلبات</Text>
            <Stat label="طلبات مؤكدة" value={String(orderCounts.paid)} />
            <Stat label="قيد التنفيذ الآن" value={String(orderCounts.active)} highlight />
            <Stat label="مُسلَّمة" value={String(orderCounts.delivered)} />

            <Text style={styles.sectionTitle}>حسب طريقة الدفع</Text>
            {(["VISA", "MADA", "COD"] as const).map((method) => {
              const row = paymentBreakdown[method];
              if (!row) return null;
              return (
                <Stat
                  key={method}
                  label={formatPaymentMethodLabel(method)}
                  value={`${row.orderCount} طلب — ${formatMoney(row.totalAmount)} ر.س`}
                />
              );
            })}

            <Text style={styles.sectionTitle}>نسب عمولة المنصة</Text>
            <Text style={styles.commissionHint}>
              تُطبَّق على الطلبات المُسلَّمة فقط — من مبيعات المطعم وأجرة الكابتن.
            </Text>
            <View style={styles.commissionRow}>
              <Text style={styles.commissionLabel}>مطاعم %</Text>
              <TextInput
                style={styles.commissionInput}
                value={restCommissionInput}
                onChangeText={setRestCommissionInput}
                keyboardType="decimal-pad"
                textAlign="center"
                placeholderTextColor={colors.textDim}
              />
              <Text style={styles.commissionLabel}>كباتن %</Text>
              <TextInput
                style={styles.commissionInput}
                value={capCommissionInput}
                onChangeText={setCapCommissionInput}
                keyboardType="decimal-pad"
                textAlign="center"
                placeholderTextColor={colors.textDim}
              />
            </View>
            <Pressable
              style={[styles.saveCommissionBtn, savingCommission && styles.disabledBtn]}
              onPress={() => void saveCommission()}
              disabled={savingCommission}
            >
              <Text style={styles.saveCommissionText}>
                {savingCommission ? "جاري الحفظ..." : "حفظ النسب"}
              </Text>
            </Pressable>

            <Text style={styles.sectionTitle}>التحليلات المالية</Text>
            <Stat label="إجمالي المحصّل" value={`${formatMoney(finance.collected)} ر.س`} />
            <Stat
              label="من طلبات مُسلَّمة"
              value={`${formatMoney(finance.deliveredRevenue)} ر.س`}
              sub={`قيد التنفيذ (لم تُحسب العمولة): ${formatMoney(finance.inProgressHeld)} ر.س`}
            />
            <Stat
              label="عمولة المنصة — مطاعم"
              value={`${formatMoney(finance.restaurantCommission)} ر.س`}
              sub={`من إجمالي ${formatMoney(finance.restaurantGross)} ر.س (${finance.restaurantCommissionPct}%)`}
            />
            <Stat
              label="عمولة المنصة — كباتن"
              value={`${formatMoney(finance.captainCommission)} ر.س`}
              sub={`من إجمالي ${formatMoney(finance.captainGross)} ر.س (${finance.captainCommissionPct}%)`}
            />
            <Stat
              label="إجمالي عمولة المنصة"
              value={`${formatMoney(finance.platformCommission)} ر.س`}
              highlight
            />
            <Stat
              label="صافي مستحق للمطاعم"
              value={`${formatMoney(finance.restaurantPending)} ر.س`}
              sub={`بعد العمولة — مُسلَّم: ${formatMoney(finance.restaurantPaid)} ر.س`}
            />
            <Stat
              label="صافي مستحق للكباتن"
              value={`${formatMoney(finance.captainPending)} ر.س`}
              sub={`بعد العمولة — مُسلَّم: ${formatMoney(finance.captainPaid)} ر.س`}
            />
            <Stat label="إجمالي عند المنصة" value={`${formatMoney(finance.platformHeld)} ر.س`} />
            <Stat
              label="بعد تسليم المستحقات"
              value={`${formatMoney(finance.platformAfterPayouts)} ر.س`}
            />
          </View>
        )}

        {tab === "orders" && (
          <View style={styles.section}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterRow}>
                {ORDER_FILTERS.map((f) => (
                  <Pressable
                    key={f.key}
                    style={[styles.filterChip, orderFilter === f.key && styles.filterChipActive]}
                    onPress={() => void changeOrderFilter(f.key)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        orderFilter === f.key && styles.filterChipTextActive,
                      ]}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {orders.length === 0 ? (
              <Text style={styles.empty}>لا توجد طلبات</Text>
            ) : (
              orders.map((o) => (
                <View key={o.id} style={styles.card}>
                  {formatOrderInvoice(o.invoiceNumber) ? (
                    <Text style={styles.invoiceRef}>{formatOrderInvoice(o.invoiceNumber)}</Text>
                  ) : null}
                  <Text style={styles.cardTitle}>
                    {ORDER_STATUS_AR[o.status] ?? o.status} — {formatMoney(o.total)} ر.س
                  </Text>
                  <Text style={styles.cardMeta}>
                    {o.customerName} — {o.customerEmail}
                  </Text>
                  <Text style={styles.cardLine}>
                    الدفع: {formatPaymentMethodLabel(o.paymentMethod)} —{" "}
                    {formatInvoicePaymentStatus(o.paymentMethod)}
                  </Text>
                  {o.restaurantNames ? (
                    <Text style={styles.cardLine}>المطاعم: {o.restaurantNames}</Text>
                  ) : null}
                  {o.captainName ? (
                    <Text style={styles.cardLine}>الكابتن: {o.captainName}</Text>
                  ) : null}
                  <Text style={styles.cardLine} numberOfLines={2}>
                    📍 {o.deliveryAddress}
                  </Text>
                  <Text style={styles.cardDim}>
                    {new Date(o.createdAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {tab === "invoices" && (
          <View style={styles.section}>
            {invoices.length === 0 ? (
              <Text style={styles.empty}>لا توجد فواتير</Text>
            ) : (
              invoices.map((inv) => (
                <View key={inv.orderId} style={styles.card}>
                  <Text style={styles.invoiceRef}>
                    {formatOrderInvoice(inv.invoiceNumber) ?? inv.invoiceNumber}
                  </Text>
                  <Text style={styles.cardTitle}>{inv.customerName}</Text>
                  <Text style={styles.cardMeta}>{inv.customerEmail}</Text>
                  <Text style={styles.cardLine}>
                    المبلغ: {formatMoney(inv.total)} ر.س —{" "}
                    {ORDER_STATUS_AR[inv.status] ?? inv.status}
                  </Text>
                  <Text style={styles.cardLine}>
                    {formatPaymentMethodLabel(inv.paymentMethod)} —{" "}
                    {formatInvoicePaymentStatus(inv.paymentMethod)}
                  </Text>
                  {inv.codPending ? (
                    <Text style={styles.codWarn}>⚠️ لم يُحصَّل المبلغ بعد — دفع عند الاستلام</Text>
                  ) : null}
                  <Text style={styles.cardDim}>
                    {new Date(inv.createdAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {tab === "restaurants" && (
          <View style={styles.section}>
            {restaurants.map((r) => (
              <View key={r.id} style={styles.card}>
                <Text style={styles.cardTitle}>{r.name}</Text>
                <Text style={styles.cardMeta}>{r.email}</Text>
                <Text style={styles.cardLine}>طلبات مُسلَّمة: {r.orderCount}</Text>
                <Text style={styles.cardLine}>مبيعات: {formatMoney(r.salesGross)} ر.س</Text>
                <Text style={styles.cardLine}>
                  عمولة المنصة: {formatMoney(r.platformCommission)} ر.س
                </Text>
                <Text style={styles.cardLine}>صافي المطعم: {formatMoney(r.salesNet)} ر.س</Text>
                <Text style={styles.cardPending}>مستحق للتسليم: {formatMoney(r.pending)} ر.س</Text>
                {r.pending > 0 ? (
                  <Pressable
                    style={styles.payoutBtn}
                    onPress={() => {
                      setPayoutTarget({
                        type: "RESTAURANT",
                        id: r.id,
                        name: r.name,
                        pending: r.pending,
                      });
                      setPayoutAmount(String(r.pending));
                    }}
                  >
                    <Text style={styles.payoutBtnText}>تسجيل تسليم مستحقات</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {tab === "captains" && (
          <View style={styles.section}>
            {captains.map((c) => (
              <View key={c.id} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {c.name} {c.isOnline ? "🟢 متصل" : "⚪ غير متصل"}
                </Text>
                <Text style={styles.cardMeta}>{c.email}</Text>
                <Text style={styles.cardLine}>توصيلات مُسلَّمة: {c.deliveredCount}</Text>
                <Text style={styles.cardLine}>أجور: {formatMoney(c.feesGross)} ر.س</Text>
                <Text style={styles.cardLine}>
                  عمولة المنصة: {formatMoney(c.platformCommission)} ر.س
                </Text>
                <Text style={styles.cardLine}>صافي الكابتن: {formatMoney(c.feesNet)} ر.س</Text>
                <Text style={styles.cardPending}>مستحق للتسليم: {formatMoney(c.pending)} ر.س</Text>
                {c.pending > 0 ? (
                  <Pressable
                    style={styles.payoutBtn}
                    onPress={() => {
                      setPayoutTarget({
                        type: "CAPTAIN",
                        id: c.id,
                        name: c.name,
                        pending: c.pending,
                      });
                      setPayoutAmount(String(c.pending));
                    }}
                  >
                    <Text style={styles.payoutBtnText}>تسجيل تسليم أجور</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {tab === "customers" && (
          <View style={styles.section}>
            {customers.map((c) => (
              <View key={c.id} style={styles.card}>
                <Text style={styles.cardTitle}>{c.name}</Text>
                <Text style={styles.cardMeta}>{c.email}</Text>
                <Text style={styles.cardLine}>طلبات: {c.orderCount}</Text>
                <Text style={styles.cardLine}>إنفاق: {formatMoney(c.spentTotal)} ر.س</Text>
              </View>
            ))}
          </View>
        )}

        {payoutTarget ? (
          <View style={styles.payoutSheet}>
            <Text style={styles.payoutTitle}>تسليم لـ {payoutTarget.name}</Text>
            <Text style={styles.cardPending}>
              المستحق: {formatMoney(payoutTarget.pending)} ر.س
            </Text>
            <TextInput
              style={styles.payoutInput}
              value={payoutAmount}
              onChangeText={setPayoutAmount}
              keyboardType="decimal-pad"
              placeholder="المبلغ"
              placeholderTextColor={colors.textDim}
              textAlign="right"
            />
            <View style={styles.payoutActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setPayoutTarget(null)}>
                <Text style={styles.cancelText}>إلغاء</Text>
              </Pressable>
              <Pressable style={styles.payoutBtn} onPress={submitPayout}>
                <Text style={styles.payoutBtnText}>تأكيد التسليم</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </DarkScreen>
  );
}

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.stat, highlight && styles.statHighlight]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 200 },
  topRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  link: { color: colors.accent, fontWeight: "700" },
  hint: {
    color: colors.textMuted,
    textAlign: "right",
    lineHeight: 22,
    marginBottom: 16,
    fontSize: 13,
  },
  tabsScroll: { marginBottom: 16 },
  tabs: { flexDirection: "row-reverse", gap: 8, paddingBottom: 4 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.bgElevated,
  },
  tabActive: { backgroundColor: colors.accent },
  tabText: { color: colors.textMuted, fontWeight: "600" },
  tabTextActive: { color: "#111" },
  section: { gap: 10 },
  sectionTitle: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 17,
    textAlign: "right",
    marginTop: 8,
    marginBottom: 4,
  },
  rowStats: { flexDirection: "row-reverse", gap: 8, marginBottom: 8 },
  miniStat: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  miniStatValue: { color: colors.text, fontWeight: "800", fontSize: 20 },
  miniStatLabel: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  stat: {
    backgroundColor: colors.bgCard,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  statHighlight: { borderWidth: 1, borderColor: colors.accent },
  statLabel: { color: colors.textMuted, textAlign: "right", fontSize: 13 },
  statValue: { color: colors.text, fontWeight: "700", fontSize: 18, textAlign: "right", marginTop: 4 },
  statSub: { color: colors.textDim, textAlign: "right", fontSize: 12, marginTop: 4 },
  filterRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.accentOrange, borderColor: colors.accentOrange },
  filterChipText: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
  filterChipTextActive: { color: "#FFF" },
  card: {
    backgroundColor: colors.bgCard,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.text, fontWeight: "700", fontSize: 16, textAlign: "right" },
  cardMeta: { color: colors.textMuted, textAlign: "right", marginTop: 4, fontSize: 13 },
  cardLine: { color: colors.text, textAlign: "right", marginTop: 6, fontSize: 14 },
  cardDim: { color: colors.textDim, textAlign: "right", marginTop: 6, fontSize: 12 },
  cardPending: {
    color: colors.accent,
    fontWeight: "700",
    textAlign: "right",
    marginTop: 8,
  },
  invoiceRef: {
    color: colors.accentOrange,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 6,
    fontSize: 14,
  },
  codWarn: {
    color: "#F59E0B",
    fontWeight: "700",
    textAlign: "right",
    marginTop: 8,
    fontSize: 13,
  },
  empty: { textAlign: "center", color: colors.textDim, marginVertical: 24 },
  commissionHint: {
    color: colors.textDim,
    textAlign: "right",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  commissionRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  commissionLabel: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
  commissionInput: {
    flex: 1,
    maxWidth: 72,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    color: colors.text,
    fontWeight: "700",
    fontSize: 16,
  },
  saveCommissionBtn: {
    backgroundColor: colors.accent,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  saveCommissionText: { color: "#111", fontWeight: "800" },
  disabledBtn: { opacity: 0.6 },
  payoutBtn: {
    backgroundColor: colors.accentOrange,
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    alignItems: "center",
  },
  payoutBtnText: { color: "#FFF", fontWeight: "700" },
  payoutSheet: {
    marginTop: 20,
    padding: 16,
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  payoutTitle: { color: colors.text, fontWeight: "700", textAlign: "right", marginBottom: 8 },
  payoutInput: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    marginVertical: 10,
  },
  payoutActions: { flexDirection: "row-reverse", gap: 10 },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  cancelText: { color: colors.textMuted, fontWeight: "600" },
});
