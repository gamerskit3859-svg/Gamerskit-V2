"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface HeroImage {
  _id: string;
  imageUrl: string;
  order: number;
  isActive: boolean;
}

export function Hero() {
  const [images, setImages] = useState<HeroImage[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHeroImages() {
      try {
        const result = await api.getHeroImages();
        setImages(result.items);
      } catch (err) {
        console.error("Failed to load hero images:", err);
        // Fallback to default images on error
        setImages([
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
        ]);
      } finally {
        setLoading(false);
      }
    }

    loadHeroImages();
  }, []);

  useEffect(() => {
    if (images.length === 0) return;

    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, 5500);
    return () => clearInterval(id);
  }, [images]);

  if (loading || images.length === 0) {
    return (
      <section className="relative h-screen w-full overflow-hidden bg-black -mt-[76px]">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/85" />
      </section>
    );
  }

  return (
    <section className="relative h-screen w-full overflow-hidden bg-black -mt-[76px]">
      {images.map((src, i) => (
        <motion.div
          key={src._id}
          initial={false}
          animate={{ opacity: i === index ? 1 : 0, scale: i === index ? 1.04 : 1 }}
          transition={{ opacity: { duration: 1.4 }, scale: { duration: 8, ease: "linear" } }}
          className="absolute inset-0"
        >
          <Image
            src={src.imageUrl}
            alt=""
            fill
            priority={i === 0}
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>
      ))}
      {/* Cinematic gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/85" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/45 to-transparent" />

      <div className="relative h-full flex flex-col justify-end pb-[14vh] px-5 lg:px-12 max-w-[1280px] mx-auto text-white">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="eyebrow text-white/70"
        >
          GamersKit · Spring 2026
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.1 }}
          className="display-1 mt-3 max-w-[14ch]"
        >
          Built for the players who don&apos;t settle.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.2 }}
          className="mt-5 max-w-xl text-base md:text-lg text-white/80"
        >
          High-speed RC drift cars, official F1 and e-sports jerseys, gaming gear —
          delivered free across Bangladesh.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.32 }}
          className="mt-8 flex gap-3 flex-wrap"
        >
          <Link href="/shop" className="btn btn-light">
            Shop the collection
          </Link>
          <Link
            href="/shop/rc-car"
            className="btn glass-dark text-white border-white/30"
          >
            Explore RC cars
          </Link>
        </motion.div>

        <div className="mt-10 flex gap-2">
          {images.map((_, i) => (
            <button
              key={i}
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
