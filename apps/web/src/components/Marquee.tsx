const ITEMS = [
  "Free delivery across Bangladesh",
  "100% genuine products",
  "Easy 7-day returns",
  "Cash on delivery",
  "WhatsApp support",
];

/**
 * Continuously-scrolling promo band shown under the hero. Uses the
 * `animate-marquee` utility exposed via `@theme inline` in globals.css.
 */
export function Marquee() {
  return (
    <div className="border-y border-line py-3 overflow-hidden bg-white">
      <div className="flex gap-12 whitespace-nowrap animate-marquee">
        {[...ITEMS, ...ITEMS, ...ITEMS].map((it, i) => (
          <span
            key={i}
            className="text-xs tracking-[0.18em] uppercase text-fg-muted"
          >
            {it}
            <span className="mx-6 text-line-strong">/</span>
          </span>
        ))}
      </div>
    </div>
  );
}
