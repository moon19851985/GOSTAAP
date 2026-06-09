import { View, Text, Image, StyleSheet } from "react-native";
import { resolveImageUrl } from "../lib/upload";
import { formatMoney } from "../lib/formatMoney";
import { colors } from "../theme/colors";
import type { Promotion } from "../types/promotion";

type Props = {
  promotion: Promotion;
};

export function PromotionCompactRow({ promotion: p }: Props) {
  const img = resolveImageUrl(p.product.imageUrl);

  return (
    <View style={styles.row}>
      {img ? (
        <Image source={{ uri: img }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Text>🍽️</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.text}>
          {p.product.name} — {p.reason} — {formatMoney(p.discountedPrice)} ر.س
        </Text>
        <Text style={styles.meta}>
          {formatMoney(p.originalPrice)} ر.س — وفر {p.savingsPercent}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thumb: { width: 52, height: 52, borderRadius: 8 },
  thumbPlaceholder: {
    backgroundColor: colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1 },
  text: { textAlign: "right", color: colors.text, fontSize: 14, lineHeight: 20 },
  meta: { textAlign: "right", color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
