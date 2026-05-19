"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { trackAddToCart, trackViewContent } from "@/lib/fb-pixel";
import { formatBDT } from "@/lib/format";
import type { Product, ProductVariantOption } from "@/types/shared";
import { Button, Card, Section } from "@/components/ui";
import { SectionHeader } from "@/components/SectionHeader";
import { ProductGrid } from "@/components/ProductGrid";

// ─── Constants ────────────────────────────────────────────────────────────────

const GALLERY_AUTOPLAY_MS = 5_000;

/** Characters visible before "See more" appears */
const DESC_LIMIT = 160;

const FEATURES = [
  "Free delivery in BD",
  "Cash on delivery",
  "7-day easy returns",
  "WhatsApp support",
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ProductPageClient() {
  const { slug } = useParams<{ slug: string }>();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      setLoading(true);
      setError(null);

      try {
        const { item } = await api.getProduct(slug);
        if (cancelled) return;
        setProduct(item);

        try {
          const all = await api.listProducts({ category: item.category });
          if (!cancelled) {
            setRelated(all.items.filter((p) => p._id !== item._id).slice(0, 4));
          }
        } catch {
          if (!cancelled) setRelated([]);
        }
      } catch {
        if (!cancelled) {
          setProduct(null);
          setRelated([]);
          setError("Product not found.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProduct();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // ── Loading skeleton ──
  if (loading) {
    return (
      <ProductShell>
        <div className="grid animate-pulse items-start gap-8 sm:gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="aspect-square rounded-2xl bg-bg-soft sm:rounded-[2rem]" />
          <div className="space-y-4 sm:space-y-5">
            <div className="h-10 rounded bg-bg-soft sm:h-12" />
            <div className="h-7 w-36 rounded bg-bg-soft sm:h-8 sm:w-40" />
            <div className="h-28 rounded bg-bg-soft sm:h-32" />
          </div>
        </div>
      </ProductShell>
    );
  }

  // ── Error / not found ──
  if (error || !product) {
    return (
      <ProductShell>
        <Card tone="soft" padding="lg" className="text-center">
          <h1 className="text-xl font-semibold sm:text-2xl">
            Product not found.
          </h1>
          <p className="mt-2 text-sm text-fg-soft">
            This product may be unavailable or moved.
          </p>
        </Card>
      </ProductShell>
    );
  }

  return (
    <ProductShell>
      {/* Main two-column layout */}
      <div className="grid items-start gap-8 sm:gap-10 lg:grid-cols-2 lg:gap-16">
        <ProductImageGallery images={product.images} alt={product.title} />

        <div className="flex flex-col">
          <ProductInfoSection product={product} />
          <AddToCartSection key={product._id} product={product} />
        </div>
      </div>

      <RelatedProductsSection products={related} />
    </ProductShell>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function ProductShell({ children }: { children: ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 sm:py-12 md:py-16 lg:px-8">
      {children}
    </article>
  );
}

// ─── Image Gallery ────────────────────────────────────────────────────────────

interface GalleryProps {
  images: string[];
  alt: string;
}

function ProductImageGallery({ images, alt }: GalleryProps) {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollTo = useCallback((nextIndex: number) => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({
      left: nextIndex * container.offsetWidth,
      behavior: "smooth",
    });
    setIndex(nextIndex);
  }, []);

  // Autoplay
  useEffect(() => {
    if (images.length <= 1 || isPaused) return;
    const timer = window.setInterval(
      () => scrollTo((index + 1) % images.length),
      GALLERY_AUTOPLAY_MS,
    );
    return () => window.clearInterval(timer);
  }, [images.length, index, isPaused, scrollTo]);

  function handleScroll() {
    const container = scrollRef.current;
    if (!container) return;
    const nextIndex = Math.round(container.scrollLeft / container.offsetWidth);
    if (nextIndex !== index) setIndex(nextIndex);
  }

  if (!images.length) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl bg-bg-soft text-sm text-fg-muted sm:rounded-[2rem]">
        No images available
      </div>
    );
  }

  const prevIndex = index === 0 ? images.length - 1 : index - 1;
  const nextIndex = (index + 1) % images.length;

  return (
    <div
      className="flex flex-col gap-3 sm:gap-4"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}>
      {/* Main image */}
      <div className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-line bg-bg-soft sm:rounded-[2rem]">
        {/* Autoplay progress bar */}
        {images.length > 1 && !isPaused && (
          <div className="pointer-events-none absolute left-0 top-0 z-20 h-1 w-full overflow-hidden">
            <motion.div
              key={index}
              initial={{ x: "-100%" }}
              animate={{ x: "0%" }}
              transition={{
                duration: GALLERY_AUTOPLAY_MS / 1000,
                ease: "linear",
              }}
              className="h-full bg-black/10"
            />
          </div>
        )}

        {/* Scroll container */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {images.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className="relative h-full w-full flex-shrink-0 snap-center">
              <Image
                src={src}
                alt={`${alt} – image ${i + 1}`}
                fill
                priority={i === 0}
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          ))}
        </div>

        {/* Prev / next arrows – visible on hover, desktop only */}
        {images.length > 1 && (
          <>
            <GalleryArrow
              direction="left"
              onClick={() => scrollTo(prevIndex)}
            />
            <GalleryArrow
              direction="right"
              onClick={() => scrollTo(nextIndex)}
            />

            {/* Dot indicators */}
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 sm:bottom-6 sm:gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollTo(i)}
                  aria-label={`Show image ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === index ? "w-6 bg-black sm:w-8" : "w-1.5 bg-black/20"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={`thumb-${i}`}
              type="button"
              onClick={() => scrollTo(i)}
              aria-label={`Select image ${i + 1}`}
              className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border-2 transition-all sm:h-20 sm:w-20  ${
                i === index
                  ? "scale-95 border-black"
                  : "border-transparent opacity-50 hover:opacity-75"
              }`}>
              <Image
                src={src}
                alt=""
                fill
                className="object-cover"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Arrow button extracted to keep gallery JSX clean
function GalleryArrow({
  direction,
  onClick,
}: {
  direction: "left" | "right";
  onClick: () => void;
}) {
  const isLeft = direction === "left";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isLeft ? "Previous image" : "Next image"}
      className={`absolute top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 opacity-0 shadow-sm backdrop-blur transition-opacity hover:bg-white group-hover:opacity-100 md:flex sm:h-10 sm:w-10 ${
        isLeft ? "left-3 sm:left-4" : "right-3 sm:right-4"
      }`}>
      {isLeft ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </button>
  );
}

// ─── Product Info ─────────────────────────────────────────────────────────────

function ProductInfoSection({ product }: { product: Product }) {
  const [expanded, setExpanded] = useState(false);

  const desc = product.description ?? "";
  const isLong = desc.length > DESC_LIMIT;
  const visibleDesc =
    isLong && !expanded ? desc.slice(0, DESC_LIMIT).trimEnd() + "…" : desc;

  // Fire pixel view event once per product
  useEffect(() => {
    trackViewContent(product);
  }, [product]);

  const hasSalePrice =
    product.compareAtPrice != null && product.compareAtPrice > product.price;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Title */}
      <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
        {product.title}
      </h1>

      {/* Price */}
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-semibold sm:text-3xl">
          {formatBDT(product.price)}
        </span>
        {hasSalePrice && (
          <span className="text-base text-fg-muted line-through sm:text-lg">
            {formatBDT(product.compareAtPrice!)}
          </span>
        )}
      </div>

      {/* Description with See more / See less */}
      {desc && (
        <div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-fg-soft sm:text-base">
            {visibleDesc}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-sm font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {expanded ? "See less" : "See more"}
            </button>
          )}
        </div>
      )}

      {/* Feature list */}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-4 text-xs text-fg-soft sm:gap-x-6 sm:gap-y-3 sm:pt-5 sm:text-sm">
        {FEATURES.map((feature) => (
          <li key={feature} className="flex items-center gap-1.5">
            <span aria-hidden>–</span>
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Add-to-cart ──────────────────────────────────────────────────────────────

function AddToCartSection({ product }: { product: Product }) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const variantGroups = (product.variants ?? []).filter(
    (group) => group.name && group.options?.length,
  );
  const hasVariants = variantGroups.length > 0;
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        variantGroups.map((group) => {
          const firstAvailable =
            group.options.find((option) => option.stock > 0) ?? group.options[0];
          return [group.name, firstAvailable?.value ?? ""];
        }),
      ),
  );

  const selectedOptions = variantGroups
    .map((group) =>
      group.options.find((option) => option.value === selectedVariants[group.name]),
    )
    .filter(Boolean) as ProductVariantOption[];
  const selectedStock = hasVariants
    ? Math.min(...selectedOptions.map((option) => option.stock))
    : product.stock;
  const selectedPrice =
    [...selectedOptions]
      .reverse()
      .find((option) => typeof option.price === "number")?.price ?? product.price;
  const selectedSku = selectedOptions
    .map((option) => option.sku)
    .filter(Boolean)
    .join(" / ");
  const variantsReady =
    !hasVariants ||
    variantGroups.every((group) => Boolean(selectedVariants[group.name]));
  const isOutOfStock = selectedStock <= 0;
  const canAddToCart = variantsReady && !isOutOfStock && qty <= selectedStock;

  function handleAdd() {
    if (!canAddToCart) return;
    add(product, qty, {
      selectedVariants: hasVariants ? selectedVariants : undefined,
      unitPrice: selectedPrice,
      variantSku: selectedSku || undefined,
    });
    trackAddToCart(
      { ...product, price: selectedPrice, sku: selectedSku || product._id },
      qty,
    );
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2_000);
  }

  function handleBuy() {
    if (!canAddToCart) return;
    add(product, qty, {
      selectedVariants: hasVariants ? selectedVariants : undefined,
      unitPrice: selectedPrice,
      variantSku: selectedSku || undefined,
    });
    trackAddToCart(
      { ...product, price: selectedPrice, sku: selectedSku || product._id },
      qty,
    );
    router.push("/checkout");
  }

  return (
    /* Sticky bar on mobile; normal flow on md+ */
    <div className="pb-safe fixed bottom-0 left-0 right-0 z-50 border-t border-line bg-white/80 p-3 backdrop-blur-xl sm:p-4 md:relative md:z-auto md:mt-8 md:border-none md:bg-transparent md:p-0 md:backdrop-blur-none">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3">
        {hasVariants && (
          <div className="grid gap-3 rounded-2xl border border-line bg-white p-3 sm:grid-cols-2">
            {variantGroups.map((group) => (
              <div key={group.name}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  {group.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((option) => {
                    const disabled = option.stock <= 0;
                    const active = selectedVariants[group.name] === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          setSelectedVariants((prev) => ({
                            ...prev,
                            [group.name]: option.value,
                          }))
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          active
                            ? "border-black bg-black text-white"
                            : "border-line bg-bg-soft text-foreground hover:border-black"
                        } disabled:cursor-not-allowed disabled:opacity-40`}>
                        {option.value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-semibold">{formatBDT(selectedPrice)}</span>
          <span className={isOutOfStock ? "text-red-600" : "text-fg-muted"}>
            {isOutOfStock ? "Out of stock" : `${selectedStock} in stock`}
          </span>
        </div>

        {/* Qty stepper + confirmation badge */}
        <div className="flex items-center gap-3">
          <QuantityStepper
            qty={qty}
            onChange={(next) => setQty(Math.min(next, Math.max(1, selectedStock)))}
          />

          <AnimatePresence>
            {added && (
              <motion.span
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-full border border-green-100 bg-green-50 px-3 py-1 text-xs font-medium text-green-600">
                Added to bag
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Button variant="secondary" onClick={handleAdd} disabled={!canAddToCart}>
            {added ? "Added" : "Add to bag"}
          </Button>
          <Button onClick={handleBuy} disabled={!canAddToCart}>
            Buy now
          </Button>
        </div>
      </div>
    </div>
  );
}

// Quantity stepper extracted for clarity
function QuantityStepper({
  qty,
  onChange,
}: {
  qty: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex h-10 items-center overflow-hidden rounded-full border border-line-strong bg-white sm:h-11">
      <StepperButton
        label="Decrease quantity"
        icon={<Minus size={13} />}
        onClick={() => onChange(Math.max(1, qty - 1))}
      />
      <span className="w-8 text-center text-sm font-bold">{qty}</span>
      <StepperButton
        label="Increase quantity"
        icon={<Plus size={13} />}
        onClick={() => onChange(qty + 1)}
      />
    </div>
  );
}

function StepperButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-full w-9 items-center justify-center transition-colors hover:bg-bg-soft active:bg-line sm:w-11">
      {icon}
    </button>
  );
}

// ─── Related Products ─────────────────────────────────────────────────────────

function RelatedProductsSection({ products }: { products: Product[] }) {
  if (!products.length) return null;

  return (
    <Section
      width="full"
      flush
      spacing="md"
      className="mt-10 border-t border-line sm:mt-14">
      <SectionHeader
        eyebrow="You may also like"
        title="From the same category."
      />
      {products.length > 0 ? (
        <ProductGrid products={products} />
      ) : (
        <EmptyState />
      )}
    </Section>
  );
}

function EmptyState() {
  return (
    <Card
      tone="soft"
      padding="lg"
      className="text-center border-dashed text-fg-soft">
      <p>No products yet.</p>
    </Card>
  );
}
