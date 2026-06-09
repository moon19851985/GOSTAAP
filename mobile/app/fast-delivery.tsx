import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { resolveImageUrl } from "../src/lib/upload";
import { colors } from "../src/theme/colors";
import {
  FAST_DELIVERY_RADIUS_KM,
  filterRestaurantsWithinKm,
  type RestaurantCoords,
} from "../src/lib/nearbyRestaurants";
import { formatDistanceKm } from "../src/lib/deliveryFee";
import {
  getStoredCustomerLocation,
  requestCustomerLocation,
} from "../src/lib/customerLocation";
const HERO_BG = "#1B4332";

export default function FastDeliveryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [customerCity, setCustomerCity] = useState<string | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantCoords[]>([]);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const stored = await getStoredCustomerLocation();
      const { location } = stored
        ? { location: stored }
        : await requestCustomerLocation({ force: false, allowIpEstimate: false });

      if (!location) {
        setCustomerCoords(null);
        setCustomerCity(null);
        setRestaurants([]);
        return;
      }

      setCustomerCoords({ lat: location.lat, lng: location.lng });
      setCustomerCity(location.city);

      const q = `?city=${encodeURIComponent(location.city)}`;
      const data = await api<{ restaurants: RestaurantCoords[] }>(
        `/api/catalog/restaurants${q}`,
        { auth: false }
      );
      setRestaurants(data.restaurants ?? []);
    } catch {
      setRestaurants([]);
    } finally {
      if (!opts?.silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nearby = useMemo(() => {
    if (!customerCoords) return [];
    return filterRestaurantsWithinKm(
      restaurants,
      customerCoords.lat,
      customerCoords.lng,
      FAST_DELIVERY_RADIUS_KM
    );
  }, [restaurants, customerCoords]);

  return (
    <View style={styles.root}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load({ silent: true });
            }}
            tintColor={colors.accentOrange}
          />
        }
      >
        <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-forward" size={24} color="#FFF" />
          </Pressable>
          <View style={styles.heroContent}>
            <Text style={styles.heroEmoji}>🚀</Text>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroTitle}>توصيل أسرع</Text>
              <Text style={styles.heroSub}>
                مطاعم ضمن {FAST_DELIVERY_RADIUS_KM} كم من موقعك
                {customerCity ? ` · ${customerCity}` : ""}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.accentOrange} style={styles.loader} />
          ) : !customerCoords ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyTitle}>حدّد موقع التوصيل أولاً</Text>
              <Text style={styles.empty}>
                من الصفحة الرئيسية اضغط على موقعك في الأعلى واختر مدينتك، ثم ارجع لعرض المطاعم
                القريبة.
              </Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.replace("/")}>
                <Text style={styles.emptyBtnText}>العودة للرئيسية</Text>
              </Pressable>
            </View>
          ) : nearby.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyTitle}>لا مطاعم في النطاق القريب</Text>
              <Text style={styles.empty}>
                لا يوجد مطعم نشط ضمن {FAST_DELIVERY_RADIUS_KM} كم من موقعك حالياً. جرّب توسيع
                البحث من قسم «مطاعم قريبة منك» في الرئيسية أو غيّر موقع التوصيل.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.countHint}>
                {nearby.length} مطعم · الأقرب أولاً
              </Text>
              {nearby.map((r) => {
                const logo = resolveImageUrl(r.logoUrl);
                const distLabel =
                  customerCoords != null
                    ? formatDistanceKm(r.lat, r.lng, customerCoords.lat, customerCoords.lng)
                    : "";
                return (
                  <Pressable
                    key={r.id}
                    style={styles.card}
                    onPress={() => router.push(`/menu/${r.id}`)}
                  >
                    <View style={styles.logoWrap}>
                      {logo ? (
                        <Image source={{ uri: logo }} style={styles.logo} resizeMode="cover" />
                      ) : (
                        <Text style={styles.logoEmoji}>🍽️</Text>
                      )}
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardName} numberOfLines={2}>
                        {r.name}
                      </Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaDist}>📍 {distLabel}</Text>
                        <Text style={styles.metaEta}>🕐 {r.eta}</Text>
                      </View>
                      {r.productCount != null && r.productCount > 0 ? (
                        <Text style={styles.metaProducts}>{r.productCount} منتج</Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-back" size={22} color={colors.textDim} />
                  </Pressable>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: {
    backgroundColor: HERO_BG,
    paddingHorizontal: 20,
    paddingBottom: 28,
    minHeight: 130,
  },
  backBtn: { alignSelf: "flex-end", padding: 4, marginBottom: 8 },
  heroContent: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
  },
  heroEmoji: { fontSize: 44 },
  heroTextBlock: { flex: 1 },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFF",
    textAlign: "right",
  },
  heroSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    textAlign: "right",
    marginTop: 6,
    lineHeight: 22,
  },
  body: { padding: 16, paddingBottom: 32 },
  loader: { marginTop: 40 },
  countHint: {
    textAlign: "right",
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 12,
    fontWeight: "600",
  },
  card: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: "100%", height: "100%" },
  logoEmoji: { fontSize: 28 },
  cardBody: { flex: 1 },
  cardName: {
    fontWeight: "800",
    fontSize: 16,
    color: colors.text,
    textAlign: "right",
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    gap: 8,
  },
  metaDist: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  metaEta: { color: colors.textMuted, fontSize: 13 },
  metaProducts: {
    textAlign: "right",
    color: colors.textDim,
    fontSize: 12,
    marginTop: 4,
  },
  emptyBlock: { paddingTop: 24, paddingHorizontal: 8 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    textAlign: "right",
    marginBottom: 10,
  },
  empty: {
    textAlign: "right",
    color: colors.textMuted,
    lineHeight: 24,
    fontSize: 15,
  },
  emptyBtn: {
    marginTop: 20,
    backgroundColor: colors.accentOrange,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  emptyBtnText: { color: "#FFF", fontWeight: "700" },
});
