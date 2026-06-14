"use client";
import { AUTH_TOKEN_STORAGE_KEY, COOKIE_SESSION } from "@/lib/auth";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? COOKIE_SESSION;
}

export function setAdminToken() {
  // Auth is stored in a secure HTTP-only cookie by the API.
}

export function clearAdminToken() {
  // Auth is cleared through /api/auth/logout.
}
