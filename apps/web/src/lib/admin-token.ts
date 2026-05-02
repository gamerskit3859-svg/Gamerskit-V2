"use client";
const KEY = "gk-admin-token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setAdminToken(t: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, t);
}

export function clearAdminToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
