import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Linking,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { io, type Socket } from "socket.io-client";
import { api, API_URL, getToken } from "../../src/lib/api";
import { DeliveryMap } from "../../src/components/DeliveryMap";
import { CaptainCarTopIcon } from "../../src/components/CaptainCarTopIcon";
import { formatOrderInvoice } from "../../src/lib/orderInvoice";
import { OrderInvoiceSheet } from "../../src/components/OrderInvoiceSheet";

type CaptainInfo = {
  id: string;
  name: string;
  phone: string | null;
  vehicle: string | null;
  lat: number | null;
  lng: number | null;
  updatedAt?: string;
};

type TrackData = {
  orderId: string;
  invoiceNumber?: string | null;
  status: string;
  captain: CaptainInfo | null;
  delivery: { lat: number; lng: number; address: string };
  restaurants: { id: string; name: string; lat: number; lng: number }[];
};

const STATUS_AR: Record<string, string> = {
  PENDING_PAYMENT: "بانتظار الدفع",
  PAID: "تم الدفع",
  PREPARING: "المطعم يحضّر الطلب",
  READY_FOR_PICKUP: "جاهز للاستلام من المطعم",
  CAPTAIN_ASSIGNED: "الكابتن في الطريق",
  PICKED_UP: "الكابتن استلم الطلب",
  DELIVERING: "جاري التوصيل إليك",
  DELIVERED: "تم التسليم",
};

