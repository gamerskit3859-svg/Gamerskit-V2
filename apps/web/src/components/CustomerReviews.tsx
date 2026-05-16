"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Quote, Star } from "lucide-react";
import { Section } from "./ui";

const reviews = [
  {
    name: "Mohammed Ihfaz Abedin",
    review:
      "Bought the RC GTR car from them. The RC car is really high-quality and they are so cooperative",
    img: "https://i.ibb.co.com/N6m84qGk/464776146-2043910189406672-2430777052060718725-n.jpg",
    rating: 5,
  },
  {
    name: "Sameer Rashid",
    review:
      "The admins were very co operative. This rc car is super fun and well-made! The colors are bright. I recommend this page.",
    img: "https://i.ibb.co.com/Vpp7rYwT/523801024-1296754335355376-5991493133399493592-n.jpg",
    rating: 5,
  },
  {
    name: "Abu Ayub Ansare",
    review:
      "Bought the RC GTR car from them. The RC car is really high-quality and their behaviour is really good.",
    img: "https://i.ibb.co.com/4wm12RmJ/480827413-1140797237539229-7132170754175881763-n.jpg",
    rating: 4,
  },
  {
    name: "Nayeem Hossain",
    review:
      "I ordered two of the sentinels half sleeve jerseys. One is black and another one is special edition. Both of them are best quality jerseys. I am going to order two more jerseys for my dad. Must recommend, buy from GamersKit!!",
    img: "https://i.ibb.co.com/V09Y5FDM/506845305-2864256783760727-1966484007278259698-n.jpg",
    rating: 5,
  },
];

function useSlidesPerView() {
  const [slidesPerView, setSlidesPerView] = useState(1);

  useEffect(() => {
    const update = () => {
      if (window.innerWidth >= 1024) setSlidesPerView(2);
      else if (window.innerWidth >= 768) setSlidesPerView(2);
      else setSlidesPerView(1);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return slidesPerView;
}

export function CustomerReviews() {
  const slidesPerView = useSlidesPerView();
  const maxIndex = Math.max(0, reviews.length - slidesPerView);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setActiveIndex((index) => Math.min(index, maxIndex));
    });
  }, [maxIndex]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveIndex((index) => (index >= maxIndex ? 0 : index + 1));
    }, 3000);

    return () => window.clearInterval(id);
  }, [maxIndex]);

  const pagination = useMemo(
    () => Array.from({ length: maxIndex + 1 }, (_, index) => index),
    [maxIndex],
  );

  return (
    <Section spacing="md">
      {/* Category Header Section */}
      <div className="pb-10">
        <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Curated
        </span>
        <h2 className="mt-2 text-[clamp(36px,5vw,64px)] font-bold leading-[1.06] tracking-[-0.035em] text-neutral-950">
          Pick your category.
        </h2>
      </div>

      <div className="relative z-10 text-center 2xl:container 2xl:mx-auto">
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{
              transform: `translateX(-${activeIndex * (100 / slidesPerView)}%)`,
            }}>
            {reviews.map((item) => (
              <div
                key={item.name}
                className="shrink-0 px-[15px]"
                style={{ width: `${100 / slidesPerView}%` }}>
                {/* Pure White Background Card with clean Black and Gray elements */}
                <div className="flex h-full min-h-[280px] flex-col rounded-2xl border border-neutral-200 bg-white p-6 text-left">
                  <Quote className="mb-4 h-8 w-8 text-neutral-950" />
                  <p className="flex-grow text-base italic leading-relaxed text-neutral-800">
                    &quot;{item.review}&quot;
                  </p>
                  <div className="mt-6 flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center space-x-3">
                      <Image
                        src={item.img}
                        alt={item.name}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-full border border-neutral-300 object-cover"
                      />
                      <span className="font-semibold text-neutral-950 truncate">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex shrink-0">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          size={16}
                          fill={i < item.rating ? "currentColor" : "none"}
                          className={
                            i < item.rating
                              ? "text-neutral-950"
                              : "text-neutral-300"
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Black & White Pagination Dots */}
        <div className="mt-6 flex justify-center">
          {pagination.map((index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Show review slide ${index + 1}`}
              className={`mx-[6px] h-[10px] w-[10px] rounded-full transition-all duration-300 ${
                index === activeIndex
                  ? "scale-125 bg-neutral-950 opacity-100"
                  : "bg-neutral-300 opacity-60 hover:opacity-100"
              }`}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}

export default CustomerReviews;
