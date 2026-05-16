"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { api } from "@/lib/api";
import {
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from "@/lib/admin-token";
import { Button, Card, Input, Section } from "@/components/ui";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/orders/new", label: "New custom order" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/hero", label: "Hero Section" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/reports", label: "Accounting" },
  { href: "/admin/users", label: "Users & Roles" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/notifications", label: "Notifications" },
];

const DEFAULT_ADMIN_EMAIL = "admin@gamerskit.local";
const DEFAULT_ADMIN_PASSWORD = "admin123";

function AdminLoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [password, setPassword] = useState(DEFAULT_ADMIN_PASSWORD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { token } = await api.login(email, password);
      setAdminToken(token);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section width="narrow" spacing="lg" className="!max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold">Admin Login</h1>
        <p className="text-sm text-fg-muted mt-2">
          Sign in to access the admin dashboard.
        </p>
      </div>

      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-fg-soft uppercase tracking-[0.18em] mb-2 block">
              Email
            </span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-fg-soft uppercase tracking-[0.18em] mb-2 block">
              Password
            </span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-1"
            />
          </label>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-line">
          <div className="text-xs text-fg-muted space-y-1">
            <div>
              <strong>Default credentials:</strong>
            </div>
            <div>Email: {DEFAULT_ADMIN_EMAIL}</div>
            <div>Password: {DEFAULT_ADMIN_PASSWORD}</div>
          </div>
        </div>
      </Card>
    </Section>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(() => {
      const t = getAdminToken();
      setToken(t);
      setChecking(false);
    });
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => setDrawerOpen(false));
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  if (checking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-fg-muted">
        Loading admin…
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-background">
        <AdminLoginForm onSuccess={() => setToken(getAdminToken())} />
      </div>
    );
  }

  const nav = (
    <nav className="flex flex-col gap-1 px-2">
      {NAV.map((n) => {
        const active =
          n.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "rounded-lg px-4 py-2.5 text-sm transition-colors",
              active
                ? "bg-black text-white"
                : "text-fg-soft hover:bg-white hover:text-foreground",
            )}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  const signOut = () => {
    clearAdminToken();
    setToken(null);
    setDrawerOpen(false);
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden min-h-screen flex-col border-r border-line bg-bg-soft lg:flex">
        <div className="p-6">
          <Link
            href="/admin"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <Image
              src="/brand/logo.png"
              alt=""
              width={26}
              height={26}
              className="h-[26px] w-[26px] object-contain"
            />
            <span>
              GamersKit
              <span className="font-normal text-fg-muted"> · Admin</span>
            </span>
          </Link>
        </div>
        {nav}
        <div className="mt-auto p-4 text-xs text-fg-muted">
          <button
            type="button"
            onClick={signOut}
            className="underline underline-offset-4"
          >
            Sign out
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur lg:hidden">
        <Link href="/admin" className="flex min-w-0 items-center gap-2 font-semibold">
          <Image
            src="/brand/logo.png"
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 object-contain"
          />
          <span className="truncate">GamersKit Admin</span>
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-bg-soft"
          aria-label="Open admin navigation"
        >
          <Menu size={18} />
        </button>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-[1000] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close admin navigation"
          />
          <aside className="relative flex h-full w-[min(84vw,320px)] flex-col bg-bg-soft shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Link href="/admin" className="flex items-center gap-2 font-semibold">
                <Image
                  src="/brand/logo.png"
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 object-contain"
                />
                <span>GamersKit Admin</span>
              </Link>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white"
                aria-label="Close admin navigation"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3">{nav}</div>
            <div className="border-t border-line p-4">
              <button
                type="button"
                onClick={signOut}
                className="text-sm text-red-600 underline underline-offset-4"
              >
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="min-w-0 overflow-hidden px-4 py-5 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-[1440px] min-w-0">{children}</div>
      </main>
    </div>
  );
}
