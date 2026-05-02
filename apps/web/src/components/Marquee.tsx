export function Marquee() {
  const items = [
    "Free delivery across Bangladesh",
    "100% genuine products",
    "Easy 7-day returns",
    "Cash on delivery",
    "WhatsApp support",
  ];
  return (
    <div className="hairline-t hairline-b py-3 overflow-hidden bg-white">
      <div className="flex gap-12 whitespace-nowrap marquee">
        {[...items, ...items, ...items].map((it, i) => (
          <span
            key={i}
            className="text-[12px] tracking-[0.18em] uppercase text-[var(--fg-muted)]"
          >
            {it} <span className="mx-6 text-[var(--line-strong)]">/</span>
          </span>
        ))}
      </div>
    </div>
  );
}
