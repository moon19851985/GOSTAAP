import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleSheet,
} from "react-native";
import { PromotionCard } from "./PromotionCard";
import { useMobileLayout } from "../lib/layout";
import type { Promotion } from "../types/promotion";
import { colors } from "../theme/colors";

const CARD_GAP = 10;
const AUTO_MS = 3500;

type Props = {
  promotions: Promotion[];
  onAddToCart?: (p: Promotion) => void;
  showAddButton?: boolean;
  hideTitle?: boolean;
};

export function FeaturedPromotionsCarousel({
  promotions,
  onAddToCart,
  showAddButton,
  hideTitle,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const { promoCardWidth: cardWidth } = useMobileLayout();
  const step = cardWidth + CARD_GAP;

  useEffect(() => {
    if (paused || promotions.length <= 1) return;

    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % promotions.length;
        scrollRef.current?.scrollTo({ x: next * step, animated: true });
        return next;
      });
    }, AUTO_MS);

    return () => clearInterval(timer);
  }, [paused, promotions.length, step]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.round(x / step);
      if (i >= 0 && i < promotions.length) setIndex(i);
    },
    [promotions.length, step]
  );

  if (promotions.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {!hideTitle && <Text style={styles.title}>🔥 العروض المميزة</Text>}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        snapToAlignment="start"
        decelerationRate="fast"
        nestedScrollEnabled
        contentContainerStyle={styles.row}
        onScrollBeginDrag={() => setPaused(true)}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {promotions.map((p, i) => (
          <View
            key={p.id}
            style={[styles.slide, { width: cardWidth, marginRight: i < promotions.length - 1 ? CARD_GAP : 0 }]}
          >
            <PromotionCard
              promotion={p}
              width={cardWidth}
              onAddToCart={
                showAddButton && onAddToCart ? () => onAddToCart(p) : undefined
              }
            />
          </View>
        ))}
      </ScrollView>
      {promotions.length > 1 && (
        <View style={styles.dots}>
          {promotions.map((p, i) => (
            <View key={p.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  title: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "right",
    marginHorizontal: 12,
    marginBottom: 10,
    color: colors.text,
  },
  row: { paddingHorizontal: 12 },
  slide: {},
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#DDD",
  },
  dotActive: { backgroundColor: "#E85D04", width: 18 },
});
