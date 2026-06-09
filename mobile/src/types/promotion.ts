import type { OfferSlot } from "./offerSlot";

export type Promotion = {
  id: string;
  productId: string;
  discountedPrice: number;
  originalPrice: number;
  savingsPercent: number;
  reason: string;
  isStarterDeal?: boolean;
  offerSlot?: OfferSlot | null;
  offerDeliveryFee?: number | null;
  hourStart?: string | null;
  hourEnd?: string | null;
  isHourlyActive?: boolean;
  product: {
    id: string;
    name: string;
    price: number;
    imageUrl?: string | null;
    category: string;
    mealType: string;
  };
  restaurant: {
    id: string;
    name: string;
    logoUrl?: string | null;
    lat?: number;
    lng?: number;
  };
};
