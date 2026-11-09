"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { track } from "@/lib/fb-pixel";
import { getEffectivePrice } from "@/lib/pricing";
import type { Product } from "@/types/shared";

export type SelectedVariants = Record<string, string>;

export type CartVariantSelection = {
  selectedVariants?: SelectedVariants;
  unitPrice?: number;
  variantSku?: string;
};

export type CartLine = {
  id: string;
  productId: string;
  slug: string;
  title: string;
  image: string;
  unitPrice: number;
  quantity: number;
  category: string;
  freeDelivery?: boolean;
  selectedVariants?: SelectedVariants;
  variantSku?: string;
};

type CartState = {
  lines: CartLine[];
  add: (p: Product, qty?: number, selection?: CartVariantSelection) => void;
  remove: (lineId: string) => void;
  setQty: (lineId: string, qty: number) => void;
  clear: () => void;
  subtotal: () => number;
  count: () => number;
};

function variantKey(selectedVariants?: SelectedVariants) {
  if (!selectedVariants || Object.keys(selectedVariants).length === 0) return "";
  return Object.entries(selectedVariants)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}:${value}`)
    .join("|");
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (p, qty = 1, selection = {}) =>
        set((s) => {
          const selectedVariants = selection.selectedVariants;
          const id = `${p._id}${variantKey(selectedVariants) ? `::${variantKey(selectedVariants)}` : ""}`;
          const existing = s.lines.find((l) => (l.id ?? l.productId) === id);
          if (existing) {
            return {
              lines: s.lines.map((l) =>
                (l.id ?? l.productId) === id
                  ? {
                      ...l,
                      id,
                      quantity: l.quantity + qty,
                      freeDelivery: p.freeDelivery === true,
                    }
                  : l,
              ),
            };
          }
          return {
            lines: [
              ...s.lines,
              {
                id,
                productId: p._id,
                slug: p.slug,
                title: p.title,
                image: p.images[0] ?? "",
                unitPrice: selection.unitPrice ?? getEffectivePrice(p),
                quantity: qty,
                category: p.category,
                freeDelivery: p.freeDelivery === true,
                selectedVariants,
                variantSku: selection.variantSku,
              },
            ],
          };
        }),
      remove: (lineId) =>
        set((s) => {
          const line = s.lines.find((l) => (l.id ?? l.productId) === lineId);
          if (line) {
            track({
              event: "RemoveFromCart",
              contentIds: [line.productId],
              contentName: line.title,
              value: line.unitPrice * line.quantity,
              currency: "BDT",
              items: [
                {
                  id: line.productId,
                  name: line.title,
                  category: line.category,
                  price: line.unitPrice,
                  quantity: line.quantity,
                },
              ],
            });
          }
          return { lines: s.lines.filter((l) => (l.id ?? l.productId) !== lineId) };
        }),
      setQty: (lineId, qty) =>
        set((s) => {
          const newQty = Math.max(0, qty);
          const line = s.lines.find((l) => (l.id ?? l.productId) === lineId);
          
          // Track removal if quantity goes to 0
          if (line && newQty === 0) {
            track({
              event: "RemoveFromCart",
              contentIds: [line.productId],
              contentName: line.title,
              value: line.unitPrice * line.quantity,
              currency: "BDT",
              items: [
                {
                  id: line.productId,
                  name: line.title,
                  category: line.category,
                  price: line.unitPrice,
                  quantity: line.quantity,
                },
              ],
            });
          }
          
          return {
            lines: s.lines
              .map((l) =>
                (l.id ?? l.productId) === lineId ? { ...l, quantity: newQty } : l,
              )
              .filter((l) => l.quantity > 0),
          };
        }),
      clear: () => set({ lines: [] }),
      subtotal: () =>
        get().lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
      count: () => get().lines.reduce((n, l) => n + l.quantity, 0),
    }),
    {
      name: "gk-cart-v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
