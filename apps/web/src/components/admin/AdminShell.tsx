"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAdminToken, getAdminToken } from "@/lib/admin-token";
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

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  // The login page is part of /admin but renders full-bleed without the
  // sidebar / dashboard chrome. Bypass auth and chrome entirely.
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (isLogin) return;
    void Promise.resolve().then(() => {
      const t = getAdminToken();
      if (!t) {
        router.replace("/admin/login");
        return;
      }
      setReady(true);
    });
  }, [isLogin, router]);

  if (isLogin) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-fg-muted">
        Loading admin…
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[220px_1fr]">
      <aside className="hidden flex-col border-r border-line bg-bg-soft lg:flex">
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
                  "rounded-lg px-4 py-2 text-sm transition-colors",
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
        <div className="mt-auto p-4 text-xs text-fg-muted">
          <button
            type="button"
            onClick={() => {
              clearAdminToken();
              router.replace("/admin/login");
            }}
            className="underline underline-offset-4"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="p-6 lg:p-10">{children}</div>
    </div>
  );
}
