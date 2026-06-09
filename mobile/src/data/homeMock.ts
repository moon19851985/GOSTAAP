/** بيانات عرض مبدئية — تُستبدل لاحقاً بـ API */
export type QuickCategory = {
  id: string;
  label: string;
  emoji: string;
  badge?: string;
};

export type HomeBanner = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  accent?: string;
};

export type CuisineChip = {
  id: string;
  label: string;
  emoji: string;
};

import type { OfferSlot } from "../types/offerSlot";
import {
  HOME_DAILY_OFFER_SLOTS,
  OFFER_SLOT_EMOJI,
  OFFER_SLOT_SHORT_LABELS,
} from "../types/offerSlot";

export type DailyOfferCard = {
  id: string;
  label: string;
  slot: OfferSlot;
  variant: "category" | "flash";
  emoji?: string;
  topText?: string;
  bottomText?: string;
};

function categoryCard(slot: OfferSlot): DailyOfferCard {
  return {
    id: slot.toLowerCase(),
    label: OFFER_SLOT_SHORT_LABELS[slot],
    slot,
    variant: "category",
    emoji: OFFER_SLOT_EMOJI[slot],
  };
}

export const QUICK_CATEGORIES: QuickCategory[] = [
  { id: "restaurants", label: "مطاعم", emoji: "🍗" },
  { id: "market", label: "مقاضي", emoji: "🛒", badge: "قريباً" },
  { id: "sweets", label: "قهوة وحلى", emoji: "☕" },
  { id: "pharmacy", label: "صيدليات", emoji: "💊", badge: "قريباً" },
  { id: "flowers", label: "ورود", emoji: "🌹", badge: "قريباً" },
  { id: "pickup", label: "استلم بنفسك", emoji: "🛍️", badge: "خصم" },
];

export const HOME_BANNERS: HomeBanner[] = [
  {
    id: "fast",
    title: "توصيل أسرع",
    subtitle: "اطلب الآن — يصلك ساخناً",
    emoji: "🚀",
    accent: "#1B4332",
  },
  {
    id: "offers",
    title: "خصم حتى 30%",
    subtitle: "عروض اليوم على المطاعم",
    emoji: "🏷️",
    accent: "#1D3557",
  },
];

/** بطاقات العروض اليومية في الرئيسية — 6 ثابتة فقط */
export const DAILY_OFFER_CARDS: DailyOfferCard[] = HOME_DAILY_OFFER_SLOTS.map((slot) => {
  if (slot === "HOURLY") {
    return {
      id: "flash",
      label: "عروض الساعة",
      slot: "HOURLY",
      variant: "flash",
      topText: "خصم حتى 35 ريال",
      bottomText: "+ توصيل مخفض",
    };
  }
  return categoryCard(slot);
});

/** @deprecated استخدم DAILY_OFFER_CARDS */
export const DAILY_OFFER_CHIPS = DAILY_OFFER_CARDS.map((c) => ({
  id: c.id,
  label: c.label,
  emoji: c.emoji ?? "🏷️",
}));

export const CUISINE_CHIPS: CuisineChip[] = [
  { id: "fast", label: "وجبات سريعة", emoji: "🍟" },
  { id: "dessert", label: "حلى", emoji: "🍰" },
  { id: "arabic", label: "عربي", emoji: "🥙" },
  { id: "healthy", label: "صحي", emoji: "🥗" },
  { id: "coffee", label: "قهوة", emoji: "☕" },
  { id: "grill", label: "مشويات", emoji: "🔥" },
];
