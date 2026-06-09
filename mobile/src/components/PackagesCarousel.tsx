import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleSheet,
} from "react-native";
import { PackageCard } from "./PackageCard";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { useMobileLayout } from "../lib/layout";
import { colors } from "../theme/colors";
import type { MealPackage } from "../types/package";

const CARD_GAP = 12;
const AUTO_MS = 4000;

type Props = {
  packages: MealPackage[];
  onAddToCart?: (pkg: MealPackage) => void;
  onPressRestaurant?: (restaurantId: string) => void;
  showAddButton?: boolean;
};

export function PackagesCarousel({
  packages,
  onAddToCart,
  onPressRestaurant,
  showAddButton = true,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const { packageCardWidth, packageImageHeight } = useMobileLayout();
  const step = packageCardWidth + CARD_GAP;

  useEffect(() => {
    if (paused || packages.length <= 1) return;

    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % packages.length;
        scrollRef.current?.scrollTo({ x: next * step, animated: true });
        return next;
      });
    }, AUTO_MS);

    return () => clearInterval(timer);
  }, [paused, packages.length, step]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.round(x / step);
      if (i >= 0 && i < packages.length) setIndex(i);
    },
    [packages.length, step]
  );

  if (packages.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader title="بكجات مميزة" subtitle="وفّر أكثر مع بكجات المطاعم" />
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
        onScrollEndDrag={() => setPaused(false)}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {packages.map((pkg, i) => (
          <View
            key={pkg.id}
            style={[
              styles.slide,
              { width: packageCardWidth, marginRight: i < packages.length - 1 ? CARD_GAP : 0 },
            ]}
          >
            <PackageCard
              pkg={pkg}
              width={packageCardWidth}
              imageHeight={packageImageHeight}
              onAdd={
                showAddButton && onAddToCart ? () => onAddToCart(pkg) : undefined
              }
              onPressRestaurant={
                onPressRestaurant
                  ? () => onPressRestaurant(pkg.restaurant.id)
                  : undefined
              }
            />
          </View>
        ))}
      </ScrollView>
      {packages.length > 1 ? (
        <View style={styles.dots}>
          {packages.map((pkg, i) => (
            <View key={pkg.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  row: { paddingHorizontal: 16 },
  slide: {},
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    marginBottom: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.accentOrange, width: 20 },
});
