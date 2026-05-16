"use client";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { optimizeCloudinaryImage } from "@/lib/images";
import { LinkButton } from "@/components/ui";

interface HeroImage {
  _id: string;
  imageUrl: string;
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
    imageUrl:
      "https://ik.imagekit.io/Gamerskit/PC.jpg?updatedAt=1746205763054",
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

export function Hero({
  initialImages = FALLBACK_IMAGES,
}: {
  initialImages?: HeroImage[];
}) {
  const [images] = useState<HeroImage[]>(
    initialImages.length > 0 ? initialImages : FALLBACK_IMAGES,
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length === 0) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [images]);

  if (images.length === 0) {
    return (
      <section className="relative h-screen w-full overflow-hidden bg-black -mt-[86px]">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/85" />
      </section>
    );
  }

  return (
    <section className="relative h-screen w-full overflow-hidden bg-black -mt-[86px]">
      {images.slice(index, index + 1).map((src) => (
        <motion.div
          key={src._id}
          initial={false}
          animate={{
            opacity: 1,
            scale: 1.04,
          }}
          transition={{
            opacity: { duration: 1.4 },
            scale: { duration: 8, ease: "linear" },
          }}
          className="absolute inset-0"
        >
          <Image
            src={optimizeCloudinaryImage(src.imageUrl, "f_auto,q_auto,c_fill,w_1920")}
            alt=""
            fill
            priority={index === 0}
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>
      ))}

      {/* Cinematic gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/85" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/45 to-transparent" />

      <div className="relative h-full flex flex-col justify-end pb-[14vh] px-5 lg:px-12 max-w-[1280px] mx-auto text-white">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-xs uppercase tracking-[0.18em] font-medium text-white/70"
        >
          GamersKit · Spring 2026
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.1 }}
          className="mt-3 max-w-[14ch] text-[clamp(48px,8vw,96px)] leading-[1.04] tracking-[-0.045em] font-semibold"
        >
          Built for the players who don&apos;t settle.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.2 }}
          className="mt-5 max-w-xl text-base md:text-lg text-white/80"
        >
          High-speed RC drift cars, official F1 and e-sports jerseys, gaming
          gear — delivered free across Bangladesh.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.32 }}
          className="mt-8 flex flex-wrap gap-3"
        >
          <LinkButton href="/shop" variant="secondary">
            Shop the collection
          </LinkButton>
          <LinkButton href="/shop/rc-car" variant="glass-dark">
            Explore RC cars
          </LinkButton>
        </motion.div>

        <div className="mt-10 flex gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-1 rounded-full transition-all ${
                i === index ? "w-10 bg-white" : "w-4 bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
