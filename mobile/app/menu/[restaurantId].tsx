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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../src/lib/api";
import { useCart } from "../../src/store/cart";
import { resolveImageUrl } from "../../src/lib/upload";
import { HomeProductCard, type HomeProduct } from "../../src/components/HomeProductCard";
import { HomeSectionHeader } from "../../src/components/HomeSectionHeader";
import { colors } from "../../src/theme/colors";
import { requestCustomerLocation } from "../../src/lib/customerLocation";
import { restaurantDeliveryMeta } from "../../src/lib/deliveryFee";
import { useMobileLayout } from "../../src/lib/layout";

type CatalogRestaurant = {
  id: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  address: string;
  lat: number;
  lng: number;
};

type CategoryGroup = { category: string; products: HomeProduct[] };

export default function RestaurantMenuScreen() {
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const add = useCart((s) => s.add);
  const { productCardWidth, productImageHeight } = useMobileLayout();
  const [restaurant, setRestaurant] = useState<CatalogRestaurant | null>(null);
  const [categories, setCategories] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);

  const deliveryMeta = useMemo(() => {
    if (!restaurant || !customerCoords) return null;
    return restaurantDeliveryMeta(
      restaurant.lat,
      restaurant.lng,
      customerCoords.lat,
      customerCoords.lng
    );
  }, [restaurant, customerCoords]);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const loc = await requestCustomerLocation({ force: false });
      if (loc.location) {
        setCustomerCoords({ lat: loc.location.lat, lng: loc.location.lng });
      }

      const [info, menu] = await Promise.all([
        api<{ restaurant: CatalogRestaurant }>(`/api/catalog/restaurants/${restaurantId}`, {
          auth: false,
        }),
        api<{ categories: CategoryGroup[] }>(
          `/api/catalog/restaurants/${restaurantId}/products`,
          { auth: false }
        ),
      ]);
      setRestaurant(info.restaurant);
      setCategories(menu.categories);
    } catch {
      setRestaurant(null);
      setCategories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  function addProduct(p: HomeProduct) {
    add({
      productId: p.id,
      name: p.name,
      price: p.price,
      restaurantId: p.restaurant.id,
      restaurantName: p.restaurant.name,
      imageUrl: p.imageUrl,
    });
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.empty}>المطعم غير موجود</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>← رجوع</Text>
        </Pressable>
      </View>
    );
  }

  const logo = resolveImageUrl(restaurant.logoUrl);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={colors.accentOrange}
        />
      }
    >
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logo} resizeMode="cover" />
          ) : (
            <Text style={styles.logoEmoji}>🍽️</Text>
          )}
        </View>
        <Text style={styles.name}>{restaurant.name}</Text>
        <Text style={styles.address}>📍 {restaurant.address}</Text>
        {deliveryMeta ? (
          <Text style={styles.meta}>🛵 {deliveryMeta.eta}</Text>
        ) : null}
      </View>

      {categories.length === 0 ? (
        <Text style={styles.empty}>لا توجد منتجات متاحة حالياً</Text>
      ) : (
        categories.map((group) => (
          <View key={group.category} style={styles.section}>
            <HomeSectionHeader title={group.category} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.row}
              nestedScrollEnabled
            >
              {group.products.map((p) => (
                <HomeProductCard
                  key={p.id}
                  product={p}
                  width={productCardWidth}
                  imageHeight={productImageHeight}
                  rich
                  etaLabel={deliveryMeta?.eta}
                  feeLabel={deliveryMeta?.feeLabel}
                  onAdd={() => addProduct(p)}
                />
              ))}
            </ScrollView>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  hero: {
    padding: 16,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: colors.bgCard,
    alignSelf: "flex-end",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  logo: { width: "100%", height: "100%" },
  logoEmoji: { fontSize: 32 },
  name: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    textAlign: "right",
    marginBottom: 6,
  },
  address: { color: colors.textMuted, textAlign: "right", marginBottom: 6 },
  meta: { color: "#5EB3E8", textAlign: "right", fontWeight: "600", fontSize: 13 },
  section: { marginBottom: 12 },
  row: { paddingHorizontal: 16, gap: 10, flexDirection: "row-reverse" },
  empty: { textAlign: "center", color: colors.textDim, marginVertical: 32 },
  backLink: { color: colors.accentOrange, fontWeight: "700", marginTop: 12 },
});
