"use client";
import { create } from "zustand";
import type { AuthUser } from "@/types/shared";

export const COOKIE_SESSION = "cookie-session";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setSession: (s: { token: string; user: AuthUser }) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>()((set) => ({
  token: null,
  user: null,
  setSession: ({ token, user }) => set({ token, user }),
  clear: () => set({ token: null, user: null }),
}));
