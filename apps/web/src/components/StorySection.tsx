// components/StorySection.tsx
import Link from "next/link";

export function StorySection() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto py-10 md:py-16">
      <div className="card-soft rounded-[2rem] md:rounded-[var(--radius-xl)] p-8 md:p-20 lg:p-28 flex flex-col items-center text-center">
        <span className="eyebrow text-sm tracking-widest uppercase font-semibold">
          The story
        </span>
        <h2 className="mt-4 mx-auto max-w-4xl text-3xl md:text-5xl lg:text-6xl font-bold leading-[1.15]">
          We started building gear for gamers who actually compete.
        </h2>
        <p className="mt-6 mx-auto max-w-xl md:max-w-2xl text-[var(--fg-soft)] text-base md:text-lg lg:text-xl opacity-90 leading-relaxed">
          From RC drift sessions at Hatirjheel to LAN nights in Dhanmondi, 
          GamersKit is built around the players. Every piece in our catalog is 
          sourced, tested, and supported by people who use it.
        </p>
        <div className="mt-10 w-full sm:w-auto">
          <Link href="/shop" className="btn btn-primary inline-block w-full sm:w-auto px-10 py-4 text-lg">
            Start browsing
          </Link>
        </div>
      </div>
    </section>
  );
}