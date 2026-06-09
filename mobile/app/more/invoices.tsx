import { useCallback, useState } from "react";
import { ScrollView, Text, StyleSheet, ActivityIndicator, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { DarkScreen } from "../../src/components/DarkScreen";
import { api } from "../../src/lib/api";
import { isLoggedIn } from "../../src/lib/session";
import { formatMoney } from "../../src/lib/formatMoney";
import { colors } from "../../src/theme/colors";

type Order = {
  id: string;
  status: string;
  total: number;
  deliveryAddress: string;
  createdAt: string;
};

export default function InvoicesScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        if (!(await isLoggedIn())) {
          router.replace("/auth");
          return;
        }
        try {
          const res = await api<{ orders: Order[] }>("/api/orders/my?filter=history");
          setOrders(res.orders.filter((o) => o.status === "DELIVERED"));
        } catch {
          setOrders([]);
        } finally {
          setLoading(false);
        }
      })();
    }, [router])
  );

  return (
    <DarkScreen title="الفواتير المدفوعة" showBack>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
        ) : orders.length === 0 ? (
          <Text style={styles.empty}>لا توجد فواتير مدفوعة</Text>
        ) : (
          orders.map((o) => (
            <View key={o.id} style={styles.card}>
              <Text style={styles.amount}>{formatMoney(o.total)} ر.س</Text>
              <Text style={styles.addr}>{o.deliveryAddress}</Text>
              <Text style={styles.date}>
                {new Date(o.createdAt).toLocaleString("ar-SA")}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </DarkScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  empty: { textAlign: "center", color: colors.textDim, marginTop: 40 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amount: { textAlign: "right", color: colors.accent, fontWeight: "800", fontSize: 18 },
  addr: { textAlign: "right", color: colors.textMuted, marginTop: 6, fontSize: 13 },
  date: { textAlign: "right", color: colors.textDim, marginTop: 4, fontSize: 12 },
});
