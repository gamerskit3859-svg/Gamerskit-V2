"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/account";
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await api.login(email, password);
      setSession({ token: r.token, user: r.user });
      router.replace(next);
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(status === 401 ? "Email or password is incorrect." : "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-md py-20 px-5"
    >
      <h1 className="text-4xl font-semibold tracking-tight text-center">Sign in.</h1>
      <p className="text-center text-[var(--fg-soft)] mt-2 text-sm">
        Track your orders, save your address, and check out faster.
      </p>
      <form onSubmit={submit} className="mt-10 card-soft p-6 space-y-4">
        <div>
          <label className="eyebrow">Email</label>
          <input
            className="input mt-1"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <label className="eyebrow">Password</label>
          <input
            className="input mt-1"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-sm text-[var(--fg-soft)]">
          Don&rsquo;t have an account?{" "}
          <Link href={`/account/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="underline">
            Create one
          </Link>
        </p>
      </form>
      <p className="text-center text-xs text-[var(--fg-muted)] mt-6">
        Store admin?{" "}
        <Link href="/admin/login" className="underline underline-offset-4 hover:text-[var(--fg)]">
          Sign in to the admin dashboard
        </Link>
      </p>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-[var(--fg-muted)]">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
