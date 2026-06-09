import { View, Text, Pressable, StyleSheet, Image } from "react-native";
import { resolveImageUrl } from "../lib/upload";
import { formatMoney } from "../lib/formatMoney";
import type { StarterMeal } from "../types/starterMeal";

type Props = {
  meal: StarterMeal;
  width: number;
  imageHeight: number;
  etaLabel?: string;
  feeLabel?: string;
  showAdd?: boolean;
  onAdd: () => void;
  onPressRestaurant?: () => void;
};

export function StarterMealCard({
  meal,
  width,
  imageHeight,
  etaLabel,
  feeLabel,
  showAdd = true,
  onAdd,
  onPressRestaurant,
}: Props) {
  const img = resolveImageUrl(meal.product.imageUrl);
  const logo = resolveImageUrl(meal.restaurant.logoUrl);
  const showFree = feeLabel === "مجاني";

  return (
    <Pressable
      style={[styles.card, { width }]}
      onPress={onPressRestaurant}
      disabled={!onPressRestaurant}
    >
      <View style={[styles.imagePanel, { height: imageHeight }]}>
        {img ? (
          <Image source={{ uri: img }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderEmoji}>🍽️</Text>
          </View>
        )}
        {logo ? (
          <View style={styles.logoWrap}>
            <Image source={{ uri: logo }} style={styles.logo} resizeMode="cover" />
          </View>
        ) : null}
        {showAdd ? (
          <Pressable
            style={styles.addFab}
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel="أضف للعربة"
          >
            <Text style={styles.addFabText}>+</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.name} numberOfLines={2}>
        {meal.product.name}
      </Text>

      {etaLabel || feeLabel ? (
        <View style={styles.metaRow}>
          {etaLabel ? <Text style={styles.metaEta}>🕐 {etaLabel}</Text> : null}
          {feeLabel ? (
            <Text style={[styles.metaFee, showFree && styles.metaFeeFree]}>{feeLabel}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatMoney(meal.discountedPrice)} ريال</Text>
        {meal.savingsPercent > 0 ? (
          <Text style={styles.oldPrice}>{formatMoney(meal.originalPrice)} ريال</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "transparent",
  },
  imagePanel: {
    backgroundColor: "#F0F0F0",
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    marginBottom: 10,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderEmoji: { fontSize: 32 },
  logoWrap: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  logo: { width: "100%", height: "100%" },
  addFab: {
    position: "absolute",
    bottom: 8,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  addFabText: { color: "#FFF", fontWeight: "800", fontSize: 20, lineHeight: 22 },
  name: {
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.92)",
    textAlign: "right",
    minHeight: 40,
  },
  metaRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    marginBottom: 6,
    gap: 8,
  },
  metaEta: { color: "rgba(255,255,255,0.55)", fontSize: 11, flexShrink: 1 },
  metaFee: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "600" },
  metaFeeFree: { color: "#5EB3E8", fontWeight: "800" },
  priceRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  price: { color: "#F07070", fontWeight: "800", fontSize: 15 },
  oldPrice: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 12,
    textDecorationLine: "line-through",
  },
});
