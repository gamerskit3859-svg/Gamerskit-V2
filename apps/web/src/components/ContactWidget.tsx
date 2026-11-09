"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import {
  Instagram,
  Link2,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import type { ContactChannel, ContactChannelType } from "@/lib/api";
import { cn } from "@/lib/cn";

// Brand colours are hard-coded per channel rather than themed: a green circle
// is how people recognise WhatsApp, and that should not shift with the palette.
const CHANNEL_STYLE: Record<
  ContactChannelType,
  { icon: LucideIcon; className: string }
> = {
  whatsapp: { icon: MessageCircle, className: "bg-[#25D366]" },
  messenger: { icon: MessageSquare, className: "bg-[#0084FF]" },
  telegram: { icon: Send, className: "bg-[#229ED9]" },
  instagram: { icon: Instagram, className: "bg-[#E1306C]" },
  phone: { icon: Phone, className: "bg-neutral-800" },
  email: { icon: Mail, className: "bg-neutral-700" },
  custom: { icon: Link2, className: "bg-neutral-800" },
};

/**
 * The panel grows out of the button it sits above, so it scales from its
 * bottom-right corner rather than simply appearing. Opening is springy and
 * closing is short: a dismissal should never keep the page waiting.
 */
const PANEL_VARIANTS: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 30,
      mass: 0.7,
      delayChildren: 0.04,
      staggerChildren: 0.05,
    },
  },
  exit: { opacity: 0, scale: 0.94, y: 8, transition: { duration: 0.14 } },
};

/** Channels slide in one after another once the panel itself has landed. */
const CHANNEL_VARIANTS: Variants = {
  hidden: { opacity: 0, x: 14 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
  },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

/** Same states without the travel, for visitors who asked for less motion. */
const FADE_VARIANTS: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

/**
 * Floating "get in touch" launcher. Renders nothing at all until the admin has
 * added at least one active channel, so a fresh install shows no empty shell.
 */
export function ContactWidget() {
  const [channels, setChannels] = useState<ContactChannel[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const panelVariants = reduceMotion ? FADE_VARIANTS : PANEL_VARIANTS;
  const channelVariants = reduceMotion ? FADE_VARIANTS : CHANNEL_VARIANTS;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await api.getContactChannels();
        if (!cancelled) setChannels(r.items);
      } catch {
        // A contact widget is never worth breaking a page over.
        if (!cancelled) setChannels([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Escape closes, and so does a click anywhere outside the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  if (channels.length === 0) return null;

  return (
    <div
      ref={panelRef}
      className="pb-safe fixed bottom-5 right-5 z-[70] flex flex-col items-end gap-3"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            id="contact-widget-panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "w-[268px] overflow-hidden rounded-2xl border border-line bg-white/95 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl",
              "origin-bottom-right",
            )}
          >
            <p className="border-b border-line px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-soft">
              Get in touch
            </p>
            <ul className="p-2">
              {channels.map((channel) => {
                const style =
                  CHANNEL_STYLE[channel.type] ?? CHANNEL_STYLE.custom;
                const Icon = style.icon;
                // tel:/mailto: should stay in the current tab; everything else
                // is an outside destination.
                const external = /^https?:/i.test(channel.href);
                return (
                  <motion.li key={channel._id} variants={channelVariants}>
                    <a
                      href={channel.href}
                      target={external ? "_blank" : undefined}
                      rel={external ? "noreferrer" : undefined}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-bg-soft"
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white",
                          style.className,
                        )}
                      >
                        <Icon size={20} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {channel.label}
                        </span>
                        {channel.description && (
                          <span className="block truncate text-xs text-fg-muted">
                            {channel.description}
                          </span>
                        )}
                      </span>
                    </a>
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="contact-widget-panel"
        aria-label={open ? "Close contact options" : "Get in touch"}
        className={cn(
          "flex h-14 w-14 items-center justify-center overflow-hidden rounded-full text-white shadow-[0_12px_30px_rgba(0,0,0,0.28)]",
          "transition-[transform,background-color] duration-200 hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-black/20",
          // Open lifts to a lighter ink rather than a second brand colour, so
          // the state reads as a change without introducing a new hue.
          open ? "bg-neutral-700" : "bg-foreground",
        )}
      >
        {/* The two icons trade places on a spin, so the button reads as one
            control switching state rather than two that swap out. */}
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={open ? "close" : "open"}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.6 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, rotate: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.6 }}
            transition={{ duration: 0.16 }}
            className="flex items-center justify-center"
          >
            {open ? <X size={24} /> : <MessageCircle size={24} />}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}
