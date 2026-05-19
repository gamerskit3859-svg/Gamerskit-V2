"use client";
import { COOKIE_SESSION } from "@/lib/auth";

export function getAdminToken(): string | null {
  return typeof window === "undefined" ? null : COOKIE_SESSION;
}

export function setAdminToken() {
  // Auth is stored in a secure HTTP-only cookie by the API.
}

export function clearAdminToken() {
  // Auth is cleared through /api/auth/logout.
}
