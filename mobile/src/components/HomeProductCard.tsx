import { View, Text, Pressable, StyleSheet, Image } from "react-native";
import { resolveImageUrl } from "../lib/upload";
import { formatMoney } from "../lib/formatMoney";
import { colors } from "../theme/colors";

export type HomeProduct = {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  hasPromotion?: boolean;
  isComboMeal?: boolean;
  comboItems?: { productName: string; quantity: number }[];
  offerDeliveryFee?: number | null;
  imageUrl?: string | null;
  restaurant: { id: string; name: string; logoUrl?: string | null };
};

type Props = {
  product: HomeProduct;
  width: number;
  imageHeight: number;
  showAdd?: boolean;
  onAdd: () => void;
  onPressRestaurant?: () => void;
  etaLabel?: string;
  feeLabel?: string;
  rich?: boolean;
};

export function HomeProductCard({
  product,
  width,
  imageHeight,
  showAdd = true,
  onAdd,
  onPressRestaurant,
  etaLabel,
  feeLabel,
  rich = false,
}: Props) {
  const img = resolveImageUrl(product.imageUrl);
  const hasDiscount =
    product.hasPromotion ||
    (product.originalPrice != null && product.originalPrice > product.price);

  return (
    <View style={[styles.card, rich && styles.cardRich, { width }]}>
      <View style={[styles.imageWrap, { height: imageHeight }]}>
        {img ? (
          <Image source={{ uri: img }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderEmoji}>🍽️</Text>
          </View>
        )}
        {showAdd && (
          <Pressable
            style={styles.addFab}
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel="أضف للعربة"
          >
            <Text style={styles.addFabText}>+</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {product.name}
      </Text>
      {product.isComboMeal && product.comboItems && product.comboItems.length > 0 ? (
        <Text style={styles.comboHint} numberOfLines={2}>
          {product.comboItems.map((i) => `${i.productName}×${i.quantity}`).join(" · ")}
        </Text>
      ) : null}
      {onPressRestaurant ? (
        <Pressable onPress={onPressRestaurant}>
          <Text style={styles.restaurantLink} numberOfLines={1}>
            {product.restaurant.name} ←
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.restaurantName} numberOfLines={1}>
          {product.restaurant.name}
        </Text>
      )}
      {rich && (etaLabel || feeLabel) ? (
        <View style={styles.metaRow}>
          {etaLabel ? <Text style={styles.metaEta}>🛵 {etaLabel}</Text> : null}
          {feeLabel ? (
            <Text style={[styles.metaFee, feeLabel.includes("مجاني") && styles.metaFeeFree]}>
              {feeLabel}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatMoney(product.price)} ر.س</Text>
        {hasDiscount && product.originalPrice != null ? (
          <Text style={styles.oldPrice}>{formatMoney(product.originalPrice)} ر.س</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRich: { paddingBottom: 12 },
  imageWrap: { borderRadius: 10, overflow: "hidden", marginBottom: 8, position: "relative" },
  image: { width: "100%", height: "100%" },
  placeholder: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderEmoji: { fontSize: 32 },
  addFab: {
    position: "absolute",
    bottom: 8,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  addFabText: { color: "#FFF", fontWeight: "800", fontSize: 20, lineHeight: 22 },
  name: {
    fontWeight: "700",
    textAlign: "right",
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
    minHeight: 38,
  },
  comboHint: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "right",
    marginTop: 2,
    lineHeight: 16,
  },
  restaurantName: { fontSize: 11, color: colors.textMuted, textAlign: "right", marginTop: 2 },
  restaurantLink: {
    fontSize: 11,
    color: colors.accentOrange,
    textAlign: "right",
    marginTop: 2,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 4,
  },
  metaEta: { color: colors.textMuted, fontSize: 11 },
  metaFee: { color: "#5EB3E8", fontSize: 11, fontWeight: "700" },
  metaFeeFree: { color: colors.success },
  priceRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  price: { color: colors.accent, fontWeight: "800", fontSize: 15 },
  oldPrice: {
    color: colors.textDim,
    fontSize: 12,
    textDecorationLine: "line-through",
  },
});
