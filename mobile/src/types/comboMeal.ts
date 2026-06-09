export type ComboItemLine = {
  productId: string;
  productName: string;
  quantity: number;
  productPrice?: number;
};

export type ComboMealPromotion = {
  id: string;
  discountedPrice: number;
  reason: string;
  offerSlot: string | null;
  hourStart?: string | null;
  hourEnd?: string | null;
  hasDailyOffer: boolean;
};

export type ComboMeal = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  displayPrice: number;
  catalogTotal?: number;
  imageUrl?: string | null;
  category: string;
  mealType?: string | null;
  isComboMeal: boolean;
  isStarterMeal: boolean;
  items: ComboItemLine[];
  promotion: ComboMealPromotion | null;
  createdAt?: string;
};
