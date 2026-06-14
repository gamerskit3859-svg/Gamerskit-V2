import Image from "next/image";

export function GlobalLoader() {
  return (
    <div
      className="flex items-center justify-center min-h-screen bg-bg"
      role="status"
      aria-live="polite"
      aria-label="Loading GK Shop"
    >
      <Image
        src="/brand/logo.png"
        alt="GK Shop"
        width={84}
        height={84}
        priority
        className="h-12 object-contain sm:h-20 sm:w-20"
        sizes="80px"
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
}