export default function TrackScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const [data, setData] = useState<TrackData | null>(null);
  const [captainPos, setCaptainPos] = useState<{ lat: number; lng: number } | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const loadTrack = useCallback(async () => {
    if (!orderId) return;
    const d = await api<TrackData>(`/api/orders/${orderId}/track`);
    setData(d);
    if (d.captain?.lat != null && d.captain.lng != null) {
      setCaptainPos({ lat: d.captain.lat, lng: d.captain.lng });
      if (d.captain.updatedAt) setLastUpdate(d.captain.updatedAt);
    }
  }, [orderId]);

  useEffect(() => {
    loadTrack().catch(() => {});
  }, [loadTrack]);

  useEffect(() => {
    if (!orderId) return;

    let mounted = true;
    (async () => {
      const token = await getToken();
      if (!token || !mounted) return;

      const socket = io(API_URL, { auth: { token } });
      socketRef.current = socket;
      socket.emit("order:subscribe", orderId);

      socket.on(
        "captain:location",
        (payload: { lat: number; lng: number; orderId: string; updatedAt?: string }) => {
          if (payload.orderId === orderId) {
            setCaptainPos({ lat: payload.lat, lng: payload.lng });
            setLastUpdate(payload.updatedAt ?? new Date().toISOString());
          }
        }
      );

      socket.on("order:status", (payload: {
        orderId: string;
        status: string;
        captain?: CaptainInfo | null;
      }) => {
        if (payload.orderId === orderId) {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  status: payload.status,
                  captain: payload.captain ?? prev.captain,
                }
              : prev
          );
          if (payload.captain) loadTrack().catch(() => {});
        }
      });
    })();

    const poll = setInterval(() => loadTrack().catch(() => {}), 20000);

    return () => {
      mounted = false;
      clearInterval(poll);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [orderId, loadTrack]);

  const mapKey = useMemo(() => {
    if (!captainPos) return "no-captain";
    return `${captainPos.lat.toFixed(4)},${captainPos.lng.toFixed(4)}`;
  }, [captainPos]);

  const goBack = useCallback(() => {
    router.replace("/");
  }, [router]);

  const backButton = (
    <Pressable style={styles.backBtn} onPress={goBack} accessibilityRole="button">
      <Text style={styles.backText}>← رجوع</Text>
    </Pressable>
  );

  if (!data) {
    return (
      <View style={styles.centerWrap}>
        {backButton}
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#E85D04" />
          <Text style={styles.loadingText}>جاري تحميل التتبع...</Text>
        </View>
      </View>
    );
  }

  const hasCaptain = !!data.captain;
  const trackingLive = !!captainPos;

  function callCaptain(phone: string) {
    Linking.openURL(`tel:${phone}`).catch(() => {});
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {backButton}

      <Text style={styles.title}>تتبع الطلب</Text>
      {formatOrderInvoice(data.invoiceNumber) ? (
        <Text style={styles.invoiceRef}>{formatOrderInvoice(data.invoiceNumber)}</Text>
      ) : null}
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>الحالة</Text>
        <Text style={styles.statusValue}>{STATUS_AR[data.status] ?? data.status}</Text>
      </View>

      <Pressable
        style={styles.detailsBtn}
        onPress={() => setInvoiceOpen(true)}
        accessibilityRole="button"
      >
        <Text style={styles.detailsBtnText}>📋 تفاصيل الطلب</Text>
      </Pressable>

      <Text style={styles.address}>📍 {data.delivery.address}</Text>

      {data.captain && (
        <View style={styles.captainCard}>
          <Text style={styles.captainTitle}>🛵 الكابتن — توصيل طلبك</Text>
          <Text style={styles.captainName}>{data.captain.name}</Text>
          {data.captain.phone && (
            <Pressable onPress={() => callCaptain(data.captain!.phone!)}>
              <Text style={styles.captainPhone}>📱 {data.captain.phone} — اتصل</Text>
            </Pressable>
          )}
          {data.captain.vehicle && (
            <Text style={styles.captainVehicle}>المركبة: {data.captain.vehicle}</Text>
          )}
        </View>
      )}

      <Text style={styles.mapTitle}>الخريطة الحية</Text>
      <View style={styles.legend}>
        <Text style={styles.legendItem}>🟠 موقعك (التوصيل)</Text>
        <Text style={styles.legendItem}>🟢 المطعم</Text>
        {hasCaptain && (
          <View style={styles.legendRow}>
            <CaptainCarTopIcon size={18} />
            <Text style={styles.legendItem}>الكابتن</Text>
          </View>
        )}
      </View>

      <DeliveryMap
        key={mapKey}
        customer={{ lat: data.delivery.lat, lng: data.delivery.lng, label: "موقع التوصيل" }}
        restaurants={data.restaurants.map((r) => ({
          lat: r.lat,
          lng: r.lng,
          label: r.name,
        }))}
        captain={
          captainPos
            ? { lat: captainPos.lat, lng: captainPos.lng, label: data.captain?.name ?? "الكابتن" }
            : data.captain?.lat != null && data.captain.lng != null
              ? { lat: data.captain.lat, lng: data.captain.lng, label: data.captain.name }
              : null
        }
        height={280}
      />

      <View style={styles.infoBox}>
        {trackingLive ? (
          <>
            <Text style={styles.liveBadge}>● تحديث مباشر</Text>
            <Text style={styles.hint}>يتم تحديث موقع الكابتن على الخريطة تلقائياً</Text>
            {lastUpdate && (
              <Text style={styles.updateTime}>
                آخر تحديث: {new Date(lastUpdate).toLocaleTimeString("ar-SA")}
              </Text>
            )}
          </>
        ) : hasCaptain ? (
          <Text style={styles.hint}>الكابتن معيّن — سيظهر موقعه عند بدء التوصيل</Text>
        ) : (
          <Text style={styles.hint}>في انتظار قبول كابتن للطلب</Text>
        )}
      </View>

      <OrderInvoiceSheet
        visible={invoiceOpen}
        orderId={orderId}
        onClose={() => setInvoiceOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingTop: 48, paddingBottom: 32 },
  centerWrap: { flex: 1, padding: 16, paddingTop: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#666" },
  backBtn: {
    alignSelf: "stretch",
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 12,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as object) : {}),
  },
  backText: { textAlign: "right", color: "#E85D04", fontWeight: "600", fontSize: 16 },
  title: { fontSize: 22, fontWeight: "700", textAlign: "right", marginBottom: 12 },
  invoiceRef: {
    fontWeight: "700",
    fontSize: 16,
    color: "#E85D04",
    textAlign: "right",
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: "#FFF3EB",
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  statusLabel: { textAlign: "right", color: "#888", fontSize: 13 },
  statusValue: { textAlign: "right", fontWeight: "700", fontSize: 18, color: "#E85D04", marginTop: 4 },
  detailsBtn: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E85D04",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 12,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as object) : {}),
  },
  detailsBtnText: { color: "#E85D04", fontWeight: "700", fontSize: 15 },
  address: { textAlign: "right", color: "#444", marginBottom: 12, lineHeight: 22 },
  captainCard: {
    backgroundColor: "#E8F4F8",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderRightWidth: 4,
    borderRightColor: "#0077B6",
  },
  captainTitle: { fontWeight: "700", textAlign: "right", color: "#0077B6", marginBottom: 8 },
  captainName: { fontSize: 18, fontWeight: "700", textAlign: "right", marginBottom: 6 },
  captainPhone: { textAlign: "right", color: "#0077B6", fontWeight: "600", marginBottom: 4 },
  captainVehicle: { textAlign: "right", color: "#555", marginBottom: 4 },
  mapTitle: { fontWeight: "700", textAlign: "right", fontSize: 16, marginBottom: 8 },
  legend: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 12, marginBottom: 4 },
  legendRow: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  legendItem: { fontSize: 12, color: "#666" },
  infoBox: {
    backgroundColor: "#FFF",
    padding: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  liveBadge: { color: "#2D6A4F", fontWeight: "700", textAlign: "center", marginBottom: 6 },
  hint: { textAlign: "center", color: "#666", lineHeight: 20 },
  updateTime: { textAlign: "center", color: "#999", fontSize: 12, marginTop: 8 },
});
