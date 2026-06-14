import type { Metadata } from "next";

export const SITE_NAME = "GK Shop";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "https://gamerskitbd.com";
export const DEFAULT_DESCRIPTION =
  "Shop RC drift cars, F1 jerseys, e-sports apparel, gaming gear, and accessories in Bangladesh with cash on delivery and fast delivery.";
export const DEFAULT_KEYWORDS = [
  "GK Shop",
  "gaming store Bangladesh",
  "RC car Bangladesh",
  "F1 jersey Bangladesh",
  "esports jersey",
  "gaming accessories",
  "cash on delivery Bangladesh",
];

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function truncateDescription(value?: string, fallback = DEFAULT_DESCRIPTION) {
  const text = (value || fallback).replace(/\s+/g, " ").trim();
  if (text.length <= 155) return text;
  return `${text.slice(0, 152).trimEnd()}...`;
}

export function createMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  keywords = [],
  image = "/brand/logo.png",
  type = "website",
  noIndex = false,
}: {
  title: string;
  description?: string;
  path?: string;
  keywords?: string[];
  image?: string;
  type?: "website" | "article";
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  const imageUrl = absoluteUrl(image);
  const cleanDescription = truncateDescription(description);

  return {
    title,
    description: cleanDescription,
    keywords: [...DEFAULT_KEYWORDS, ...keywords],
    alternates: {
      canonical: url,
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
        },
    openGraph: {
      title,
      description: cleanDescription,
      url,
      siteName: SITE_NAME,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: "en_BD",
      type,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: cleanDescription,
      images: [imageUrl],
    },
  };
}
