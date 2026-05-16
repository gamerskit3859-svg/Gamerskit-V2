"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, EyeOff } from "lucide-react";
import { useGoogleLogin } from "@react-oauth/google";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { setAdminToken } from "@/lib/admin-token";
import { track } from "@/lib/fb-pixel";
import type { AuthUser } from "@/types/shared";

interface AuthDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "login" | "register";
  nextParam?: string | null;
}

export function AuthDrawer({
  isOpen,
  onClose,
  initialTab = "login",
  nextParam,
}: AuthDrawerProps) {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);

  const [activeTab, setActiveTab] = useState<"login" | "register">(initialTab);
  const [showPassword, setShowPassword] = useState(false);

  // States
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  function redirectByRole(token: string, user: AuthUser) {
    setSession({ token, user });
    if (user.role === "admin") {
      setAdminToken(token);
      router.replace(nextParam ?? "/admin");
    } else {
      router.replace(nextParam === "/admin" ? "/account" : nextParam ?? "/account");
    }
    onClose();
  }

  // --- Social Login Handlers ---

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const setLoading = activeTab === "login" ? setLoginLoading : setRegisterLoading;
      const setError = activeTab === "login" ? setLoginError : setRegisterError;
      
      setLoading(true);
      setError(null);

      try {
        // Fetch user info using the access token
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const payload = await res.json();

        const r = await api.loginGoogle({
          email: payload.email,
          name: payload.name,
          avatar: payload.picture,
          providerId: payload.sub,
        });
        
        track({
          event: activeTab === "register" ? "CompleteRegistration" : "Lead",
          contentName: `Google ${activeTab === "register" ? "Registration" : "Login"}`,
          user: {
            email: payload.email,
            firstName: payload.given_name,
            lastName: payload.family_name,
          },
        });
        
        redirectByRole(r.token, r.user);
      } catch {
        setError("Google sign-in failed. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      const setError = activeTab === "login" ? setLoginError : setRegisterError;
      setError("Google login failed.");
    },
  });

  function handleFacebookLogin() {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    if (!appId) {
      const setError = activeTab === "login" ? setLoginError : setRegisterError;
      setError("Facebook App ID is missing."); return;
    }
    window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${window.location.origin}/api/auth/facebook/callback&scope=email,public_profile`;
  }

  // --- Form Handlers ---

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true); setLoginError(null);
    try {
      const r = await api.login(loginEmail, loginPassword);
      track({
        event: "Lead",
        contentName: "User Login",
        user: {
          email: loginEmail,
        },
      });
      redirectByRole(r.token, r.user);
    } catch (err) {
      const status = (err as { status?: number }).status;
      setLoginError(status === 401 ? "Email or password is incorrect." : "Sign-in failed. Please try again.");
    } finally { setLoginLoading(false); }
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRegisterLoading(true); setRegisterError(null);
    try {
      const r = await api.register({ email: registerEmail, password: registerPassword, name: registerName, phone: registerPhone });
      track({
        event: "CompleteRegistration",
        contentName: "User Registration",
        user: {
          email: registerEmail,
          firstName: registerName.split(" ")[0],
          lastName: registerName.split(" ").slice(1).join(" "),
          phone: registerPhone,
        },
      });
      setSession({ token: r.token, user: r.user });
      router.replace(nextParam ?? "/account");
      onClose();
    } catch (err) {
      const status = (err as { status?: number }).status;
      setRegisterError(status === 409 ? "An account with that email already exists." : "Sign-up failed. Please try again.");
    } finally { setRegisterLoading(false); }
  }

  const inputClass = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:bg-white focus:ring-4 focus:ring-gray-100";
  const labelClass = "block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5";
  const socialBtnClass = "flex items-center justify-center gap-2.5 w-full py-3 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ position: "fixed", inset: 0, zIndex: 998, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            style={{
              position: "fixed",
              top: 0, right: 0, bottom: 0,
              zIndex: 999,
              width: "min(100vw, 480px)",
              display: "flex",
              flexDirection: "column",
              background: "#fff",
              boxShadow: "-8px 0 60px rgba(0,0,0,0.14)",
            }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid #f0f0f0", flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#999", margin: 0 }}>GamersKit</p>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: "2px 0 0", letterSpacing: "-0.03em" }}>
                  {activeTab === "login" ? "Welcome back" : "Create account"}
                </h2>
              </div>
              <button onClick={onClose} aria-label="Close" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #e5e5e5", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={16} color="#555" />
              </button>
            </div>

            {/* Tab switcher */}
            <div style={{ display: "flex", borderBottom: "1px solid #f0f0f0", flexShrink: 0 }}>
              {(["login", "register"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: "14px 0", fontSize: 13, fontWeight: 600, background: "none", border: "none", cursor: "pointer",
                    color: activeTab === tab ? "#111" : "#999",
                    borderBottom: activeTab === tab ? "2px solid #111" : "2px solid transparent",
                    transition: "all 0.15s ease",
                  }}>
                  {tab === "login" ? "Sign in" : "Register"}
                </button>
              ))}
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "28px 24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                
                {/* Error Alert */}
                {(activeTab === "login" ? loginError : registerError) && (
                  <div style={{ borderRadius: 12, border: "1px solid #fecaca", background: "#fff5f5", padding: "12px 16px", fontSize: 13, color: "#dc2626" }}>
                    {activeTab === "login" ? loginError : registerError}
                  </div>
                )}

                {/* Custom OAuth Buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    type="button"
                    className={socialBtnClass}
                    onClick={() => handleGoogleLogin()}
                    disabled={loginLoading || registerLoading}
                  >
                    <svg style={{ width: 18, height: 18 }} viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" />
                    </svg>
                    Continue with Google
                  </button>

                  <button
                    type="button"
                    className={socialBtnClass}
                    onClick={handleFacebookLogin}
                    disabled={loginLoading || registerLoading}
                  >
                    <svg style={{ width: 18, height: 18 }} viewBox="0 0 24 24">
                      <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Continue with Facebook
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#bbb" }}>or</span>
                  <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
                </div>

                {activeTab === "login" ? (
                  <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <label htmlFor="login-email" className={labelClass}>Email address</label>
                      <input id="login-email" className={inputClass} type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
                    </div>
                    <div>
                      <label htmlFor="login-password" className={labelClass}>Password</label>
                      <div style={{ position: "relative" }}>
                        <input id="login-password" className={inputClass} style={{ paddingRight: 44 }} type={showPassword ? "text" : "password"} required minLength={6} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#aaa", display: "flex" }}>
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                    <button type="submit" disabled={loginLoading} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: loginLoading ? "#555" : "#111", color: "#fff", fontSize: 14, fontWeight: 600, cursor: loginLoading ? "not-allowed" : "pointer" }}>
                      {loginLoading ? "Signing in…" : "Sign in"}
                    </button>
                    <div style={{ borderRadius: 10, background: "#f7f7f7", padding: "12px 14px", fontSize: 12, color: "#888", textAlign: "center" }}>
                      Demo admin: <code style={{ color: "#444", fontWeight: 600 }}>admin@gamerskit.local</code> / <code style={{ color: "#444", fontWeight: 600 }}>admin123</code>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleRegisterSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <label htmlFor="register-name" className={labelClass}>Full name</label>
                      <input id="register-name" className={inputClass} type="text" required value={registerName} onChange={(e) => setRegisterName(e.target.value)} autoComplete="name" placeholder="John Doe" />
                    </div>
                    <div>
                      <label htmlFor="register-phone" className={labelClass}>Phone <span style={{ color: "#bbb", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
                      <input id="register-phone" className={inputClass} type="tel" value={registerPhone} onChange={(e) => setRegisterPhone(e.target.value)} autoComplete="tel" placeholder="+880 1234 567890" />
                    </div>
                    <div>
                      <label htmlFor="register-email" className={labelClass}>Email address</label>
                      <input id="register-email" className={inputClass} type="email" required value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
                    </div>
                    <div>
                      <label htmlFor="register-password" className={labelClass}>Password</label>
                      <div style={{ position: "relative" }}>
                        <input id="register-password" className={inputClass} style={{ paddingRight: 44 }} type={showPassword ? "text" : "password"} required minLength={6} value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} autoComplete="new-password" placeholder="Min. 6 characters" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#aaa", display: "flex" }}>
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                    <button type="submit" disabled={registerLoading} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: registerLoading ? "#555" : "#111", color: "#fff", fontSize: 14, fontWeight: 600, cursor: registerLoading ? "not-allowed" : "pointer" }}>
                      {registerLoading ? "Creating account…" : "Create account"}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid #f0f0f0", flexShrink: 0, textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 12, color: "#bbb" }}>
                {activeTab === "login" ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={() => setActiveTab(activeTab === "login" ? "register" : "login")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#111", fontWeight: 600, fontSize: 12, padding: 0 }}>
                  {activeTab === "login" ? "Register" : "Sign in"}
                </button>
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
