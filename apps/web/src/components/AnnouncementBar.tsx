"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Clock, ShieldCheck, Truck } from "lucide-react";
import { api, type AnnouncementBarSettings } from "@/lib/api";

const DEFAULT_SETTINGS: AnnouncementBarSettings = {
  enabled: true,
  codText: "Full Cash on Delivery",
  deliveryText: "Free Delivery All Over Bangladesh",
  offerText: "Offer ends in",
};

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
  const [settings, setSettings] = useState<AnnouncementBarSettings | null>(
    null,
  );
  const [secondsLeft, setSecondsLeft] = useState(getSecondsUntilReset);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api
      .getAnnouncementBar()
      .then((result) => {
        if (!cancelled) {
          setSettings(result.item);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSettings(DEFAULT_SETTINGS);
          setError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const update = () => setSecondsLeft(getSecondsUntilReset());
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  const timer = useMemo(() => formatDuration(secondsLeft), [secondsLeft]);

  if (pathname?.startsWith("/admin")) return null;

  if (!settings) {
    return <div className="h-[38px] animate-pulse bg-black" />;
  }

  if (!settings.enabled) return null;

  return (
    <div
      className="relative z-10 border-b border-cyan-300/20 bg-[linear-gradient(90deg,#050505,#15151a_45%,#050505)] text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
      role="status"
      aria-live="polite">
      <div className="mx-auto flex min-h-[38px] max-w-[1280px] items-center justify-center gap-3 overflow-hidden px-3 text-[11px] font-semibold uppercase tracking-[0.12em] sm:gap-5 sm:text-xs">
        <span className="flex min-w-0 items-center gap-1.5 text-cyan-100">
          <ShieldCheck size={14} className="shrink-0 text-cyan-300" />
          <span className="truncate">{settings.codText}</span>
        </span>
        <span className="hidden h-4 w-px bg-white/18 sm:block" />
        <span className="hidden min-w-0 items-center gap-1.5 text-lime-100 sm:flex">
          <Truck size={14} className="shrink-0 text-lime-300" />
          <span className="truncate">{settings.deliveryText}</span>
        </span>
        <span className="h-4 w-px bg-white/18" />
        <span className="flex shrink-0 items-center gap-1.5 text-amber-100">
          <Clock size={14} className="text-amber-300" />
          <span className="hidden md:inline">{settings.offerText}</span>
          <span className="font-mono text-[12px] tracking-[0.08em] text-amber-300 sm:text-sm">
            {timer}
          </span>
        </span>
        {error && (
          <span className="sr-only">Announcement settings failed to load.</span>
        )}
      </div>
    </div>
  );
}
