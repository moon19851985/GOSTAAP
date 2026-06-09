import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { resolveImageUrl } from "../lib/upload";
import { formatMoney } from "../lib/formatMoney";
import { formatDistanceKm, restaurantDeliveryMeta } from "../lib/deliveryFee";
import { formatOfferDeliveryLabel } from "../lib/deliveryOffer";
import { colors } from "../theme/colors";
import type { Promotion } from "../types/promotion";

type Props = {
  promotion: Promotion;
  customerCoords: { lat: number; lng: number } | null;
  showAdd?: boolean;
  onAdd?: () => void;
};

export function OfferSlotPromotionRow({
  promotion: p,
  customerCoords,
  showAdd = true,
  onAdd,
}: Props) {
  const router = useRouter();
  const thumb =
    resolveImageUrl(p.product.imageUrl) ?? resolveImageUrl(p.restaurant.logoUrl);
  const lat = p.restaurant.lat;
  const lng = p.restaurant.lng;
  const etaMeta =
    lat != null && lng != null
      ? restaurantDeliveryMeta(lat, lng, customerCoords?.lat ?? null, customerCoords?.lng ?? null)
      : { eta: "—", feeLabel: undefined as string | undefined };
  const deliveryLabel = formatOfferDeliveryLabel(p.offerDeliveryFee);
  const distance =
    lat != null && lng != null && customerCoords
      ? formatDistanceKm(lat, lng, customerCoords.lat, customerCoords.lng)
      : null;

  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push(`/menu/${p.restaurant.id}`)}
    >
      <View style={styles.thumbWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <Text style={styles.thumbEmoji}>🍽️</Text>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.restaurantName} numberOfLines={1}>
          {p.restaurant.name}
        </Text>
        <Text style={styles.productLine} numberOfLines={1}>
          {p.product.name}
          {p.product.category ? ` · ${p.product.category}` : ""}
        </Text>
        {p.savingsPercent > 0 ? (
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsText}>وفر {p.savingsPercent}%</Text>
          </View>
        ) : deliveryLabel ? (
          <View style={[styles.savingsBadge, styles.deliveryBadge]}>
            <Text style={styles.savingsText}>{deliveryLabel}</Text>
          </View>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={styles.price}>{formatMoney(p.discountedPrice)} ر.س</Text>
          {p.originalPrice > p.discountedPrice ? (
            <Text style={styles.oldPrice}>{formatMoney(p.originalPrice)} ر.س</Text>
          ) : null}
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.meta}>🛵 {etaMeta.eta}</Text>
          {distance ? (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.meta}>{distance}</Text>
            </>
          ) : null}
        </View>
      </View>

      {showAdd && onAdd ? (
        <Pressable style={styles.addBtn} onPress={onAdd} hitSlop={8}>
          <Ionicons name="add" size={22} color={colors.bg} />
        </Pressable>
      ) : (
        <Ionicons name="chevron-back" size={20} color={colors.textDim} style={styles.chevron} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  thumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumb: { width: "100%", height: "100%" },
  thumbEmoji: { fontSize: 28 },
  body: { flex: 1, alignItems: "flex-end" },
  restaurantName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  productLine: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
    textAlign: "right",
  },
  deliveryBadge: { backgroundColor: "#0077B6" },
  savingsBadge: {
    marginTop: 6,
    backgroundColor: "#1D4ED8",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  savingsText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  metaRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 4,
  },
  price: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  oldPrice: {
    color: colors.textDim,
    fontSize: 12,
    textDecorationLine: "line-through",
  },
  metaDot: { color: colors.textDim, fontSize: 12 },
  meta: { color: colors.textMuted, fontSize: 12 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  chevron: { marginStart: 4 },
});
