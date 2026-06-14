"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { setAdminToken } from "@/lib/admin-token";
import { track } from "@/lib/fb-pixel";

type GoogleProfile = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
};

export default function GoogleCallbackPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [message, setMessage] = useState("Finishing Google sign-in...");

  useEffect(() => {
    let cancelled = false;

    async function finishGoogleSignIn() {
      try {
        const params = new URLSearchParams(
          window.location.hash
            ? window.location.hash.slice(1)
            : window.location.search.slice(1),
        );
        const error = params.get("error");
        if (error) {
          throw new Error(params.get("error_description") || error);
        }

        const state = params.get("state");
        const expectedState = sessionStorage.getItem("gk_google_oauth_state");
        if (!state || !expectedState || state !== expectedState) {
          throw new Error("Google sign-in state could not be verified.");
        }

        const accessToken = params.get("access_token");
        if (!accessToken) {
          throw new Error("Google did not return an access token.");
        }

        const profileResponse = await fetch(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        if (!profileResponse.ok) {
          throw new Error("Could not load Google profile.");
        }

        const profile = (await profileResponse.json()) as GoogleProfile;
        if (!profile.email || !profile.sub) {
          throw new Error("Google did not return a verified profile.");
        }

        const result = await api.loginGoogle({
          email: profile.email,
          name: profile.name || profile.email,
          avatar: profile.picture,
          providerId: profile.sub,
        });

        const mode = sessionStorage.getItem("gk_google_mode");
        track({
          event: mode === "register" ? "CompleteRegistration" : "Lead",
          contentName: `Google ${mode === "register" ? "Registration" : "Login"}`,
          user: {
            email: profile.email,
            firstName: profile.given_name,
            lastName: profile.family_name,
          },
        });

        sessionStorage.removeItem("gk_google_oauth_state");
        const next = sessionStorage.getItem("gk_google_next");
        sessionStorage.removeItem("gk_google_next");
        sessionStorage.removeItem("gk_google_mode");

        if (cancelled) return;

        setSession({ token: result.token, user: result.user });
        if (result.user.role === "admin" || result.user.role === "staff") {
          setAdminToken();
          router.replace(next || "/admin");
        } else {
          router.replace(next === "/admin" ? "/account" : next || "/account");
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[auth] Google redirect sign-in failed", err);
        }
        if (!cancelled) {
          setMessage(
            "Google sign-in failed. Make sure /auth/google/callback is added as an authorized redirect URI in Google Cloud.",
          );
          window.setTimeout(() => router.replace("/?auth=login"), 2500);
        }
      }
    }

    void finishGoogleSignIn();
    return () => {
      cancelled = true;
    };
  }, [router, setSession]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 text-center text-sm text-fg-muted">
      {message}
    </main>
  );
}
