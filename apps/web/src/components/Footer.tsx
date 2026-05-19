"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Facebook, Instagram } from "lucide-react";

// Matches Lucide's 2px stroke rules perfectly
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

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

const SOCIAL_LINKS = [
  {
    href: "https://www.facebook.com/gamerskit.gg",
    label: "Facebook",
    icon: Facebook,
  },
  {
    href: "https://instagram.com/gamerskit.gg",
    label: "Instagram",
    icon: Instagram,
  },
  {
    href: "https://www.tiktok.com/@gamers_kit",
    label: "TikTok",
    icon: TikTokIcon,
  },
];

const SOFTAURA_URL = "https://softaura.dev/";

interface FooterColumnProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

function FooterColumn({ title, children, className }: FooterColumnProps) {
  return (
    <div className={className}>
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <footer className="mt-12 border-t border-line bg-bg-soft md:mt-16">
      <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-x-6 gap-y-8 px-5 py-10 text-[13px] text-fg-soft sm:gap-8 lg:grid-cols-[1.35fr_0.8fr_0.8fr_1fr] lg:px-8 lg:py-12">
        {/* Brand Segment */}
        <div className="col-span-2 max-w-sm lg:col-span-1">
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
            Bangladesh&apos;s No #1 RC drift cars, Gadgets and Enthusiastic product
            store
          </p>

          {/* Social Icons Container */}
          <div className="mt-5 flex items-center gap-4">
            {SOCIAL_LINKS.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.label}
                  className="text-fg-soft transition-colors hover:text-foreground">
                  <Icon className="h-5 w-5" />
                </a>
              );
            })}
          </div>
        </div>

        {/* Shop Links */}
        <FooterColumn title="Shop" className="min-w-0">
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

        {/* Help Links */}
        <FooterColumn title="Help" className="min-w-0">
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

        {/* Contact Column */}
        <FooterColumn
          title="Contact"
          className="col-span-2 min-w-0 lg:col-span-1">
          <li>
            <a
              href="tel:01537428371"
              className="inline-flex text-fg-soft transition-colors hover:text-foreground">
              Contact us: 01537-428371, 01818136701
            </a>
          </li>
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

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-5 py-6 text-xs text-fg-muted sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span className="text-center sm:text-left">
            &copy; {new Date().getFullYear()} GamersKit. All rights reserved.
          </span>
          <div className="text-center sm:text-right">
            Designed &amp; Developed by{" "}
            <a
              href={SOFTAURA_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-block font-semibold text-foreground underline-offset-4 transition duration-200 hover:-translate-y-0.5 hover:text-accent hover:underline">
              SoftAura
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
