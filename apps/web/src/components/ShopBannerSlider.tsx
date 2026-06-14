"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { motion, useMotionValue, type Transition } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ShopBannerItem } from "@/lib/api";
import { optimizeCloudinaryImage } from "@/lib/images";
import { cn } from "@/lib/cn";

const SWIPE_THRESHOLD = 45;

const FAST_SLIDE_TRANSITION: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export function ShopBannerSlider({ banners }: { banners: ShopBannerItem[] }) {
  const [index, setIndex] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const dragX = useMotionValue(0);

  useEffect(() => {
    if (banners.length <= 1 || isInteracting) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % banners.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [banners.length, isInteracting]);

  if (banners.length === 0) return null;

  function goTo(nextIndex: number) {
    setIndex((nextIndex + banners.length) % banners.length);
  }

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    setIsInteracting(false);
    if (Math.abs(info.offset.x) < SWIPE_THRESHOLD) return;
    goTo(index + (info.offset.x < 0 ? 1 : -1));
  }

  return (
    <div className="group relative aspect-[16/8] w-full overflow-hidden rounded-lg bg-black sm:aspect-[16/6] md:aspect-[16/5] lg:aspect-[16/4]">
      <motion.div
        className="flex h-full w-full cursor-grab active:cursor-grabbing"
        style={{ x: dragX }}
        drag={banners.length > 1 ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragStart={() => setIsInteracting(true)}
        onDragEnd={handleDragEnd}
        animate={{ x: `-${index * 100}%` }}
        transition={FAST_SLIDE_TRANSITION}>
        {banners.map((banner, bannerIndex) => (
          <div
            key={banner._id}
            className="relative h-full w-full flex-shrink-0 bg-black">
            {/* Background Image */}
            <Image
              src={optimizeCloudinaryImage(
                banner.imageUrl,
                "f_auto,q_auto,c_fill,w_1800", // Changed c_fit to c_fill so it covers the background completely
              )}
              alt={"Shop banner background"}
              fill
              priority={bannerIndex === 0}
              sizes="(max-width: 768px) 100vw, 1280px"
              className="object-cover pointer-events-none" // Changed object-contain to object-cover
              draggable={false}
            />
          </div>
        ))}
      </motion.div>

      {/* Navigation Controls */}
      {banners.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            className="absolute left-3 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/25 text-white backdrop-blur transition hover:bg-black/40 sm:flex"
            aria-label="Previous shop banner">
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            className="absolute right-3 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/25 text-white backdrop-blur transition hover:bg-black/40 sm:flex"
            aria-label="Next shop banner">
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-2">
            {banners.map((banner, bannerIndex) => (
              <button
                key={banner._id}
                type="button"
                onClick={() => goTo(bannerIndex)}
                className={cn(
                  "h-1.5 rounded-full bg-white/60 transition-all",
                  bannerIndex === index ? "w-8 bg-white" : "w-3 hover:bg-white",
                )}
                aria-label={`Show shop banner ${bannerIndex + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
