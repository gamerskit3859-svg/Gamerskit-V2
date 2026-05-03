"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function RegisterForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/account";
  const setSession = useAuth((s) => s.setSession);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await api.register({ email, password, name, phone });
      setSession({ token: r.token, user: r.user });
      router.replace(next);
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(status === 409 ? "An account with that email already exists." : "Sign-up failed. Please try again.");
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
      <h1 className="text-4xl font-semibold tracking-tight text-center">Create your account.</h1>
      <p className="text-center text-[var(--fg-soft)] mt-2 text-sm">
        It only takes a moment.
      </p>
      <form onSubmit={submit} className="mt-10 card-soft p-6 space-y-4">
        <div>
          <label className="eyebrow">Full name</label>
          <input
            className="input mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </div>
        <div>
          <label className="eyebrow">Phone</label>
          <input
            className="input mt-1"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
        </div>
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
            autoComplete="new-password"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </button>
        <p className="text-center text-sm text-[var(--fg-soft)]">
          Already have one?{" "}
          <Link href={`/account/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="underline">
            Sign in
          </Link>
        </p>
      </form>
    </motion.div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-[var(--fg-muted)]">Loading…</div>}>
      <RegisterForm />
    </Suspense>
  );
}
