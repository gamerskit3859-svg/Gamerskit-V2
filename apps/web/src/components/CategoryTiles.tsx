"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

const TILES = [
  {
    slug: "rc-car",
    label: "RC Cars",
    blurb: "Drift, crawl, conquer.",
    image:
      "https://ik.imagekit.io/Gamerskit/Rc%20Drift%20Car/file_2025-05-02_12.14.55.png?updatedAt=1746202396515",
  },
  {
    slug: "f1-jersey",
    label: "F1 Jerseys",
    blurb: "Wear the team. Feel the speed.",
    image:
      "https://i.ibb.co.com/4wm12RmJ/480827413-1140797237539229-7132170754175881763-n.jpg",
  },
  {
    slug: "esports",
    label: "E-Sports",
    blurb: "Apparel for the apex players.",
    image:
      "https://i.ibb.co.com/N6m84qGk/464776146-2043910189406672-2430777052060718725-n.jpg",
  },
  {
    slug: "yoyo",
    label: "Pro YoYo",
    blurb: "Spin theory in your pocket.",
    image:
      "https://i.ibb.co.com/V09Y5FDM/506845305-2864256783760727-1966484007278259698-n.jpg",
  },
];

export function CategoryTiles() {
  return (
    <section className="px-5 lg:px-8 max-w-[1280px] mx-auto py-24">
      <div className="flex items-end justify-between mb-10">
        <div>
          <span className="eyebrow">Curated</span>
          <h2 className="display-2 mt-2">Pick your category.</h2>
        </div>
        <Link
          href="/shop"
          className="text-sm font-medium underline underline-offset-4 hidden md:inline"
        >
          See everything →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TILES.map((t, i) => (
          <motion.div
            key={t.slug}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              href={`/shop/${t.slug}`}
              className="relative group block aspect-[16/10] overflow-hidden rounded-[var(--radius-xl)] bg-black"
            >
              <Image
                src={t.image}
                alt={t.label}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-end p-6 lg:p-8 text-white">
                <span className="eyebrow text-white/70">{t.blurb}</span>
                <h3 className="text-3xl md:text-4xl font-semibold tracking-tight mt-1">
                  {t.label}
                </h3>
                <span className="mt-3 text-sm underline underline-offset-4 opacity-80 group-hover:opacity-100">
                  Shop now
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
