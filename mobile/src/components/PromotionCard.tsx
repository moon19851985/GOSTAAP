import { View, Text, Pressable, StyleSheet, Image } from "react-native";
import { resolveImageUrl } from "../lib/upload";
import { formatMoney } from "../lib/formatMoney";
import { useMobileLayout } from "../lib/layout";
import type { Promotion } from "../types/promotion";

type Props = {
  promotion: Promotion;
  width?: number;
  imageHeight?: number;
  onAddToCart?: () => void;
  compact?: boolean;
};

export function PromotionCard({
  promotion,
  width: widthProp,
  imageHeight: imageHeightProp,
  onAddToCart,
  compact,
}: Props) {
  const layout = useMobileLayout();
  const width = widthProp ?? layout.promoCardWidth;
  const cardHeight =
    imageHeightProp ??
    (compact ? layout.promoImageHeightCompact : layout.promoImageHeight);
  const img = resolveImageUrl(promotion.product.imageUrl);

  return (
    <View style={[styles.card, { width, height: cardHeight }]}>
      {img ? (
        <Image source={{ uri: img }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.placeholderIcon}>🍽️</Text>
        </View>
      )}

      {/* تظليل علوي خفيف */}
      <View style={styles.topShade} pointerEvents="none" />

      {/* تاغ التوفير */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>وفر {promotion.savingsPercent}%</Text>
      </View>

      {/* كل المحتوى على الصورة — أسفل */}
      <View style={styles.overlay}>
        <View style={styles.overlayInner}>
          <View style={styles.reasonPill}>
            <Text style={styles.reasonText} numberOfLines={2}>
              {promotion.reason}
            </Text>
          </View>

          <Text style={[styles.restaurantName, compact && styles.restaurantNameCompact]} numberOfLines={1}>
            {promotion.restaurant.name}
          </Text>

          <Text style={[styles.productName, compact && styles.productNameCompact]} numberOfLines={2}>
            {promotion.product.name}
          </Text>

          <View style={styles.priceRow}>
            <Text style={[styles.discountedPrice, compact && styles.discountedPriceCompact]}>
              {formatMoney(promotion.discountedPrice)} ر.س
            </Text>
            <Text style={[styles.originalPrice, compact && styles.originalPriceCompact]}>
              {formatMoney(promotion.originalPrice)} ر.س
            </Text>
          </View>

          {onAddToCart && !compact && (
            <Pressable style={styles.addBtn} onPress={onAddToCart}>
              <Text style={styles.addBtnText}>أضف للسلة بالعرض</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1A1A1A",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3A3A3A",
  },
  placeholderIcon: { fontSize: 48 },
  topShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  badge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#E63946",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    zIndex: 2,
  },
  badgeText: { color: "#FFF", fontWeight: "800", fontSize: 14 },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.62)",
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 14,
  },
  overlayInner: {
    alignItems: "stretch",
  },
  reasonPill: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(232, 93, 4, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
    maxWidth: "100%",
  },
  reasonText: {
    color: "#FFF",
    fontWeight: "700",
    textAlign: "right",
    fontSize: 13,
    lineHeight: 18,
  },
  restaurantName: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    textAlign: "right",
    fontWeight: "600",
    marginBottom: 4,
  },
  restaurantNameCompact: { fontSize: 11, marginBottom: 2 },
  productName: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "right",
    color: "#FFF",
    lineHeight: 26,
    marginBottom: 8,
  },
  productNameCompact: { fontSize: 16, lineHeight: 22, marginBottom: 6 },
  priceRow: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 10,
  },
  discountedPrice: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFB347",
  },
  discountedPriceCompact: { fontSize: 20 },
  originalPrice: {
    fontSize: 15,
    color: "rgba(255,255,255,0.55)",
    textDecorationLine: "line-through",
    fontWeight: "600",
  },
  originalPriceCompact: { fontSize: 13 },
  addBtn: {
    marginTop: 12,
    backgroundColor: "#E85D04",
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
  },
  addBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
