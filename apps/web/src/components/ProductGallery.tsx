"use client";
import Image from "next/image";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion"; // Ensure this is imported
import { ChevronLeft, ChevronRight } from "lucide-react";

export function ProductGallery({
  images,
  alt,
  autoPlayInterval = 5000,
}: {
  images: string[];
  alt: string;
  autoPlayInterval?: number;
}) {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollTo = useCallback((j: number) => {
    if (!scrollRef.current) return;

    // Calculate the exact position based on the container width
    const container = scrollRef.current;
    const scrollAmount = j * container.offsetWidth;

    container.scrollTo({
      left: scrollAmount,
      behavior: "smooth",
    });
    setIndex(j);
  }, []);

  // Auto-play Effect
  useEffect(() => {
    if (images.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      const nextIndex = (index + 1) % images.length;
      scrollTo(nextIndex);
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [index, images.length, isPaused, autoPlayInterval, scrollTo]);

  // Sync index on manual scroll
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, offsetWidth } = scrollRef.current;

    // Add a slight delay or threshold to prevent flickering during the snap
    const newIndex = Math.round(scrollLeft / offsetWidth);
    if (newIndex !== index) {
      setIndex(newIndex);
    }
  };

  if (!images || images.length === 0) {
    return (
      <div className="aspect-square flex items-center justify-center bg-[var(--bg-soft)] rounded-3xl text-sm text-[var(--fg-muted)]">
        No images available
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-4"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}>
      <div className="group relative aspect-square w-full overflow-hidden rounded-[2rem] bg-[var(--bg-soft)] border border-[var(--line)]">
        {/* Progress Bar Loader */}
        {images.length > 1 && !isPaused && (
          <div className="absolute top-0 left-0 w-full h-1 z-20 pointer-events-none overflow-hidden">
            <motion.div
              key={index}
              initial={{ x: "-100%" }}
              animate={{ x: "0%" }}
              transition={{ duration: autoPlayInterval / 1000, ease: "linear" }}
              className="h-full bg-black/10"
            />
          </div>
        )}

        {/* Scrollable Area */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex h-full w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {images.map((src, j) => (
            <div
              key={`${src}-${j}`}
              className="relative h-full w-full flex-shrink-0 snap-center">
              <Image
                src={src}
                alt={`${alt} - ${j + 1}`}
                fill
                priority={j === 0}
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          ))}
        </div>

        {/* Arrows (Desktop Only) */}
        <button
          onClick={() => scrollTo(index === 0 ? images.length - 1 : index - 1)}
          className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/80 backdrop-blur shadow-sm hidden md:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white">
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={() => scrollTo((index + 1) % images.length)}
          className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/80 backdrop-blur shadow-sm hidden md:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white">
          <ChevronRight size={20} />
        </button>

        {/* Indicator Dots */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, j) => (
            <button
              key={j}
              onClick={() => scrollTo(j)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                j === index ? "w-8 bg-black" : "w-1.5 bg-black/20"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {images.map((src, j) => (
          <button
            key={`thumb-${j}`}
            onClick={() => scrollTo(j)}
            className={`relative h-20 w-20 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${
              j === index
                ? "border-black scale-95"
                : "border-transparent opacity-50"
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
    </div>
  );
}
