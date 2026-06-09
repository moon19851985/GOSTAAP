import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StarterMealCard } from "./StarterMealCard";
import { useMobileLayout } from "../lib/layout";
import { colors } from "../theme/colors";
import type { StarterMeal } from "../types/starterMeal";

type Props = {
  meals: StarterMeal[];
  startingFrom: number | null;
  showAdd?: boolean;
  onAddToCart: (meal: StarterMeal) => void;
  onPressRestaurant: (restaurantId: string) => void;
  deliveryMeta: (
    lat: number,
    lng: number,
    offerDeliveryFee?: number | null
  ) => { eta: string; feeLabel?: string };
};

const CARD_GAP = 18;
const IMAGE_H = 128;

/** عنابي قوي أعلى → يذوب في خلفية التطبيق أسفل */
const GRADIENT_TOP = "#5C1A2E";
const GRADIENT_MID = "#2E1C24";

export function StarterMealsSection({
  meals,
  startingFrom,
  showAdd = true,
  onAddToCart,
  onPressRestaurant,
  deliveryMeta,
}: Props) {
  const { width } = useMobileLayout();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  if (meals.length === 0) return null;

  const cardWidth = Math.round(Math.min(176, width * 0.46));
  const step = cardWidth + CARD_GAP;
  const badgePrice = startingFrom ?? Math.floor(Math.min(...meals.map((m) => m.discountedPrice)));

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.round(x / step);
      if (i >= 0 && i < meals.length) setIndex(i);
    },
    [meals.length, step]
  );

  return (
    <View style={styles.outer}>
      <LinearGradient
        colors={[GRADIENT_TOP, GRADIENT_MID, colors.bg]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.wrap}
      >
        <View style={styles.header}>
          <Text style={styles.headerEmoji}>🍗🍔🥤</Text>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>وجبات ابتداءً من</Text>
            <View style={styles.priceBadge}>
              <Text style={styles.priceBadgeText}>{badgePrice} ريال</Text>
            </View>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          snapToAlignment="start"
          decelerationRate="fast"
          nestedScrollEnabled
          contentContainerStyle={styles.row}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {meals.map((meal) => {
            const meta = deliveryMeta(
              meal.restaurant.lat,
              meal.restaurant.lng,
              meal.offerDeliveryFee
            );
            return (
              <View key={meal.id} style={[styles.slide, { width: cardWidth }]}>
                <StarterMealCard
                  meal={meal}
                  width={cardWidth}
                  imageHeight={IMAGE_H}
                  showAdd={showAdd}
                  etaLabel={meta.eta}
                  feeLabel={meta.feeLabel}
                  onAdd={() => onAddToCart(meal)}
                  onPressRestaurant={() => onPressRestaurant(meal.restaurant.id)}
                />
              </View>
            );
          })}
        </ScrollView>

        {meals.length > 1 ? (
          <View style={styles.dots}>
            {meals.map((meal, i) => (
              <View key={meal.id} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const HEADER_PAD = 16;

const styles = StyleSheet.create({
  outer: {
    marginBottom: 8,
    alignSelf: "stretch",
    width: "100%",
  },
  wrap: {
    paddingTop: 14,
    paddingBottom: 16,
    overflow: "hidden",
    width: "100%",
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingHorizontal: HEADER_PAD,
  },
  headerEmoji: { fontSize: 40, marginLeft: 8 },
  headerText: {
    flex: 1,
    alignItems: "flex-end",
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 8,
  },
  priceBadge: {
    backgroundColor: "#FF4D8D",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
    alignSelf: "flex-end",
  },
  priceBadgeText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 17,
  },
  row: {
    flexDirection: "row-reverse",
    paddingHorizontal: 0,
    gap: CARD_GAP,
  },
  slide: {},
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: HEADER_PAD,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  dotActive: {
    backgroundColor: colors.accentOrange,
    width: 22,
  },
});
