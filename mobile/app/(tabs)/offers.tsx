import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { DarkScreen } from "../../src/components/DarkScreen";
import { FeaturedPromotionsCarousel } from "../../src/components/FeaturedPromotionsCarousel";
import { PromotionCompactRow } from "../../src/components/PromotionCompactRow";
import { api } from "../../src/lib/api";
import { useCart } from "../../src/store/cart";
import { isLoggedIn } from "../../src/lib/session";
import { colors } from "../../src/theme/colors";
import type { Promotion } from "../../src/types/promotion";
import { getStoredCustomerLocation, requestCustomerLocation } from "../../src/lib/customerLocation";


export default function OffersTab() {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isRestaurant, setIsRestaurant] = useState(false);
  const [isCaptain, setIsCaptain] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);

  const load = useCallback(async () => {
    const loggedIn = await isLoggedIn();
    let restaurant = false;
    let captain = false;

    if (loggedIn) {
      try {
        const res = await api<{ user: { role: string } }>("/api/auth/me");
        restaurant = res.user.role === "RESTAURANT";
        captain = res.user.role === "CAPTAIN";
        setIsRestaurant(restaurant);
        setIsCaptain(captain);
      } catch {
        setIsRestaurant(false);
        setIsCaptain(false);
      }
    } else {
      setIsRestaurant(false);
      setIsCaptain(false);
    }

    if (captain) {
      setPromotions([]);
      setRoleChecked(true);
      return;
    }

    try {
      if (restaurant) {
        const data = await api<{ promotions: Promotion[] }>("/api/restaurant/promotions");
        setPromotions(data.promotions);
      } else {
        const stored = await getStoredCustomerLocation();
        const { location } = stored
          ? { location: stored }
          : await requestCustomerLocation({ force: false, allowIpEstimate: false });
        if (!location?.city) {
          setPromotions([]);
          return;
        }
        const q = `?city=${encodeURIComponent(location.city)}`;
        const data = await api<{ promotions: Promotion[] }>(`/api/promotions${q}`, { auth: false });
        setPromotions(data.promotions);
      }
    } catch {
      setPromotions([]);
    } finally {
      setRoleChecked(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setRoleChecked(false);
      load();
    }, [load])
  );

  return (
    <DarkScreen title="العروض">
      {!roleChecked ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : isRestaurant ? (
        <ScrollView contentContainerStyle={styles.content}>
          {promotions.length === 0 ? (
            <Text style={styles.empty}>لا توجد عروض — أضف عرضاً من الرئيسية</Text>
          ) : (
            promotions.map((p) => <PromotionCompactRow key={p.id} promotion={p} />)
          )}
          <Pressable style={styles.addBtn} onPress={() => router.push("/add-promotion")}>
            <Text style={styles.addBtnText}>إضافة عرض</Text>
          </Pressable>
        </ScrollView>
      ) : isCaptain ? (
        <View style={styles.center}>
          <Pressable style={styles.captainBtn} onPress={() => router.push("/captain")}>
            <Text style={styles.captainBtnText}>🛵 لوحة الكابتن</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {promotions.length === 0 ? (
            <Text style={styles.empty}>لا توجد عروض حالياً</Text>
          ) : (
            <FeaturedPromotionsCarousel
              promotions={promotions}
              showAddButton
              hideTitle
              onAddToCart={(p) =>
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
          )}
        </ScrollView>
      )}
    </DarkScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 48 },
  empty: { textAlign: "center", color: colors.textDim, marginTop: 48, fontSize: 15, paddingHorizontal: 16 },
  addBtn: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.accentOrange,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  addBtnText: { color: colors.accentOrange, fontWeight: "700", fontSize: 16 },
  captainBtn: {
    backgroundColor: "#0077B6",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  captainBtnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
});
