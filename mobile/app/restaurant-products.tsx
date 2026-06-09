import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "../src/lib/api";
import { showAlert } from "../src/lib/alert";
import { resolveImageUrl } from "../src/lib/upload";
import { colors } from "../src/theme/colors";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string | null;
};

export default function RestaurantProductsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ restaurant: { products: Product[] } }>("/api/restaurant/me");
      setProducts(res.restaurant?.products ?? []);
    } catch {
      router.replace("/auth");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function confirmDelete(product: Product) {
    Alert.alert("حذف المنتج", `حذف «${product.name}»؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: () => deleteProduct(product.id),
      },
    ]);
  }

  async function deleteProduct(id: string) {
    setDeletingId(id);
    try {
      await api(`/api/restaurant/products/${id}`, { method: "DELETE" });
      await load();
      showAlert("تم", "تم حذف المنتج");
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "تعذّر حذف المنتج");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.replace("/")}>
          <Text style={styles.backBtnText}>الرئيسية</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>المنتجات</Text>

      {loading ? (
        <ActivityIndicator color={colors.accentOrange} style={{ marginVertical: 24 }} />
      ) : products.length === 0 ? (
        <Text style={styles.empty}>لا توجد منتجات — أضف منتجاً من الرئيسية</Text>
      ) : (
        products.map((item) => (
          <View key={item.id} style={styles.productRow}>
            <View style={styles.actions}>
              <Pressable
                style={styles.editBtn}
                onPress={() => router.push({ pathname: "/add-product", params: { id: item.id } })}
              >
                <Text style={styles.editBtnText}>تعديل</Text>
              </Pressable>
              <Pressable
                style={styles.deleteBtn}
                onPress={() => confirmDelete(item)}
                disabled={deletingId === item.id}
              >
                {deletingId === item.id ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.deleteBtnText}>حذف</Text>
                )}
              </Pressable>
            </View>
            {item.imageUrl ? (
              <Image
                source={{ uri: resolveImageUrl(item.imageUrl) ?? undefined }}
                style={styles.productThumb}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.productThumb, styles.thumbPlaceholder]}>
                <Text>🍽️</Text>
              </View>
            )}
            <Text style={styles.productText}>
              {item.name} — {item.category} — {item.price} ر.س
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingTop: 48, paddingBottom: 40 },
  topBar: {
    flexDirection: "row-reverse",
    justifyContent: "flex-end",
    marginBottom: 12,
  },
  backBtn: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.accentOrange,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backBtnText: { color: colors.accentOrange, fontWeight: "700" },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    color: colors.text,
    marginBottom: 20,
  },
  empty: { textAlign: "center", color: colors.textDim, marginVertical: 24, fontSize: 15 },
  productRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actions: { flexDirection: "column", gap: 6, alignItems: "stretch" },
  editBtn: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.accentOrange,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 52,
    alignItems: "center",
  },
  editBtnText: { color: colors.accentOrange, fontWeight: "700", fontSize: 12 },
  deleteBtn: {
    backgroundColor: colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: { color: "#FFF", fontWeight: "700", fontSize: 12 },
  productThumb: { width: 52, height: 52, borderRadius: 8 },
  thumbPlaceholder: {
    backgroundColor: colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  productText: { flex: 1, textAlign: "right", color: colors.text },
});
