"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const SHOP_LINKS = [
  { href: "/shop?category=rc-car", label: "RC cars" },
  { href: "/shop?category=f1-jersey", label: "F1 jerseys" },
  { href: "/shop?category=esports", label: "E-sports" },
  { href: "/shop?category=tshirt", label: "T-shirts" },
];

const HELP_LINKS = [
  { href: "/track", label: "Track order" },
  { href: "/shop", label: "Browse products" },
  { href: "/cart", label: "Cart" },
  {
    href: "https://wa.me/8801303775977",
    label: "WhatsApp support",
    external: true,
  },
];

const SOFTAURA_URL = "https://softaura.dev/";

interface FooterColumnProps {
  title: string;
  children: React.ReactNode;
}

function FooterColumn({ title, children }: FooterColumnProps) {
  return (
    <div className="min-w-0">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

export function Footer() {
  const pathname = usePathname();
  // Admin has its own layout. Do not render the storefront footer on /admin/*.
  if (pathname?.startsWith("/admin")) return null;

  return (
    <footer className="mt-24 border-t border-line bg-bg-soft">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-12 text-[13px] text-fg-soft sm:grid-cols-2 lg:grid-cols-[1.35fr_0.8fr_0.8fr_1fr] lg:px-8 lg:py-14">
        <div className="max-w-sm">
          <div className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground">
            <Image
              src="/brand/logo.png"
              alt=""
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
            GamersKit
          </div>
          <p className="mt-3 max-w-[32ch] leading-relaxed">
            Bangladesh&apos;s gaming gear store. RC drift cars, F1 jerseys,
            e-sports apparel.
          </p>
        </div>

        <FooterColumn title="Shop">
          {SHOP_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-flex text-fg-soft transition-colors hover:text-foreground">
                {link.label}
              </Link>
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title="Help">
          {HELP_LINKS.map((link) => (
            <li key={link.href}>
              {link.external ? (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-fg-soft transition-colors hover:text-foreground">
                  {link.label}
                </a>
              ) : (
                <Link
                  href={link.href}
                  className="inline-flex text-fg-soft transition-colors hover:text-foreground">
                  {link.label}
                </Link>
              )}
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title="Contact">
          <li>
            <a
              href="https://wa.me/8801303775977"
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-fg-soft transition-colors hover:text-foreground">
              WhatsApp: 01303-775977
            </a>
          </li>
          <li>Dhaka, Bangladesh</li>
        </FooterColumn>
      </div>

      <div className="border-t border-line ">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-5 py-6 text-xs text-fg-muted sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span>
            &copy; {new Date().getFullYear()} GamersKit. All rights reserved.
          </span>
          <div className="max-w-[1280px] text-center text-xs text-fg-muted">
            Designed &amp; Developed by{" "}
            <a
              href={SOFTAURA_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex font-semibold text-foreground underline-offset-4 transition duration-200 hover:-translate-y-0.5 hover:text-accent hover:underline">
              SoftAura
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
