import { View, Text, Pressable, StyleSheet, Image } from "react-native";
import { resolveImageUrl } from "../lib/upload";
import { formatMoney } from "../lib/formatMoney";
import { colors } from "../theme/colors";
import type { MealPackage } from "../types/package";

type Props = {
  pkg: MealPackage;
  width: number;
  imageHeight: number;
  onAdd?: () => void;
  onPressRestaurant?: () => void;
};

export function PackageCard({ pkg, width, imageHeight, onAdd, onPressRestaurant }: Props) {
  const img = resolveImageUrl(pkg.imageUrl);
  const hasDiscount =
    pkg.originalPrice != null && pkg.originalPrice > pkg.price;
  const itemSummary = pkg.items
    .map((i) => (i.quantity > 1 ? `${i.productName} ×${i.quantity}` : i.productName))
    .slice(0, 3)
    .join(" · ");

  return (
    <View style={[styles.card, { width, height: imageHeight }]}>
      {img ? (
        <Image source={{ uri: img }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={styles.placeholderEmoji}>📦</Text>
        </View>
      )}

      <View style={styles.topShade} pointerEvents="none" />

      <View style={styles.badge}>
        <Text style={styles.badgeText}>بكج</Text>
      </View>

      {onAdd ? (
        <Pressable
          style={styles.addFab}
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="أضف للعربة"
        >
          <Text style={styles.addFabText}>+</Text>
        </Pressable>
      ) : null}

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.overlayInner} pointerEvents="box-none">
          <Text style={styles.name} numberOfLines={2}>
            {pkg.name}
          </Text>

          {onPressRestaurant ? (
            <Pressable onPress={onPressRestaurant} hitSlop={6}>
              <Text style={styles.restaurantLink} numberOfLines={1}>
                {pkg.restaurant.name} ←
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.restaurantName} numberOfLines={1}>
              {pkg.restaurant.name}
            </Text>
          )}

          {itemSummary ? (
            <Text style={styles.itemsHint} numberOfLines={2}>
              {itemSummary}
            </Text>
          ) : null}

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatMoney(pkg.price)} ر.س</Text>
            {hasDiscount ? (
              <Text style={styles.oldPrice}>{formatMoney(pkg.originalPrice!)} ر.س</Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: "100%", height: "100%" },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
  },
  placeholderEmoji: { fontSize: 40 },
  topShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  badge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    zIndex: 2,
  },
  badgeText: { color: "#1a1a1a", fontWeight: "800", fontSize: 12 },
  addFab: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentOrange,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  addFabText: { color: "#FFF", fontWeight: "800", fontSize: 24, lineHeight: 26 },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  overlayInner: {
    paddingHorizontal: 12,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  name: {
    fontWeight: "800",
    fontSize: 17,
    textAlign: "right",
    color: "#FFF",
    lineHeight: 22,
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    textAlign: "right",
    marginBottom: 4,
  },
  restaurantLink: {
    fontSize: 12,
    color: colors.accentOrange,
    textAlign: "right",
    fontWeight: "600",
    marginBottom: 4,
  },
  itemsHint: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    textAlign: "right",
    lineHeight: 16,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  price: { color: colors.accentOrange, fontWeight: "800", fontSize: 18 },
  oldPrice: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    textDecorationLine: "line-through",
  },
});
