import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DarkScreen } from "../src/components/DarkScreen";
import { HomeSectionHeader } from "../src/components/HomeSectionHeader";
import { HomeProductCard, type HomeProduct } from "../src/components/HomeProductCard";
import { api } from "../src/lib/api";
import { useCart } from "../src/store/cart";
import { isLoggedIn } from "../src/lib/session";
import { colors } from "../src/theme/colors";
import { useMobileLayout } from "../src/lib/layout";
import { requestCustomerLocation } from "../src/lib/customerLocation";
import { restaurantDeliveryMeta } from "../src/lib/deliveryFee";
import { formatOfferDeliveryLabel } from "../src/lib/deliveryOffer";
import { productMatchesCoffeeSweets } from "../src/lib/coffeeSweetsFilter";

type Product = HomeProduct & {
  category?: string;
  restaurant: HomeProduct["restaurant"] & { lat?: number; lng?: number };
};

type CategoryGroup = { category: string; products: Product[] };

export default function CoffeeSweetsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const add = useCart((s) => s.add);
  const { productCardWidth, productImageHeight } = useMobileLayout();
  const [categories, setCategories] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isRestaurant, setIsRestaurant] = useState(false);
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [city, setCity] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const locResult = await requestCustomerLocation({
        force: false,
        allowIpEstimate: false,
      });
      const loc = locResult.location;
      if (!loc?.city) {
        setCategories([]);
        setCity(null);
        return;
      }
      setCity(loc.city);
      setCustomerCoords({ lat: loc.lat, lng: loc.lng });

      const q = `?city=${encodeURIComponent(loc.city)}`;
      const data = await api<{ categories: CategoryGroup[] }>(
        `/api/catalog/aggregated${q}`,
        { auth: false }
      );
      setCategories(data.categories);
    } catch {
      setCategories([]);
    } finally {
      if (!opts?.silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    (async () => {
      const loggedIn = await isLoggedIn();
      if (!loggedIn) {
        setIsRestaurant(false);
        return;
      }
      try {
        const res = await api<{ user: { role: string } }>("/api/auth/me");
        setIsRestaurant(res.user.role === "RESTAURANT");
      } catch {
        setIsRestaurant(false);
      }
    })();
  }, [load]);

  const filteredGroups = useMemo(() => {
    return categories
      .map((g) => ({
        ...g,
        products: g.products.filter(productMatchesCoffeeSweets),
      }))
      .filter((g) => g.products.length > 0);
  }, [categories]);

  const productDeliveryMeta = useCallback(
    (p: Product) => {
      const eta = restaurantDeliveryMeta(
        p.restaurant.lat ?? 0,
        p.restaurant.lng ?? 0,
        customerCoords?.lat ?? null,
        customerCoords?.lng ?? null
      ).eta;
      const feeLabel = formatOfferDeliveryLabel(p.offerDeliveryFee) ?? undefined;
      return { eta, feeLabel };
    },
    [customerCoords]
  );

  function addProduct(p: Product) {
    add({
      productId: p.id,
      name: p.name,
      price: p.price,
      restaurantId: p.restaurant.id,
      restaurantName: p.restaurant.name,
      imageUrl: p.imageUrl,
    });
  }

  const totalCount = filteredGroups.reduce((n, g) => n + g.products.length, 0);

  return (
    <DarkScreen title="قهوة وحلى ☕🍰" showBack>
      <ScrollView
        style={styles.scroll}
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
        {city ? <Text style={styles.cityHint}>📍 {city}</Text> : null}

        {loading ? (
          <ActivityIndicator style={styles.loader} size="large" color={colors.accentOrange} />
        ) : !city ? (
          <Text style={styles.empty}>
            حدّد موقع التوصيل من الصفحة الرئيسية لعرض منتجات القهوة والحلى في مدينتك.
          </Text>
        ) : totalCount === 0 ? (
          <Text style={styles.empty}>
            لا توجد منتجات قهوة أو حلى في مدينتك حالياً.{"\n\n"}عند إضافة منتجات استخدم تصنيفاً
            مثل: قهوة، حلويات، حلى.
          </Text>
        ) : (
          filteredGroups.map((group) => (
            <View key={group.category} style={styles.section}>
              <HomeSectionHeader title={group.category} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}
                nestedScrollEnabled
              >
                {group.products.map((p) => {
                  const meta = productDeliveryMeta(p);
                  return (
                    <HomeProductCard
                      key={p.id}
                      product={p}
                      width={productCardWidth}
                      imageHeight={productImageHeight}
                      rich
                      showAdd={!isRestaurant}
                      etaLabel={meta.eta}
                      feeLabel={meta.feeLabel}
                      onAdd={() => addProduct(p)}
                      onPressRestaurant={() => router.push(`/menu/${p.restaurant.id}`)}
                    />
                  );
                })}
              </ScrollView>
            </View>
          ))
        )}
      </ScrollView>
    </DarkScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  cityHint: {
    textAlign: "right",
    color: colors.textMuted,
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 13,
  },
  loader: { marginVertical: 48 },
  empty: {
    textAlign: "right",
    color: colors.textMuted,
    marginHorizontal: 16,
    marginTop: 24,
    lineHeight: 24,
    fontSize: 15,
  },
  section: { marginBottom: 12 },
  row: { paddingHorizontal: 16, gap: 10, flexDirection: "row-reverse", marginBottom: 8 },
});
