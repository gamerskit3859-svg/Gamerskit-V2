"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const SHOP_LINKS = [
  { href: "/shop/rc-car", label: "RC cars" },
  { href: "/shop/f1-jersey", label: "F1 jerseys" },
  { href: "/shop/esports", label: "E-sports" },
  { href: "/shop/tshirt", label: "T-shirts" },
];

const HELP_LINKS = [
  { href: "/track", label: "Track order" },
  { href: "/policies/shipping", label: "Shipping" },
  { href: "/policies/returns", label: "Returns" },
  { href: "/contact", label: "Contact" },
];

interface FooterColumnProps {
  title: string;
  children: React.ReactNode;
}

function FooterColumn({ title, children }: FooterColumnProps) {
  return (
    <div>
      <h3 className="text-foreground font-medium mb-3 text-sm">{title}</h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

export function Footer() {
  const pathname = usePathname();
  // Admin has its own layout — don't render the storefront footer on /admin/*
  if (pathname?.startsWith("/admin")) return null;

  return (
    <footer className="border-t border-line bg-bg-soft mt-24">
      <div className="mx-auto max-w-[1280px] px-5 lg:px-8 py-14 grid gap-10 md:grid-cols-4 text-[13px] text-fg-soft">
        <div>
          <div className="flex items-center gap-2 text-foreground font-semibold text-[15px] tracking-tight">
            <Image
              src="/brand/logo.png"
              alt=""
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
            GamersKit
          </div>
          <p className="mt-2 leading-relaxed">
            Bangladesh&apos;s gaming gear store. RC drift cars, F1 jerseys,
            e-sports apparel.
          </p>
        </div>

        <FooterColumn title="Shop">
          {SHOP_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="hover:text-foreground transition-colors">
                {link.label}
              </Link>
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title="Help">
          {HELP_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="hover:text-foreground transition-colors">
                {link.label}
              </Link>
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title="Contact">
          <li>WhatsApp: 01303-775977</li>
          <li>Dhaka, Bangladesh</li>
        </FooterColumn>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto max-w-[1280px] px-5 lg:px-8 py-6 text-xs text-fg-muted flex justify-between">
          <span>© {new Date().getFullYear()} GamersKit. All rights reserved.</span>
          <span>Made in Bangladesh.</span>
        </div>
      </div>
    </footer>
  );
}
