import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { DAILY_OFFER_CARDS, type DailyOfferCard } from "../data/homeMock";
import { colors } from "../theme/colors";
import type { OfferSlot } from "../types/offerSlot";

const CARD_GAP = 12;
const CATEGORY_W = 112;
const CATEGORY_H = 152;
const FLASH_W = 132;
const FLASH_H = 168;

const FLASH_DURATION_SEC = 6 * 60 + 30;

type Props = {
  onOpenSlot: (slot: OfferSlot) => void;
  onOpenAll: () => void;
  slotCounts?: Partial<Record<OfferSlot, number>>;
};

function formatCountdown(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function CategoryOfferCard({
  card,
  count,
  onPress,
}: {
  card: DailyOfferCard;
  count: number;
  onPress: () => void;
}) {
  const compact = card.compact;
  const w = compact ? CATEGORY_COMPACT_W : CATEGORY_W;
  const h = compact ? CATEGORY_COMPACT_H : CATEGORY_H;
  return (
    <Pressable
      style={[styles.categoryCard, compact && styles.categoryCardCompact, { width: w, height: h }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={card.label}
    >
      {count > 0 ? (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{count}</Text>
        </View>
      ) : null}
      <Text style={styles.categoryLabel} numberOfLines={1}>
        {card.label}
      </Text>
      <View style={styles.categoryArt}>
        <Text style={styles.categoryEmoji}>{card.emoji ?? "🍽️"}</Text>
      </View>
    </Pressable>
  );
}

function FlashOfferCard({
  card,
  onPress,
  timer,
}: {
  card: DailyOfferCard;
  onPress: () => void;
  timer: string;
}) {
  return (
    <Pressable
      style={[styles.flashCard, { width: FLASH_W, height: FLASH_H }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={card.label}
    >
      <View style={styles.flashTop}>
        <Text style={styles.flashTopText}>{card.topText ?? "خصم اليوم"}</Text>
      </View>
      <View style={styles.flashMid}>
        <Text style={styles.flashStar}>✦</Text>
        <Text style={styles.flashTitle}>{card.label}</Text>
        <Text style={styles.flashBolt}>⚡</Text>
      </View>
      <View style={styles.flashBottom}>
        <Text style={styles.flashBottomText}>{card.bottomText ?? "عروض محدودة"}</Text>
        <View style={styles.timerPill}>
          <Text style={styles.timerIcon}>⏱</Text>
          <Text style={styles.timerText}>{timer}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function DailyOffersCarousel({ onOpenSlot, onOpenAll, slotCounts = {} }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(FLASH_DURATION_SEC);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? FLASH_DURATION_SEC : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const cards = DAILY_OFFER_CARDS;
  const step = CATEGORY_W + CARD_GAP;
  const timer = formatCountdown(secondsLeft);
  const totalOffers = Object.values(slotCounts).reduce((n, c) => n + (c ?? 0), 0);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.round(x / step);
      if (i >= 0 && i < cards.length) setIndex(i);
    },
    [cards.length, step]
  );

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader
        title="العروض اليومية"
        subtitle={totalOffers > 0 ? `${totalOffers} عرض من المطاعم` : undefined}
        actionLabel="عرض الكل"
        onAction={onOpenAll}
      />

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
        {cards.map((card) => {
          const count = slotCounts[card.slot] ?? 0;
          const open = () => onOpenSlot(card.slot);
          return card.variant === "flash" ? (
            <FlashOfferCard key={card.id} card={card} timer={timer} onPress={open} />
          ) : (
            <CategoryOfferCard key={card.id} card={card} count={count} onPress={open} />
          );
        })}
      </ScrollView>

      {cards.length > 1 && cards.length <= 8 ? (
        <View style={styles.dots}>
          {cards.map((card, i) => (
            <View key={card.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  row: {
    flexDirection: "row-reverse",
    paddingHorizontal: 16,
    gap: CARD_GAP,
    alignItems: "flex-start",
  },
  categoryCard: {
    backgroundColor: "#F0E4D4",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    overflow: "hidden",
    paddingTop: 12,
    paddingHorizontal: 8,
    position: "relative",
  },
  countBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accentOrange,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    zIndex: 2,
  },
  countBadgeText: { color: "#FFF", fontWeight: "800", fontSize: 11 },
  categoryLabel: {
    color: "#4A3228",
    fontWeight: "800",
    fontSize: 18,
    textAlign: "center",
  },
  categoryArt: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 8,
  },
  categoryEmoji: { fontSize: 50, lineHeight: 56 },
  flashCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    overflow: "hidden",
  },
  flashTop: {
    backgroundColor: "#E63946",
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  flashTopText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 11,
    textAlign: "center",
  },
  flashMid: {
    flex: 1,
    backgroundColor: "#FFD60A",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  flashStar: { fontSize: 14, color: "#1A1A1A" },
  flashTitle: {
    color: "#1A1A1A",
    fontWeight: "900",
    fontSize: 15,
    textAlign: "center",
  },
  flashBolt: { fontSize: 16 },
  flashBottom: {
    backgroundColor: "#E63946",
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
    gap: 6,
  },
  flashBottomText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 10,
    textAlign: "center",
  },
  timerPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  timerIcon: { fontSize: 12 },
  timerText: {
    color: "#FF6B6B",
    fontWeight: "800",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    marginBottom: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: "#5EB3E8",
    width: 22,
  },
});
