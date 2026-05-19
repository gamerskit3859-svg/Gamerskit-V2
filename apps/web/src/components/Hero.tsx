"use client";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { optimizeCloudinaryImage } from "@/lib/images";
import { LinkButton } from "@/components/ui";
import { cn } from "@/lib/cn";

interface HeroImage {
  _id: string;
  imageUrl: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  order: number;
  isActive: boolean;
}

const FALLBACK_IMAGES: HeroImage[] = [
  {
    _id: "default-1",
    imageUrl:
      "https://ik.imagekit.io/Gamerskit/Rc%20Drift%20Car/file_2025-05-02_12.14.55.png?updatedAt=1746202396515",
    order: 0,
    isActive: true,
  },
  {
    _id: "default-2",
    imageUrl: "https://ik.imagekit.io/Gamerskit/PC.jpg?updatedAt=1746205763054",
    order: 1,
    isActive: true,
  },
  {
    _id: "default-3",
    imageUrl:
      "https://ik.imagekit.io/Gamerskit/mobile.jpg?updatedAt=1746205747764",
    order: 2,
    isActive: true,
  },
];

const SLIDE_INTERVAL_MS = 5500;
const SWIPE_THRESHOLD = 50;

export function Hero({
  initialImages = FALLBACK_IMAGES,
}: {
  initialImages?: HeroImage[];
}) {
  const [images] = useState<HeroImage[]>(
    initialImages.length > 0 ? initialImages : FALLBACK_IMAGES,
  );
  const [index, setIndex] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    if (images.length <= 1 || isInteracting) return;
    const id = setInterval(() => {
      setIndex((current) => (current + 1) % images.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [images.length, isInteracting]);

  function goTo(nextIndex: number) {
    setIndex((nextIndex + images.length) % images.length);
  }

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    setIsInteracting(false);
    if (Math.abs(info.offset.x) < SWIPE_THRESHOLD) return;
    goTo(index + (info.offset.x < 0 ? 1 : -1));
  }

  if (images.length === 0) {
    return (
      <section className="relative h-[75vh] min-h-[560px] w-full overflow-hidden bg-black -mt-[86px] md:h-screen">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/85" />
      </section>
    );
  }

  return (
    <section className="relative h-[75vh] min-h-[560px] w-full overflow-hidden bg-black md:-mt-[86px] md:h-screen">
      <motion.div
        drag={images.length > 1 ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        onDragStart={() => setIsInteracting(true)}
        onDragEnd={handleDragEnd}
        className="absolute inset-0 cursor-grab active:cursor-grabbing">
        {images.map((src, i) => {
          const mediaUrl = src.mediaUrl || src.imageUrl;
          const mediaType = src.mediaType || "image";
          return (
          <motion.div
            key={src._id}
            initial={false}
            animate={{
              opacity: i === index ? 1 : 0,
              scale: i === index ? 1.04 : 1,
            }}
            transition={{
              opacity: { duration: 1.4 },
              scale: { duration: 8, ease: "linear" },
            }}
            className="absolute inset-0">
            {mediaType === "video" ? (
              <video
                className="h-full w-full object-cover object-center"
                src={mediaUrl}
                autoPlay
                muted
                loop
                playsInline
                preload={i === 0 ? "auto" : "metadata"}
                aria-hidden="true"
              />
            ) : (
              <Image
                src={optimizeCloudinaryImage(
                  mediaUrl,
                  "f_auto,q_auto,c_fill,w_1920",
                )}
                alt=""
                fill
                priority={i === 0}
                sizes="100vw"
                className="object-cover object-center"
              />
            )}
          </motion.div>
          );
        })}
      </motion.div>

      {/* Cinematic gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/35 to-black/85 md:from-black/45 md:via-black/25" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent" />

      {/* Content wrapper centered vertically using flex-col & justify-center */}
      <div className="relative mx-auto flex h-full max-w-[1280px] flex-col items-start justify-center px-5 text-left text-white sm:px-8 lg:px-12 md:pt-24">
        <div>
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-xs uppercase tracking-[0.18em] font-medium text-white/70">
            #1 brand for hobby gadgets
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.1 }}
            className="mt-3  text-[clamp(40px,8vw,96px)] leading-[1.04] tracking-[-0.045em] font-semibold max-w-[250px] md:max-w-[14ch]">
            Your favorite RC Cars and Gadgets
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.2 }}
            className="mt-5 max-w-xl text-base text-white/85 md:text-lg">
            High-speed RC drift cars and premium phone accessories — tested by
            us, delivered free across Bangladesh.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.32 }}
            className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/shop" variant="secondary">
              Shop the collection
            </LinkButton>
            <div className="hidden md:block">
              {" "}
              <LinkButton href="/shop/rc-car" variant="glass-dark">
                Explore RC cars
              </LinkButton>
            </div>
          </motion.div>

          {images.length > 1 && (
            <div className="mt-10 flex gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={cn(
                    "h-1 rounded-full transition-all",
                    i === index
                      ? "w-10 bg-white"
                      : "w-4 bg-white/40 hover:bg-white/70",
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            className="absolute left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/25 text-white backdrop-blur transition hover:bg-black/40 sm:flex"
            aria-label="Previous hero slide">
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            className="absolute right-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/25 text-white backdrop-blur transition hover:bg-black/40 sm:flex"
            aria-label="Next hero slide">
            <ChevronRight size={20} />
          </button>
        </>
      )}
    </section>
  );
}
