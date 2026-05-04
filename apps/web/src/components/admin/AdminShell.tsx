"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAdminToken, getAdminToken } from "@/lib/admin-token";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/orders/new", label: "New custom order" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/reports", label: "Accounting" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/notifications", label: "Notifications" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  // The login page is part of /admin but should render full-bleed without the
  // sidebar / dashboard chrome. Bypass the auth gate and the chrome entirely.
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
    return <div className="min-h-screen bg-[var(--bg)]">{children}</div>;
  }

  if (!ready) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-[var(--fg-muted)] text-sm">
        Loading admin…
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[220px_1fr] min-h-screen">
      <aside className="hairline-r bg-[var(--bg-soft)] hidden lg:flex flex-col">
        <div className="p-6">
          <Link href="/admin" className="flex items-center gap-2 font-semibold tracking-tight">
            <Image
              src="/brand/logo.png"
              alt=""
              width={26}
              height={26}
              className="h-[26px] w-[26px] object-contain"
            />
            <span>
              GamersKit
              <span className="text-[var(--fg-muted)] font-normal"> · Admin</span>
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
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-black text-white"
                    : "text-[var(--fg-soft)] hover:bg-white hover:text-[var(--fg)]"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-4 text-xs text-[var(--fg-muted)]">
          <button
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
