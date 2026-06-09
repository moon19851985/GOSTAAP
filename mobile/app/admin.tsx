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
import { showAlert } from "../src/lib/alert";
import { colors } from "../src/theme/colors";

type Tab = "finance" | "restaurants" | "captains" | "customers";

type Finance = {
  collected: number;
  restaurantPending: number;
  captainPending: number;
  platformHeld: number;
  restaurantPaid: number;
  captainPaid: number;
};

type RestaurantRow = {
  id: string;
  name: string;
  email: string;
  orderCount: number;
  salesTotal: number;
  paidOut: number;
  pending: number;
};

type CaptainRow = {
  id: string;
  name: string;
  email: string;
  isOnline: boolean;
  deliveredCount: number;
  feesTotal: number;
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

export default function AdminScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("finance");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [finance, setFinance] = useState<Finance | null>(null);
  const [userCounts, setUserCounts] = useState({ customers: 0, restaurants: 0, captains: 0 });
  const [orderCounts, setOrderCounts] = useState({ paid: 0, delivered: 0 });
  const [restaurants, setRestaurants] = useState<RestaurantRow[]>([]);
  const [captains, setCaptains] = useState<CaptainRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutTarget, setPayoutTarget] = useState<{
    type: "RESTAURANT" | "CAPTAIN";
    id: string;
    name: string;
    pending: number;
  } | null>(null);

  const load = useCallback(async () => {
    const [overview, rest, caps, cust] = await Promise.all([
      api<{
        users: { customers: number; restaurants: number; captains: number };
        orders: { paid: number; delivered: number };
        finance: Finance;
      }>("/api/admin/overview"),
      api<{ restaurants: RestaurantRow[] }>("/api/admin/restaurants"),
      api<{ captains: CaptainRow[] }>("/api/admin/captains"),
      api<{ customers: CustomerRow[] }>("/api/admin/customers"),
    ]);
    setUserCounts(overview.users);
    setOrderCounts(overview.orders);
    setFinance(overview.finance);
    setRestaurants(rest.restaurants);
    setCaptains(caps.captains);
    setCustomers(cust.customers);
  }, []);

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
          المبالغ المدفوعة من العملاء تصل لحساب المنصة — ثم تُسَلَّم للمطاعم (مبيعات) والكباتن
          (أجور توصيل مُسلَّمة).
        </Text>

        <View style={styles.tabs}>
          {(
            [
              ["finance", "ملخص"],
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

        {tab === "finance" && finance && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>المتابعة المالية</Text>
            <Stat label="إجمالي المحصّل من العملاء" value={`${formatMoney(finance.collected)} ر.س`} />
            <Stat
              label="مستحق للمطاعم (مبيعات)"
              value={`${formatMoney(finance.restaurantPending)} ر.س`}
              sub={`تم تسليمه: ${formatMoney(finance.restaurantPaid)} ر.س`}
            />
            <Stat
              label="مستحق للكباتن (توصيل مُسلَّم)"
              value={`${formatMoney(finance.captainPending)} ر.س`}
              sub={`تم تسليمه: ${formatMoney(finance.captainPaid)} ر.س`}
            />
            <Stat label="عند المنصة (تقريبي)" value={`${formatMoney(finance.platformHeld)} ر.س`} />
            <Text style={styles.sectionTitle}>المستخدمون والطلبات</Text>
            <Stat label="عملاء" value={String(userCounts.customers)} />
            <Stat label="مطاعم" value={String(userCounts.restaurants)} />
            <Stat label="كباتن" value={String(userCounts.captains)} />
            <Stat label="طلبات مدفوعة" value={String(orderCounts.paid)} />
            <Stat label="طلبات مُسلَّمة" value={String(orderCounts.delivered)} />
          </View>
        )}

        {tab === "restaurants" && (
          <View style={styles.section}>
            {restaurants.map((r) => (
              <View key={r.id} style={styles.card}>
                <Text style={styles.cardTitle}>{r.name}</Text>
                <Text style={styles.cardMeta}>{r.email}</Text>
                <Text style={styles.cardLine}>طلبات: {r.orderCount}</Text>
                <Text style={styles.cardLine}>مبيعات: {formatMoney(r.salesTotal)} ر.س</Text>
                <Text style={styles.cardPending}>مستحق: {formatMoney(r.pending)} ر.س</Text>
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
                <Text style={styles.cardLine}>أجور: {formatMoney(c.feesTotal)} ر.س</Text>
                <Text style={styles.cardPending}>مستحق: {formatMoney(c.pending)} ر.س</Text>
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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
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
  tabs: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 16 },
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
  stat: {
    backgroundColor: colors.bgCard,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  statLabel: { color: colors.textMuted, textAlign: "right", fontSize: 13 },
  statValue: { color: colors.text, fontWeight: "700", fontSize: 18, textAlign: "right", marginTop: 4 },
  statSub: { color: colors.textDim, textAlign: "right", fontSize: 12, marginTop: 4 },
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
  cardLine: { color: colors.text, textAlign: "right", marginTop: 6 },
  cardPending: {
    color: colors.accent,
    fontWeight: "700",
    textAlign: "right",
    marginTop: 8,
  },
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
