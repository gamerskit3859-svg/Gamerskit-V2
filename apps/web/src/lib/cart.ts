"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { track } from "@/lib/fb-pixel";
import type { Product } from "@/types/shared";

export type CartLine = {
  productId: string;
  slug: string;
  title: string;
  image: string;
  unitPrice: number;
  quantity: number;
  category: string;
};

type CartState = {
  lines: CartLine[];
  add: (p: Product, qty?: number) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  subtotal: () => number;
  count: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (p, qty = 1) =>
        set((s) => {
          const existing = s.lines.find((l) => l.productId === p._id);
          if (existing) {
            return {
              lines: s.lines.map((l) =>
                l.productId === p._id ? { ...l, quantity: l.quantity + qty } : l,
              ),
            };
          }
          return {
            lines: [
              ...s.lines,
              {
                productId: p._id,
                slug: p.slug,
                title: p.title,
                image: p.images[0] ?? "",
                unitPrice: p.price,
                quantity: qty,
                category: p.category,
              },
            ],
          };
        }),
      remove: (productId) =>
        set((s) => {
          const line = s.lines.find((l) => l.productId === productId);
          if (line) {
            track({
              event: "RemoveFromCart",
              contentIds: [productId],
              contentName: line.title,
              value: line.unitPrice * line.quantity,
              currency: "BDT",
              items: [
                {
                  id: productId,
                  name: line.title,
                  category: line.category,
                  price: line.unitPrice,
                  quantity: line.quantity,
                },
              ],
            });
          }
          return { lines: s.lines.filter((l) => l.productId !== productId) };
        }),
      setQty: (productId, qty) =>
        set((s) => {
          const newQty = Math.max(0, qty);
          const line = s.lines.find((l) => l.productId === productId);
          
          // Track removal if quantity goes to 0
          if (line && newQty === 0) {
            track({
              event: "RemoveFromCart",
              contentIds: [productId],
              contentName: line.title,
              value: line.unitPrice * line.quantity,
              currency: "BDT",
              items: [
                {
                  id: productId,
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
                l.productId === productId ? { ...l, quantity: newQty } : l,
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
