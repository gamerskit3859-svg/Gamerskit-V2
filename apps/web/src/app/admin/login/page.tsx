"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setAdminToken } from "@/lib/admin-token";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await api.login(email, password);
      if (r.user.role !== "admin" && r.user.role !== "staff") {
        throw new Error("not an admin account");
      }
      setAdminToken(r.token);
      router.replace("/admin");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="px-5 max-w-md mx-auto py-24">
      <span className="eyebrow">Admin</span>
      <h1 className="display-2 mt-2 mb-8">Sign in.</h1>
      <form onSubmit={submit} className="grid gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--fg-soft)]">Email</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--fg-soft)]">Password</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button className="btn btn-primary mt-2" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-xs text-[var(--fg-muted)] mt-2">
          Default admin: <code>admin@gamerskit.local</code> / <code>admin123</code>
          {" — change in your .env."}
        </p>
      </form>
    </section>
  );
}
