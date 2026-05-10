import Link from "next/link";

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  linkHref?: string;
  linkLabel?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  linkHref,
  linkLabel,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-10">
      <div>
        <span className="eyebrow block mb-2">{eyebrow}</span>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
          {title}
        </h2>
      </div>
      {linkHref && (
        <Link
          href={linkHref}
          className="text-sm font-medium underline underline-offset-4 hover:opacity-70 transition-opacity">
          {linkLabel ?? "View all"} →
        </Link>
      )}
    </div>
  );
}
