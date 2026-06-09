/** أقسام العروض اليومية — فئات ثابتة + عروض الساعة + أخرى */
export const OFFER_SLOTS = [
  "COFFEE",
  "SWEETS",
  "GRILL",
  "FAST_FOOD",
  "PIZZA",
  "SHAWARMA",
  "BREAKFAST",
  "ARABIC",
  "SANDWICHES",
  "HEALTHY",
  "SEAFOOD",
  "ASIAN",
  "DRINKS",
  "HOURLY",
  "OTHER",
] as const;

export type OfferSlot = (typeof OFFER_SLOTS)[number];

export const CATEGORY_OFFER_SLOTS = OFFER_SLOTS.filter(
  (s): s is Exclude<OfferSlot, "HOURLY" | "OTHER"> => s !== "HOURLY" && s !== "OTHER"
);

/** ستة أقسام ثابتة في الرئيسية — تظهر دائماً حتى بدون عروض */
export const HOME_DAILY_OFFER_SLOTS: readonly OfferSlot[] = [
  "SWEETS",
  "COFFEE",
  "GRILL",
  "SHAWARMA",
  "FAST_FOOD",
  "HOURLY",
] as const;

export const OFFER_SLOT_LABELS: Record<OfferSlot, string> = {
  COFFEE: "قهوة",
  SWEETS: "حلى",
  GRILL: "مشويات",
  FAST_FOOD: "وجبات سريعة",
  PIZZA: "بيتزا",
  SHAWARMA: "شاورما",
  BREAKFAST: "فطور",
  ARABIC: "أطباق عربية",
  SANDWICHES: "سندويشات",
  HEALTHY: "صحي",
  SEAFOOD: "بحري",
  ASIAN: "آسيوي",
  DRINKS: "مشروبات",
  HOURLY: "عروض الساعة",
  OTHER: "عروض أخرى",
};

/** تسمية مختصرة لبطاقات الرئيسية */
export const OFFER_SLOT_SHORT_LABELS: Record<OfferSlot, string> = {
  COFFEE: "قهوة",
  SWEETS: "حلى",
  GRILL: "مشويات",
  FAST_FOOD: "سريعة",
  PIZZA: "بيتزا",
  SHAWARMA: "شاورما",
  BREAKFAST: "فطور",
  ARABIC: "عربي",
  SANDWICHES: "سندويش",
  HEALTHY: "صحي",
  SEAFOOD: "بحري",
  ASIAN: "آسيوي",
  DRINKS: "مشروبات",
  HOURLY: "الساعة",
  OTHER: "أخرى",
};

export const OFFER_SLOT_EMOJI: Record<OfferSlot, string> = {
  COFFEE: "☕",
  SWEETS: "🍰",
  GRILL: "🔥",
  FAST_FOOD: "🍔",
  PIZZA: "🍕",
  SHAWARMA: "🌯",
  BREAKFAST: "🥐",
  ARABIC: "🍛",
  SANDWICHES: "🥪",
  HEALTHY: "🥗",
  SEAFOOD: "🦐",
  ASIAN: "🍜",
  DRINKS: "🥤",
  HOURLY: "⏰",
  OTHER: "🏷️",
};

export type OfferSlotMeta = {
  emoji: string;
  headerBg: string;
  searchPlaceholder: string;
};

const HEADER_BEIGE = "#F0E4D4";

export const OFFER_SLOT_META: Record<OfferSlot, OfferSlotMeta> = {
  COFFEE: {
    emoji: "☕",
    headerBg: HEADER_BEIGE,
    searchPlaceholder: "ابحث عن قهوة أو مطعم",
  },
  SWEETS: {
    emoji: "🍰",
    headerBg: HEADER_BEIGE,
    searchPlaceholder: "ابحث عن حلى أو مطعم",
  },
  GRILL: {
    emoji: "🔥",
    headerBg: HEADER_BEIGE,
    searchPlaceholder: "ابحث عن مشويات أو مطعم",
  },
  FAST_FOOD: {
    emoji: "🍔",
    headerBg: HEADER_BEIGE,
    searchPlaceholder: "ابحث عن وجبات سريعة",
  },
  PIZZA: {
    emoji: "🍕",
    headerBg: HEADER_BEIGE,
    searchPlaceholder: "ابحث عن بيتزا أو مطعم",
  },
  SHAWARMA: {
    emoji: "🌯",
    headerBg: HEADER_BEIGE,
    searchPlaceholder: "ابحث عن شاورما أو مطعم",
  },
  BREAKFAST: {
    emoji: "🥐",
    headerBg: HEADER_BEIGE,
    searchPlaceholder: "ابحث عن فطور أو مطعم",
  },
  ARABIC: {
    emoji: "🍛",
    headerBg: HEADER_BEIGE,
    searchPlaceholder: "ابحث عن أطباق عربية",
  },
  SANDWICHES: {
    emoji: "🥪",
    headerBg: HEADER_BEIGE,
    searchPlaceholder: "ابحث عن سندويشات",
  },
  HEALTHY: {
    emoji: "🥗",
    headerBg: "#E8F5E9",
    searchPlaceholder: "ابحث عن وجبات صحية",
  },
  SEAFOOD: {
    emoji: "🦐",
    headerBg: "#E3F2FD",
    searchPlaceholder: "ابحث عن مأكولات بحرية",
  },
  ASIAN: {
    emoji: "🍜",
    headerBg: HEADER_BEIGE,
    searchPlaceholder: "ابحث عن مطابخ آسيوية",
  },
  DRINKS: {
    emoji: "🥤",
    headerBg: HEADER_BEIGE,
    searchPlaceholder: "ابحث عن مشروبات",
  },
  HOURLY: {
    emoji: "⏰",
    headerBg: "#FFE8CC",
    searchPlaceholder: "ابحث في عروض الساعة",
  },
  OTHER: {
    emoji: "🏷️",
    headerBg: "#E8EEF4",
    searchPlaceholder: "ابحث في العروض أو المطاعم",
  },
};

export function parseOfferSlotParam(raw: string | undefined): OfferSlot | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  return OFFER_SLOTS.includes(v as OfferSlot) ? (v as OfferSlot) : null;
}
