"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { api } from "@/lib/api";
import {
  clearAdminToken,
  setAdminToken,
} from "@/lib/admin-token";
import { useAuth } from "@/lib/auth";
import { COOKIE_SESSION } from "@/lib/auth";
import { cn } from "@/lib/cn";
import type { UserRole } from "@/types/shared";

const NAV = [
  { href: "/admin", label: "Dashboard", roles: ["admin"] },
  { href: "/admin/orders", label: "Orders", roles: ["admin", "staff"] },
  { href: "/admin/orders/new", label: "New custom order", roles: ["admin", "staff"] },
  { href: "/admin/products", label: "Products", roles: ["admin", "staff"] },
  { href: "/admin/hero", label: "Hero Section", roles: ["admin", "staff"] },
  { href: "/admin/categories", label: "Categories", roles: ["admin", "staff"] },
  { href: "/admin/inventory", label: "Inventory", roles: ["admin", "staff"] },
  { href: "/admin/customers", label: "Customers", roles: ["admin", "staff"] },
  { href: "/admin/coupons", label: "Coupons", roles: ["admin", "staff"] },
  { href: "/admin/reports", label: "Accounting", roles: ["admin", "staff"] },
  { href: "/admin/users", label: "Users & Roles", roles: ["admin"] },
  { href: "/admin/staff", label: "Staff", roles: ["admin"] },
  { href: "/admin/notifications", label: "Notifications", roles: ["admin", "staff"] },
];

function isStaffAllowedPath(pathname: string) {
  if (pathname === "/admin") return false;
  if (pathname === "/admin/accounts" || pathname.startsWith("/admin/accounts/")) {
    return false;
  }
  if (pathname === "/admin/users" || pathname.startsWith("/admin/users/")) {
    return false;
  }
  if (pathname === "/admin/staff" || pathname.startsWith("/admin/staff/")) {
    return false;
  }
  return pathname.startsWith("/admin/");
}

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/orders") {
    return (
      pathname === "/admin/orders" ||
      (pathname.startsWith("/admin/orders/") && pathname !== "/admin/orders/new")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const clearAuth = useAuth((s) => s.clear);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [checking, setChecking] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const clearAdminSession = useCallback(() => {
    clearAdminToken();
    clearAuth();
  }, [clearAuth]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setChecking(true);
      setUnauthorized(false);

      try {
        const { user } = await api.me();
        if (cancelled) return;

        if (user.role !== "admin" && user.role !== "staff") {
          clearAdminSession();
          setToken(null);
          setRole(null);
          setUnauthorized(true);
          setChecking(false);
          router.replace("/");
          return;
        }

        setAdminToken();
        setSession({ token: COOKIE_SESSION, user });
        setToken(COOKIE_SESSION);
        setRole(user.role);

      } catch {
        if (!cancelled) {
          clearAdminSession();
          setToken(null);
          setRole(null);
        }
        router.replace(`/?auth=login&next=${encodeURIComponent("/admin")}`);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearAdminSession, router, setSession]);

  useEffect(() => {
    if (role === "staff" && !isStaffAllowedPath(pathname)) {
      router.replace("/admin/orders");
    }
  }, [pathname, role, router]);

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

  if (unauthorized) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-fg-muted">
        Redirecting...
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-fg-muted">
        Opening sign in...
      </div>
    );
  }

  const nav = (
    <nav className="flex min-h-0 flex-col gap-1 px-2">
      {NAV.filter((n) => !role || n.roles.includes(role)).map((n) => {
        const active = isActivePath(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "rounded-lg px-4 py-2.5 text-sm transition-colors",
              active
                ? "bg-black text-white"
                : "text-fg-soft hover:bg-white hover:text-foreground",
            )}>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  const signOut = () => {
    setLoggingOut(true);
    void api.logout().catch(() => null);
    clearAdminSession();
    setToken(null);
    setDrawerOpen(false);
    router.replace("/?auth=login");
  };

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-background lg:flex">
      <aside className="hidden h-screen w-[260px] shrink-0 flex-col border-r border-line bg-white lg:sticky lg:top-0 lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-line px-5">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 font-semibold tracking-tight">
            <Image
              src="/brand/logo.png"
              alt=""
              width={26}
              height={26}
              className="h-[26px] w-[26px] object-contain"
            />
            <span className="truncate">
              GK Shop
              <span className="font-normal text-fg-muted"> · Admin</span>
            </span>
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-4">{nav}</div>
        <div className="shrink-0 border-t border-line p-4 text-xs text-fg-muted">
          <button
            type="button"
            onClick={signOut}
            disabled={loggingOut}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition hover:border-red-200 hover:bg-red-50 disabled:cursor-wait disabled:opacity-70">
            <LogOut size={15} />
            {loggingOut ? "Signing out..." : "Logout"}
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur lg:hidden">
        <Link
          href="/admin"
          className="flex min-w-0 items-center gap-2 font-semibold">
          <Image
            src="/brand/logo.png"
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 object-contain"
          />
          <span className="truncate">GK Shop Admin</span>
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-bg-soft"
          aria-label="Open admin navigation">
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
          <aside className="relative flex h-full min-h-0 w-[min(84vw,320px)] flex-col bg-bg-soft shadow-2xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
              <Link
                href="/"
                className="flex items-center gap-2 font-semibold">
                <Image
                  src="/brand/logo.png"
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 object-contain"
                />
                <span>GK Shop Admin</span>
              </Link>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white"
                aria-label="Close admin navigation">
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-3">{nav}</div>
            <div className="shrink-0 border-t border-line p-4">
              <button
                type="button"
                onClick={signOut}
                disabled={loggingOut}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-3 text-sm font-medium text-red-600 transition hover:border-red-200 hover:bg-red-50 disabled:cursor-wait disabled:opacity-70">
                <LogOut size={16} />
                {loggingOut ? "Signing out..." : "Logout"}
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="w-full min-w-0 max-w-full flex-1 overflow-x-clip px-4 py-5 sm:px-6 lg:px-10 lg:py-8 xl:px-12">
        <div className="mx-auto w-full min-w-0 max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}
