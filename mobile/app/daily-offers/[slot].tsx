import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { OfferSlotPromotionRow } from "../../src/components/OfferSlotPromotionRow";
import { PromotionCompactRow } from "../../src/components/PromotionCompactRow";
import { api } from "../../src/lib/api";
import { useCart } from "../../src/store/cart";
import { isLoggedIn } from "../../src/lib/session";
import { colors } from "../../src/theme/colors";
import type { Promotion } from "../../src/types/promotion";
import {
  OFFER_SLOT_LABELS,
  OFFER_SLOT_META,
  parseOfferSlotParam,
} from "../../src/types/offerSlot";
import { requestCustomerLocation } from "../../src/lib/customerLocation";

export default function DailyOffersBySlotScreen() {
  const { slot: slotParam } = useLocalSearchParams<{ slot: string }>();
  const slot = parseOfferSlotParam(slotParam);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const add = useCart((s) => s.add);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isRestaurant, setIsRestaurant] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );

  const meta = slot ? OFFER_SLOT_META[slot] : null;
  const title = slot ? OFFER_SLOT_LABELS[slot] : "العروض اليومية";

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!slot) {
        setPromotions([]);
        return;
      }
      if (!opts?.silent) setLoading(true);
      try {
        const loggedIn = await isLoggedIn();
        if (loggedIn) {
          try {
            const me = await api<{ user: { role: string } }>("/api/auth/me");
            setIsRestaurant(me.user.role === "RESTAURANT");
            if (me.user.role === "RESTAURANT") {
              const data = await api<{ promotions: Promotion[] }>("/api/restaurant/promotions");
              setPromotions(data.promotions.filter((p) => p.offerSlot === slot));
              return;
            }
          } catch {
            setIsRestaurant(false);
          }
        }

        const locResult = await requestCustomerLocation({
          force: false,
          allowIpEstimate: false,
        });
        const city = locResult.location?.city;
        if (locResult.location) {
          setCustomerCoords({ lat: locResult.location.lat, lng: locResult.location.lng });
        } else {
          setCustomerCoords(null);
        }
        if (!city) {
          setPromotions([]);
          return;
        }
        const q = `?city=${encodeURIComponent(city)}&slot=${encodeURIComponent(slot)}`;
        const data = await api<{ promotions: Promotion[] }>(`/api/promotions${q}`, {
          auth: false,
        });
        setPromotions(data.promotions);
      } catch {
        setPromotions([]);
      } finally {
        if (!opts?.silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [slot]
  );

  useEffect(() => {
    if (!slot) {
      router.replace("/(tabs)/offers");
      return;
    }
    void load();
  }, [load, slot, router]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredPromotions = useMemo(() => {
    if (!normalizedSearch) return promotions;
    return promotions.filter((p) => {
      const hay = `${p.restaurant.name} ${p.product.name} ${p.product.category} ${p.reason}`.toLowerCase();
      return hay.includes(normalizedSearch);
    });
  }, [promotions, normalizedSearch]);

  if (!slot || !meta) return null;

  const hourlyHint =
    slot === "HOURLY"
      ? "يعرض العروض النشطة في الوقت الحالي فقط (توقيت الرياض)"
      : undefined;

  return (
    <View style={styles.root}>
      <ScrollView
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
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
        <View style={[styles.hero, { backgroundColor: meta.headerBg, paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-forward" size={24} color="#1a1a1a" />
          </Pressable>
          <View style={styles.heroContent}>
            <Text style={styles.heroEmoji}>{meta.emoji}</Text>
            <Text style={styles.heroTitle}>{title}</Text>
          </View>
        </View>

        <View style={styles.searchSticky}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={20} color={colors.textDim} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={meta.searchPlaceholder}
              placeholderTextColor={colors.textDim}
              value={searchQuery}
              onChangeText={setSearchQuery}
              textAlign="right"
              returnKeyType="search"
            />
          </View>
        </View>

        {hourlyHint ? <Text style={styles.hint}>{hourlyHint}</Text> : null}

        {loading ? (
          <ActivityIndicator style={styles.loader} size="large" color={colors.accentOrange} />
        ) : filteredPromotions.length === 0 ? (
          <Text style={styles.empty}>
            {normalizedSearch
              ? `لا توجد نتائج لـ «${searchQuery.trim()}»`
              : slot === "HOURLY"
                ? "لا توجد عروض ساعة نشطة الآن — جرّب لاحقاً."
                : slot === "OTHER"
                  ? "لا توجد عروض أخرى في مدينتك حالياً."
                  : `لا توجد عروض «${title}» في مدينتك حالياً.`}
          </Text>
        ) : isRestaurant ? (
          <View style={styles.list}>
            {filteredPromotions.map((p) => (
              <PromotionCompactRow key={p.id} promotion={p} />
            ))}
          </View>
        ) : (
          <View style={styles.list}>
            {filteredPromotions.map((p) => (
              <OfferSlotPromotionRow
                key={p.id}
                promotion={p}
                customerCoords={customerCoords}
                showAdd
                onAdd={() =>
                  add({
                    productId: p.productId,
                    name: p.product.name,
                    price: p.discountedPrice,
                    restaurantId: p.restaurant.id,
                    restaurantName: p.restaurant.name,
                    imageUrl: p.product.imageUrl,
                  })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    minHeight: 140,
  },
  backBtn: {
    alignSelf: "flex-end",
    padding: 4,
    marginBottom: 8,
  },
  heroContent: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  heroEmoji: { fontSize: 72, lineHeight: 80 },
  heroTitle: {
    fontSize: 36,
    fontWeight: "900",
    color: "#1a1a1a",
    textAlign: "right",
    flex: 1,
    marginStart: 16,
  },
  searchSticky: {
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    marginTop: -22,
    paddingBottom: 12,
    zIndex: 2,
  },
  searchWrap: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: colors.accent,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  searchIcon: { marginStart: 8 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1a1a1a",
    paddingVertical: 0,
  },
  hint: {
    textAlign: "right",
    color: colors.textMuted,
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 13,
    lineHeight: 20,
  },
  loader: { marginVertical: 48 },
  empty: {
    textAlign: "right",
    color: colors.textMuted,
    marginHorizontal: 16,
    marginTop: 32,
    lineHeight: 24,
    fontSize: 15,
  },
  list: { paddingTop: 4 },
});
