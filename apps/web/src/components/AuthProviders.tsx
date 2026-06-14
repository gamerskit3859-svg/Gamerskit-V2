"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import type { ReactNode } from "react";

export function AuthProviders({ children }: { children: ReactNode }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (process.env.NODE_ENV !== "production" && !googleClientId) {
    console.warn("[auth] NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured.");
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId || ""}>
      {children}
    </GoogleOAuthProvider>
  );
}
