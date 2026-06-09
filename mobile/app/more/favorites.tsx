import { useCallback, useState } from "react";
import {
  ScrollView,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  View,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { DarkScreen } from "../../src/components/DarkScreen";
import { api } from "../../src/lib/api";
import { isLoggedIn } from "../../src/lib/session";
import { showAlert } from "../../src/lib/alert";
import { colors } from "../../src/theme/colors";

type Restaurant = { id: string; name: string; address: string; description?: string | null };

export default function FavoritesScreen() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    if (!(await isLoggedIn())) {
      router.replace("/auth");
      return;
    }
    try {
      const me = await api<{ user: { role: string } }>("/api/auth/me");
      if (me.user.role !== "CUSTOMER") {
        showAlert("تنبيه", "المفضّل متاح للعملاء فقط");
        router.back();
        return;
      }
      const [all, fav] = await Promise.all([
        api<{ restaurants: Restaurant[] }>("/api/catalog/restaurants", { auth: false }),
        api<{ ids: string[] }>("/api/favorites/restaurants/ids"),
      ]);
      setRestaurants(all.restaurants);
      setFavoriteIds(new Set(fav.ids));
    } catch {
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function toggleFavorite(id: string) {
    const isFav = favoriteIds.has(id);
    try {
      if (isFav) {
        await api(`/api/favorites/restaurants/${id}`, { method: "DELETE" });
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        await api(`/api/favorites/restaurants/${id}`, { method: "POST" });
        setFavoriteIds((prev) => new Set(prev).add(id));
      }
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "تعذّر التحديث");
    }
  }

  const favorites = restaurants.filter((r) => favoriteIds.has(r.id));

  return (
    <DarkScreen title="المفضّل" showBack>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>اختر مطاعمك المفضّلة بالضغط على القلب</Text>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
        ) : (
          <>
            {favorites.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>مطاعمك المفضّلة</Text>
                {favorites.map((r) => (
                  <View key={r.id} style={[styles.card, styles.cardFav]}>
                    <Pressable onPress={() => toggleFavorite(r.id)} hitSlop={8}>
                      <Ionicons name="heart" size={22} color={colors.danger} />
                    </Pressable>
                    <View style={styles.cardBody}>
                      <Text style={styles.name}>{r.name}</Text>
                      <Text style={styles.addr}>{r.address}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            <Text style={styles.sectionTitle}>كل المطاعم</Text>
            {restaurants.map((r) => {
              const fav = favoriteIds.has(r.id);
              return (
                <View key={r.id} style={styles.card}>
                  <Pressable onPress={() => toggleFavorite(r.id)} hitSlop={8}>
                    <Ionicons
                      name={fav ? "heart" : "heart-outline"}
                      size={22}
                      color={fav ? colors.danger : colors.textDim}
                    />
                  </Pressable>
                  <View style={styles.cardBody}>
                    <Text style={styles.name}>{r.name}</Text>
                    <Text style={styles.addr}>{r.address}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </DarkScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  hint: { textAlign: "right", color: colors.textMuted, marginBottom: 16, lineHeight: 22 },
  sectionTitle: {
    textAlign: "right",
    color: colors.text,
    fontWeight: "800",
    fontSize: 15,
    marginBottom: 10,
    marginTop: 8,
  },
  card: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardFav: { borderColor: "#5A3030" },
  cardBody: { flex: 1 },
  name: { textAlign: "right", color: colors.text, fontWeight: "700", fontSize: 15 },
  addr: { textAlign: "right", color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
