"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { optimizeCloudinaryImage } from "@/lib/images";
import { Section } from "@/components/ui";
import { SectionHeader } from "./SectionHeader";

interface Category {
  _id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  featured?: boolean;
  order?: number;
  parentId?: string | null;
}

interface Tile {
  slug: string;
  label: string;
  blurb: string;
  image: string;
  featured: boolean;
}

const FALLBACK_TILES: Tile[] = [
  {
    slug: "new-arrivals",
    label: "New Arrivals",
    blurb: "Fresh Gear",
    image: "/placeholder.jpg",
    featured: true,
  },
  {
    slug: "best-sellers",
    label: "Best Sellers",
    blurb: "Community Favorites",
    image: "/placeholder.jpg",
    featured: false,
  },
];

const PLACEHOLDER_IMAGE = "/placeholder.jpg";

function categoryToTile(c: Category): Tile {
  return {
    slug: c.slug,
    label: c.name,
    blurb: c.description,
    image: c.image && c.image.trim() ? c.image : PLACEHOLDER_IMAGE,
    featured: c.featured ?? false,
  };
}

function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return 0;
  });
}

function TileSkeleton() {
  return (
    <div
      className="aspect-[16/10] animate-pulse rounded-[var(--radius-xl)] bg-gray-100"
      aria-hidden
    />
  );
}

function CategoryTile({ tile, index }: { tile: Tile; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{
        duration: 0.7,
        delay: index * 0.06,
        ease: [0.16, 1, 0.3, 1],
      }}>
      <Link
        href={`/shop?category=${tile.slug}`}
        className="group relative block aspect-[16/10] overflow-hidden rounded-[var(--radius-xl)] bg-black">
        {tile.featured && (
          <div className="absolute left-3 top-3 z-10 rounded-full bg-yellow-400 px-2 py-1 text-xs font-bold text-black">
            🌟 Featured
          </div>
        )}

        {tile.image && (
          <Image
            src={optimizeCloudinaryImage(
              tile.image,
              "f_auto,q_auto,c_fill,w_900",
            )}
            alt={tile.label}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-end p-6 text-white lg:p-8">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">
            {tile.blurb}
          </span>
          <h3 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
            {tile.label}
          </h3>
          <span className="mt-3 text-sm underline underline-offset-4 opacity-80 group-hover:opacity-100">
            Shop now
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

export function CategoryTiles({
  initialCategories = [],
}: {
  initialCategories?: Category[];
}) {
  const initialTiles = sortTiles(
    initialCategories
      .filter((c) => !c.parentId && c.featured)
      .map(categoryToTile),
  );
  const [tiles, setTiles] = useState<Tile[]>(initialTiles);
  const [loading, setLoading] = useState(initialCategories.length === 0);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (initialCategories.length > 0) return;

    let cancelled = false;

    async function loadCategories() {
      try {
        const result = await api.listCategoriesFresh();
        if (cancelled) return;
        const featured = (result.items as Category[]).filter(
          (c) => !c.parentId && c.featured,
        );
        const mapped = featured.map(categoryToTile);
        setTiles(sortTiles(mapped));
      } catch (err) {
        if (cancelled) return;
        console.error("[CategoryTiles] Failed to load categories:", err);
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCategories();
    return () => {
      cancelled = true;
    };
  }, [initialCategories.length]);

  const displayTiles = tiles.length > 0 ? tiles : FALLBACK_TILES;

  return (
    <Section spacing="md">
      <SectionHeader
        eyebrow="Curated"
        title="Category"
        linkHref="/shop"
        linkLabel="See everything"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <TileSkeleton key={i} />)
          : displayTiles.map((tile, i) => (
              <CategoryTile key={tile.slug} tile={tile} index={i} />
            ))}
      </div>

      {error && !loading && (
        <p className="mt-6 text-center text-sm text-gray-500">
          Showing default categories — couldn&apos;t reach the server.
        </p>
      )}
    </Section>
  );
}
