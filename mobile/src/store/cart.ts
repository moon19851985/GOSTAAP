import { create } from "zustand";

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  restaurantId: string;
  restaurantName: string;
  imageUrl?: string | null;
};

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (productId: string) => void;
  updateQty: (productId: string, quantity: number) => void;
  clear: () => void;
};

export const useCart = create<CartState>((set) => ({
  items: [],
  add: (item, qty = 1) =>
    set((s) => {
      const existing = s.items.find((i) => i.productId === item.productId);
      if (existing) {
        return {
          items: s.items.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: i.quantity + qty }
              : i
          ),
        };
      }
      return { items: [...s.items, { ...item, quantity: qty }] };
    }),
  remove: (productId) =>
    set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
  updateQty: (productId, quantity) =>
    set((s) => ({
      items:
        quantity <= 0
          ? s.items.filter((i) => i.productId !== productId)
          : s.items.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
    })),
  clear: () => set({ items: [] }),
}));
