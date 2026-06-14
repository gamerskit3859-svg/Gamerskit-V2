"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Clock, Truck } from "lucide-react";

const DELIVERY_TEXT = "Free Delivery All Over Bangladesh";
const OFFER_TEXT = "Offer ends in";

function getSecondsUntilReset() {
  const now = new Date();
  const nextReset = new Date(now);
  nextReset.setDate(now.getDate() + 1);
  nextReset.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((nextReset.getTime() - now.getTime()) / 1000));
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function AnnouncementBar() {
  const pathname = usePathname();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setSecondsLeft(getSecondsUntilReset());
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  const timer = useMemo(
    () => (secondsLeft === null ? "00:00:00" : formatDuration(secondsLeft)),
    [secondsLeft],
  );

  if (pathname?.startsWith("/admin")) return null;

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[60] h-10 overflow-hidden border-b border-cyan-300/20 bg-[linear-gradient(90deg,#050505,#15151a_45%,#050505)] text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
      role="status"
      aria-live="polite">
      <div className="mx-auto flex flex-col md:flex-row h-10 max-w-[1280px] flex-nowrap items-center justify-center gap-x-3 overflow-hidden px-3 text-center text-[10px] font-semibold uppercase tracking-[0.08em] sm:gap-x-6 sm:px-4 sm:text-xs sm:tracking-[0.12em]">
        {/* Delivery Segment */}
        <span className="flex items-center justify-center gap-1.5 text-lime-100">
          <Truck size={14} className="shrink-0 text-lime-300" />
          <span>{DELIVERY_TEXT}</span>
        </span>

        {/* Separator Line - Only visible on desktop/tablets where text stays on one line */}
        <span className="hidden h-3 w-px bg-white/20 sm:block" />

        {/* Timer Segment */}
        <span className="flex items-center justify-center gap-1.5 text-amber-100">
          <Clock size={14} className="shrink-0 text-amber-300" />
          <span>{OFFER_TEXT}</span>
          <span className="font-mono text-[12px] tracking-[0.05em] text-amber-300 sm:text-sm">
            {timer}
          </span>
        </span>
      </div>
    </div>
  );
}
