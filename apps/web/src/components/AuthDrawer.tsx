"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, EyeOff } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { setAdminToken } from "@/lib/admin-token";

interface AuthDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "login" | "register";
  nextParam?: string | null;
}

export function AuthDrawer({ isOpen, onClose, initialTab = "login", nextParam }: AuthDrawerProps) {
  const router = useRouter();

  const setSession = useAuth((s) => s.setSession);

  const [activeTab, setActiveTab] = useState<"login" | "register">(initialTab);
  const [showPassword, setShowPassword] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form state
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      // Reset forms when opening
      setLoginEmail("");
      setLoginPassword("");
      setLoginError(null);
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPhone("");
      setRegisterPassword("");
      setRegisterError(null);
    }
  }, [isOpen, initialTab]);

  function redirectByRole(token: string, user: any) {
    setSession({ token, user });

    if (user.role === "admin" || user.role === "staff") {
      setAdminToken(token);
      router.replace(nextParam ?? "/admin");
    } else {
      router.replace(nextParam ?? "/account");
    }
    onClose();
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const r = await api.login(loginEmail, loginPassword);
      redirectByRole(r.token, r.user);
    } catch (err) {
      const status = (err as { status?: number }).status;
      setLoginError(
        status === 401
          ? "Email or password is incorrect."
          : "Sign-in failed. Please try again."
      );
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRegisterLoading(true);
    setRegisterError(null);

    try {
      const r = await api.register({
        email: registerEmail,
        password: registerPassword,
        name: registerName,
        phone: registerPhone
      });
      setSession({ token: r.token, user: r.user });
      router.replace(nextParam ?? "/account");
      onClose();
    } catch (err) {
      const status = (err as { status?: number }).status;
      setRegisterError(
        status === 409
          ? "An account with that email already exists."
          : "Sign-up failed. Please try again."
      );
    } finally {
      setRegisterLoading(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse: any) {
    const loading = activeTab === "login" ? setLoginLoading : setRegisterLoading;
    const setError = activeTab === "login" ? setLoginError : setRegisterError;

    loading(true);
    setError(null);

    try {
      const token = credentialResponse.credential;
      const payload = JSON.parse(atob(token.split(".")[1]));

      const r = await api.loginGoogle({
        email: payload.email,
        name: payload.name,
        avatar: payload.picture,
        providerId: payload.sub,
      });

      redirectByRole(r.token, r.user);
    } catch {
      setError("Google sign-in failed. Please try again.");
    } finally {
      loading(false);
    }
  }

  function handleFacebookLogin() {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;

    if (!appId) {
      const setError = activeTab === "login" ? setLoginError : setRegisterError;
      setError("Facebook App ID is missing.");
      return;
    }

    window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${window.location.origin}/api/auth/facebook/callback&scope=email,public_profile`;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300,
              duration: 0.4
            }}
            className="fixed left-1/2 right-0 top-0  z-999 h-full bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900">
                {activeTab === "login" ? "Sign in" : "Create account"}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Tab Switcher */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab("login")}
                className={`flex-1 py-4 text-center font-medium transition-colors ${
                  activeTab === "login"
                    ? "text-gray-900 border-b-2 border-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Sign in
              </button>
              <button
                onClick={() => setActiveTab("register")}
                className={`flex-1 py-4 text-center font-medium transition-colors ${
                  activeTab === "register"
                    ? "text-gray-900 border-b-2 border-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Create account
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "login" ? (
                <div className="space-y-6">
                  {/* Error */}
                  {loginError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {loginError}
                    </div>
                  )}

                  {/* OAuth Buttons */}
                  <div className="space-y-3">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => setLoginError("Google login failed.")}
                      width="100%"
                      theme="outline"
                      size="large"
                      text="continue_with"
                    />

                    <button
                      type="button"
                      onClick={handleFacebookLogin}
                      disabled={loginLoading}
                      className="flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                        <path
                          fill="#1877F2"
                          d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                        />
                      </svg>
                      Continue with Facebook
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
                      or
                    </span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>

                  {/* Login Form */}
                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-2">
                        Email address
                      </label>
                      <input
                        id="login-email"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-4 focus:ring-gray-100"
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        autoComplete="email"
                        placeholder="you@example.com"
                      />
                    </div>

                    <div>
                      <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="login-password"
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-10 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-4 focus:ring-gray-100"
                          type={showPassword ? "text" : "password"}
                          required
                          minLength={6}
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          autoComplete="current-password"
                          placeholder="Enter your password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loginLoading ? "Signing in..." : "Sign in"}
                    </button>
                  </form>

                  {/* Demo credentials */}
                  <div className="rounded-xl bg-gray-50 px-4 py-3 text-center text-xs text-gray-500">
                    Demo admin:{" "}
                    <code className="font-medium text-gray-700">
                      admin@gamerskit.local
                    </code>{" "}
                    /{" "}
                    <code className="font-medium text-gray-700">admin123</code>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Error */}
                  {registerError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {registerError}
                    </div>
                  )}

                  {/* OAuth Buttons */}
                  <div className="space-y-3">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => setRegisterError("Google login failed.")}
                      width="100%"
                      theme="outline"
                      size="large"
                      text="continue_with"
                    />

                    <button
                      type="button"
                      onClick={handleFacebookLogin}
                      disabled={registerLoading}
                      className="flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                        <path
                          fill="#1877F2"
                          d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                        />
                      </svg>
                      Continue with Facebook
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
                      or
                    </span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>

                  {/* Register Form */}
                  <form onSubmit={handleRegisterSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="register-name" className="block text-sm font-medium text-gray-700 mb-2">
                        Full name
                      </label>
                      <input
                        id="register-name"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-4 focus:ring-gray-100"
                        type="text"
                        required
                        value={registerName}
                        onChange={(e) => setRegisterName(e.target.value)}
                        autoComplete="name"
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label htmlFor="register-phone" className="block text-sm font-medium text-gray-700 mb-2">
                        Phone
                      </label>
                      <input
                        id="register-phone"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-4 focus:ring-gray-100"
                        type="tel"
                        value={registerPhone}
                        onChange={(e) => setRegisterPhone(e.target.value)}
                        autoComplete="tel"
                        placeholder="+880 1234 567890"
                      />
                    </div>

                    <div>
                      <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 mb-2">
                        Email address
                      </label>
                      <input
                        id="register-email"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-4 focus:ring-gray-100"
                        type="email"
                        required
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        autoComplete="email"
                        placeholder="you@example.com"
                      />
                    </div>

                    <div>
                      <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="register-password"
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-10 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-4 focus:ring-gray-100"
                          type={showPassword ? "text" : "password"}
                          required
                          minLength={6}
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          autoComplete="new-password"
                          placeholder="••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={registerLoading}
                      className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {registerLoading ? "Creating account..." : "Create account"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}