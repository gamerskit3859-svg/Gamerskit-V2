"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useInfiniteScroll, useDebouncedSearch } from "@/lib/hooks";
import { SearchInput } from "./SearchInput";
import { ProductCard } from "./ProductCard";
import type { Product } from "@gamerskit/shared";

interface ProductListingProps {
  category?: string;
  title?: string;
  subtitle?: string;
}

export function ProductListing({ category, title, subtitle }: ProductListingProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const { value: searchValue, setValue: setSearchValue, debouncedValue: searchQuery } = useDebouncedSearch("");

  // Reset pagination when search query changes
  useEffect(() => {
    setPage(1);
    setProducts([]);
    setHasMore(true);
  }, [searchQuery, category]);

  // Load products
  const loadProducts = useCallback(
    async (pageNum: number) => {
      try {
        const isFirstPage = pageNum === 1;
        if (isFirstPage) setLoading(true);
        else setLoadingMore(true);
        setError(null);

        const result = await api.listProducts({
          category,
          q: searchQuery || undefined,
          page: pageNum,
          limit: 20,
        });

        if (isFirstPage) {
          setProducts(result.items);
        } else {
          // Prevent duplicates by checking if items already exist
          const existingIds = new Set(products.map((p) => p._id));
          const newItems = result.items.filter((p) => !existingIds.has(p._id));
          setProducts((prev) => [...prev, ...newItems]);
        }

        setPage(pageNum);
        setHasMore(result.hasMore);
        setTotalCount(result.total);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [category, searchQuery, products]
  );

  // Initial load
  useEffect(() => {
    loadProducts(1);
  }, [category, searchQuery]);

  // Infinite scroll observer
  const observerTarget = useInfiniteScroll({
    onLoadMore: () => {
      if (hasMore && !loadingMore && !loading) {
        loadProducts(page + 1);
      }
    },
    enabled: hasMore && !loadingMore && !loading,
  });

  // Empty state
  if (!loading && products.length === 0 && !searchQuery) {
    return (
      <div className="px-5 lg:px-8 max-w-[1280px] mx-auto py-12">
        <div className="card-soft p-10 text-center text-[var(--fg-soft)]">
          <p>Nothing here yet. Seed the database with <code className="text-[var(--fg)]">npm run seed</code>.</p>
        </div>
      </div>
    );
  }

  // No search results
  if (!loading && products.length === 0 && searchQuery) {
    return (
      <section className="px-5 lg:px-8 max-w-[1280px] mx-auto py-12">
        <div className="mb-8">
          {title && (
            <>
              <span className="eyebrow">Shop</span>
              <h1 className="display-2 mt-2">{title}</h1>
              {subtitle && <p className="mt-3 text-[var(--fg-soft)]">{subtitle}</p>}
            </>
          )}
          <div className="mt-6 max-w-md">
            <SearchInput
              value={searchValue}
              onChange={setSearchValue}
              placeholder="Search products…"
            />
          </div>
        </div>

        <div className="card-soft p-10 text-center text-[var(--fg-soft)]">
          <p>
            No products found for "<strong>{searchQuery}</strong>". Try different keywords.
          </p>
        </div>
      </section>
    );
  }

  // Error state
  if (error && products.length === 0) {
    return (
      <section className="px-5 lg:px-8 max-w-[1280px] mx-auto py-12">
        {title && (
          <div className="mb-8">
            <span className="eyebrow">Shop</span>
            <h1 className="display-2 mt-2">{title}</h1>
            {subtitle && <p className="mt-3 text-[var(--fg-soft)]">{subtitle}</p>}
            <div className="mt-6 max-w-md">
              <SearchInput
                value={searchValue}
                onChange={setSearchValue}
                placeholder="Search products…"
              />
            </div>
          </div>
        )}
        <div className="card-soft p-10 text-center text-red-600">
          <p>Error loading products: {error}</p>
          <button
            onClick={() => loadProducts(1)}
            className="mt-4 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="px-5 lg:px-8 max-w-[1280px] mx-auto py-12">
      {/* Header and Search */}
      <div className="mb-8">
        {title && (
          <>
            <span className="eyebrow">Shop</span>
            <h1 className="display-2 mt-2">{title}</h1>
            {subtitle && <p className="mt-3 text-[var(--fg-soft)]">{subtitle}</p>}
          </>
        )}
        {!category && (
          <div className="mt-6 max-w-md">
            <SearchInput
              value={searchValue}
              onChange={setSearchValue}
              placeholder="Search products…"
            />
          </div>
        )}
        {products.length > 0 && (
          <p className="mt-4 text-sm text-[var(--fg-soft)]">
            {searchQuery ? `Found ${totalCount} product${totalCount !== 1 ? "s" : ""}` : `${totalCount} product${totalCount !== 1 ? "s" : ""}`}
          </p>
        )}
      </div>

      {/* Products Grid */}
      <AnimatePresence>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-12">
          {products.map((p, i) => (
            <motion.div
              key={p._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, delay: i % 4 * 0.05 }}
            >
              <ProductCard product={p} index={i} />
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      {/* Loading more indicator */}
      {loadingMore && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-2 text-[var(--fg-soft)]">
            <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-current animate-pulse" style={{ animationDelay: "0.1s" }} />
            <div className="w-2 h-2 rounded-full bg-current animate-pulse" style={{ animationDelay: "0.2s" }} />
          </div>
        </motion.div>
      )}

      {/* No more items message */}
      {!hasMore && products.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-12 text-center text-sm text-[var(--fg-soft)]"
        >
          No more products to load
        </motion.div>
      )}

      {/* Infinite scroll trigger element */}
      {hasMore && !loading && products.length > 0 && (
        <div ref={observerTarget} className="mt-12 h-4" aria-hidden="true" />
      )}

      {/* Initial loading state */}
      {loading && products.length === 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-12">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-lg bg-[var(--bg-soft)] animate-pulse"
            />
          ))}
        </div>
      )}
    </section>
  );
}
