"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Category {
  _id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  featured?: boolean;
  order?: number;
}

interface Tile {
  slug: string;
  label: string;
  blurb: string;
  image: string;
  featured: boolean;
}

// Define some fallback tiles to prevent the UI from being empty if the API fails
const FALLBACK_TILES: Tile[] = [
  { slug: "new-arrivals", label: "New Arrivals", blurb: "Fresh Gear", image: "/placeholder.jpg", featured: true },
  { slug: "best-sellers", label: "Best Sellers", blurb: "Community Favorites", image: "/placeholder.jpg", featured: false },
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
      className="aspect-[16/10] rounded-[var(--radius-xl)] bg-gray-100 animate-pulse"
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
      transition={{ duration: 0.7, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}>
      <Link
        href={`/shop?category=${tile.slug}`}
        className={`relative group block aspect-[16/10] overflow-hidden rounded-[var(--radius-xl)] bg-black`}>

        {tile.featured && (
          <div className="absolute top-3 left-3 z-10 bg-yellow-400 text-black px-2 py-1 rounded-full text-xs font-bold">
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

        <div className="absolute inset-0 flex flex-col justify-end p-6 lg:p-8 text-white">
          <span className="eyebrow text-white/70">{tile.blurb}</span>
          <h3 className="text-3xl md:text-4xl font-semibold tracking-tight mt-1">
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

        // Filter for top-level featured categories
        const featured = (result.items as Category[]).filter(
          (c: any) => !c.parentId && c.featured,
        );

        const mappedTiles = featured.map(categoryToTile);
        setTiles(sortTiles(mappedTiles));
      } catch (err) {
        if (cancelled) return;
        console.error("[CategoryTiles] Failed to load categories:", err);
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCategories();
    return () => { cancelled = true; };
  }, []);

  // FIXED: Corrected syntax and added fallback
  const displayTiles = tiles.length > 0 ? tiles : FALLBACK_TILES;

  return (
    <section className="px-5 lg:px-8 max-w-[1280px] mx-auto py-10 md:py-24">
      <div className="flex items-end justify-between mb-10">
        <div>
          <span className="eyebrow">Curated</span>
          <h2 className="display-2 mt-2">Pick your category.</h2>
        </div>
        <Link
          href="/shop"
          className="text-sm font-medium underline underline-offset-4 hidden md:inline">
          See everything →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    </section>
  );
}