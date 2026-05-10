"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Section } from "@/components/ui";

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

function categoryToTile(c: Category): Tile {
  return {
    slug: c.slug,
    label: c.name,
    blurb: c.description,
    image: c.image,
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
      transition={{ duration: 0.7, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={`/shop?category=${tile.slug}`}
        className="group relative block aspect-[16/10] overflow-hidden rounded-[var(--radius-xl)] bg-black"
      >
        {tile.featured && (
          <div className="absolute left-3 top-3 z-10 rounded-full bg-yellow-400 px-2 py-1 text-xs font-bold text-black">
            🌟 Featured
          </div>
        )}

        {tile.image && (
          <Image
            src={tile.image}
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

export function CategoryTiles() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const result = await api.listCategories();
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
  }, []);

  const displayTiles = tiles.length > 0 ? tiles : FALLBACK_TILES;

  return (
    <Section spacing="md">
      <div className="mb-10 flex items-end justify-between">
        <div>
          <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
            Curated
          </span>
          <h2 className="mt-2 text-[clamp(36px,5vw,64px)] leading-[1.06] tracking-[-0.035em] font-semibold">
            Pick your category.
          </h2>
        </div>
        <Link
          href="/shop"
          className="hidden text-sm font-medium underline underline-offset-4 md:inline"
        >
          See everything →
        </Link>
      </div>

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
