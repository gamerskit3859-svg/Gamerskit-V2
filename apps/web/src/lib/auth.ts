"use client";
import { create } from "zustand";
import type { AuthUser } from "@/types/shared";

export const COOKIE_SESSION = "cookie-session";
export const AUTH_TOKEN_STORAGE_KEY = "gk_auth_token";

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

function writeStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setSession: (s: { token: string; user: AuthUser }) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>()((set) => ({
  token: readStoredToken(),
  user: null,
  setSession: ({ token, user }) => {
    if (token !== COOKIE_SESSION) writeStoredToken(token);
    set({ token, user });
  },
  clear: () => {
    clearStoredToken();
    set({ token: null, user: null });
  },
}));
