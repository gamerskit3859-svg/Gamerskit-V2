"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useInfiniteScroll, useDebouncedSearch } from "@/lib/hooks";
import { SearchInput } from "./SearchInput";
import { ProductCard } from "./ProductCard";
import type { Product } from "@gamerskit/shared";
import { Button, Card, Section } from "@/components/ui";

interface ProductListingProps {
  category?: string;
  title?: string;
  subtitle?: string;
}

const PAGE_SIZE = 20;

function ListingHeader({
  title,
  subtitle,
  showSearch,
  searchValue,
  onSearchChange,
  countLabel,
}: {
  title?: string;
  subtitle?: string;
  showSearch: boolean;
  searchValue: string;
  onSearchChange: (v: string) => void;
  countLabel?: string;
}) {
  return (
    <div className="mb-8">
      {title && (
        <>
          <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
            Shop
          </span>
          <h1 className="mt-2 text-[clamp(36px,5vw,64px)] leading-[1.06] tracking-[-0.035em] font-semibold">
            {title}
          </h1>
          {subtitle && <p className="mt-3 text-fg-soft">{subtitle}</p>}
        </>
      )}
      {showSearch && (
        <div className="mt-6 max-w-md">
          <SearchInput
            value={searchValue}
            onChange={onSearchChange}
            placeholder="Search products…"
          />
        </div>
      )}
      {countLabel && (
        <p className="mt-4 text-sm text-fg-soft">{countLabel}</p>
      )}
    </div>
  );
}

export function ProductListing({ category, title, subtitle }: ProductListingProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const {
    value: searchValue,
    setValue: setSearchValue,
    debouncedValue: searchQuery,
  } = useDebouncedSearch("");

  useEffect(() => {
    setPage(1);
    setProducts([]);
    setHasMore(true);
  }, [searchQuery, category]);

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
          limit: PAGE_SIZE,
        });

        if (isFirstPage) {
          setProducts(result.items);
        } else {
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
    [category, searchQuery, products],
  );

  useEffect(() => {
    void loadProducts(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, searchQuery]);

  const observerTarget = useInfiniteScroll({
    onLoadMore: () => {
      if (hasMore && !loadingMore && !loading) {
        void loadProducts(page + 1);
      }
    },
    enabled: hasMore && !loadingMore && !loading,
  });

  // Empty (no products and no search query)
  if (!loading && products.length === 0 && !searchQuery) {
    return (
      <Section width="default" spacing="md">
        <Card tone="soft" padding="lg" className="text-center text-fg-soft">
          <p>
            Nothing here yet. Seed the database with{" "}
            <code className="text-foreground">npm run seed</code>.
          </p>
        </Card>
      </Section>
    );
  }

  // No search results
  if (!loading && products.length === 0 && searchQuery) {
    return (
      <Section width="default" spacing="md">
        <ListingHeader
          title={title}
          subtitle={subtitle}
          showSearch
          searchValue={searchValue}
          onSearchChange={setSearchValue}
        />
        <Card tone="soft" padding="lg" className="text-center text-fg-soft">
          <p>
            No products found for &quot;<strong>{searchQuery}</strong>&quot;. Try
            different keywords.
          </p>
        </Card>
      </Section>
    );
  }

  // Error state
  if (error && products.length === 0) {
    return (
      <Section width="default" spacing="md">
        {title && (
          <ListingHeader
            title={title}
            subtitle={subtitle}
            showSearch={!category}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
          />
        )}
        <Card tone="soft" padding="lg" className="text-center text-red-600">
          <p>Error loading products: {error}</p>
          <Button onClick={() => loadProducts(1)} className="mt-4">
            Try again
          </Button>
        </Card>
      </Section>
    );
  }

  const countLabel =
    products.length > 0
      ? `${searchQuery ? "Found " : ""}${totalCount} product${
          totalCount !== 1 ? "s" : ""
        }`
      : undefined;

  return (
    <Section width="default" spacing="md">
      <ListingHeader
        title={title}
        subtitle={subtitle}
        showSearch={!category}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        countLabel={countLabel}
      />

      <AnimatePresence>
        <div className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => (
            <motion.div
              key={p._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, delay: (i % 4) * 0.05 }}
            >
              <ProductCard product={p} index={i} />
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      {loadingMore && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-2 text-fg-soft">
            <div className="h-2 w-2 animate-pulse rounded-full bg-current" />
            <div
              className="h-2 w-2 animate-pulse rounded-full bg-current"
              style={{ animationDelay: "0.1s" }}
            />
            <div
              className="h-2 w-2 animate-pulse rounded-full bg-current"
              style={{ animationDelay: "0.2s" }}
            />
          </div>
        </motion.div>
      )}

      {!hasMore && products.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-12 text-center text-sm text-fg-soft"
        >
          No more products to load
        </motion.div>
      )}

      {hasMore && !loading && products.length > 0 && (
        <div ref={observerTarget} className="mt-12 h-4" aria-hidden="true" />
      )}

      {loading && products.length === 0 && (
        <div className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-lg bg-bg-soft"
            />
          ))}
        </div>
      )}
    </Section>
  );
}
