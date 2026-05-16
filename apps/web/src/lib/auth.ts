"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@/types/shared";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setSession: (s: { token: string; user: AuthUser }) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: ({ token, user }) => set({ token, user }),
      clear: () => {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("gk-admin-token");
        }
        set({ token: null, user: null });
      },
    }),
    { name: "gk-auth" },
  ),
);
