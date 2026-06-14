import { LinkButton, Section, Card } from "@/components/ui";

export function StorySection() {
  return (
    <Section spacing="md" className="px-4 sm:px-6">
      <Card
        tone="soft"
        padding="none" // Managed via responsive padding in className for precision
        rounded="xl"
        className="flex flex-col items-center text-center p-8 sm:p-12 md:p-16 lg:p-20">
        <span className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-fg-soft">
          The story
        </span>

        <h2 className="mt-4 mx-auto max-w-4xl text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold leading-[1.2] md:leading-[1.15] tracking-tight">
          Two things we take seriously, RC cars and the gadget in your pocket.
        </h2>

        <p className="mt-4 sm:mt-6 mx-auto max-w-xl md:max-w-2xl text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed text-fg-soft opacity-90">
          From RC drift sessions at Hatirjheel to weekend crawlers in
          Chattogram, GK Shop is built around the users. Every piece in our
          catalog is sourced, tested, and supported by people who use it
        </p>

        <LinkButton
          href="/shop"
          variant="primary"
          size="lg"
          className="mt-8 sm:mt-10 w-full sm:w-auto justify-center">
          Start browsing
        </LinkButton>
      </Card>
    </Section>
  );
}
