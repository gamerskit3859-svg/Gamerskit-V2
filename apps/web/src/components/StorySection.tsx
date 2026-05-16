import { LinkButton, Section, Card } from "@/components/ui";

export function StorySection() {
  return (
    <Section spacing="md">
      <Card
        tone="soft"
        padding="lg"
        rounded="xl"
        className="flex flex-col items-center text-center md:p-20 lg:p-28"
      >
        <span className="text-sm font-semibold uppercase tracking-widest text-fg-soft">
          The story
        </span>
        <h2 className="mt-4 mx-auto max-w-4xl text-3xl md:text-5xl lg:text-6xl font-bold leading-[1.15] tracking-tight">
          We started building gear for gamers who actually compete.
        </h2>
        <p className="mt-6 mx-auto max-w-xl md:max-w-2xl text-base md:text-lg lg:text-xl leading-relaxed text-fg-soft opacity-90">
          From RC drift sessions at Hatirjheel to LAN nights in Dhanmondi,
          GamersKit is built around the players. Every piece in our catalog is
          sourced, tested, and supported by people who use it.
        </p>
        <LinkButton
          href="/shop"
          variant="primary"
          size="lg"
          className="mt-10 w-full sm:w-auto"
        >
          Start browsing
        </LinkButton>
      </Card>
    </Section>
  );
}
