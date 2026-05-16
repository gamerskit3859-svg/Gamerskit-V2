"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Clock, ShieldCheck, Truck } from "lucide-react";

const COD_TEXT = "Full Cash on Delivery";
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
  const [secondsLeft, setSecondsLeft] = useState(getSecondsUntilReset);

  useEffect(() => {
    const update = () => setSecondsLeft(getSecondsUntilReset());
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  const timer = useMemo(() => formatDuration(secondsLeft), [secondsLeft]);

  if (pathname?.startsWith("/admin")) return null;

  return (
    <div
      className="relative z-10 border-b border-cyan-300/20 bg-[linear-gradient(90deg,#050505,#15151a_45%,#050505)] text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
      role="status"
      aria-live="polite">
      <div className="mx-auto flex min-h-[38px] max-w-[1280px] items-center justify-center gap-3 overflow-hidden px-3 text-[11px] font-semibold uppercase tracking-[0.12em] sm:gap-5 sm:text-xs">
        <span className="flex min-w-0 items-center gap-1.5 text-cyan-100">
          <ShieldCheck size={14} className="shrink-0 text-cyan-300" />
          <span className="truncate">{COD_TEXT}</span>
        </span>
        <span className="hidden h-4 w-px bg-white/18 sm:block" />
        <span className="hidden min-w-0 items-center gap-1.5 text-lime-100 sm:flex">
          <Truck size={14} className="shrink-0 text-lime-300" />
          <span className="truncate">{DELIVERY_TEXT}</span>
        </span>
        <span className="h-4 w-px bg-white/18" />
        <span className="flex shrink-0 items-center gap-1.5 text-amber-100">
          <Clock size={14} className="text-amber-300" />
          <span className="hidden md:inline">{OFFER_TEXT}</span>
          <span className="font-mono text-[12px] tracking-[0.08em] text-amber-300 sm:text-sm">
            {timer}
          </span>
        </span>
      </div>
    </div>
  );
}
