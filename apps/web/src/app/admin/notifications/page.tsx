"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bell, Box, ShoppingBag, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatDateTime } from "@/lib/format";
import type { NotificationItem, NotificationType } from "@gamerskit/shared";

const TYPES: Array<{ key: NotificationType | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "order", label: "Orders" },
  { key: "low_stock", label: "Low stock" },
  { key: "signup", label: "Sign-ups" },
];

const READ_KEY = "gk-notif-read";

function getReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(READ_KEY, JSON.stringify(Array.from(ids)));
}

function iconFor(type: NotificationType) {
  if (type === "order") return <ShoppingBag size={16} />;
  if (type === "low_stock") return <Box size={16} />;
  if (type === "signup") return <UserPlus size={16} />;
  return <Bell size={16} />;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<NotificationType | "all">("all");
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadIds());
  const [loading, setLoading] = useState(true);

  async function reload() {
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    try {
      const r = await api.notifications(token);
      setItems(r.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const token = getAdminToken();
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const r = await api.notifications(token);
        if (!cancelled) setItems(r.items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () => items.filter((n) => filter === "all" || n.type === filter),
    [items, filter],
  );
  const unreadCount = useMemo(() => items.filter((n) => !readIds.has(n.id)).length, [
    items,
    readIds,
  ]);

  function markRead(id: string) {
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    saveReadIds(next);
  }

  function markAllRead() {
    const next = new Set(items.map((n) => n.id));
    setReadIds(next);
    saveReadIds(next);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Admin</span>
          <h1 className="text-3xl font-semibold tracking-tight mt-2">Notifications</h1>
          <p className="text-sm text-[var(--fg-soft)] mt-1">
            {items.length} events · {unreadCount} unread (last 14 days).
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={reload} className="btn btn-ghost">
            Refresh
          </button>
          <button onClick={markAllRead} className="btn btn-primary" disabled={unreadCount === 0}>
            Mark all read
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 mb-4">
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`btn !py-2 !px-4 text-xs ${
              filter === t.key ? "btn-primary" : "btn-ghost"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card-soft divide-y divide-[var(--line)] overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-[var(--fg-muted)]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-sm text-[var(--fg-muted)] text-center">
            Nothing here. You&rsquo;re all caught up.
          </div>
        ) : (
          filtered.map((n) => {
            const isRead = readIds.has(n.id);
            const body = (
              <div className="flex items-start gap-4 p-4">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    n.type === "low_stock"
                      ? "bg-yellow-100 text-yellow-700"
                      : n.type === "signup"
                        ? "bg-green-100 text-green-700"
                        : "bg-[var(--bg-soft)]"
                  }`}
                >
                  {iconFor(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm ${isRead ? "text-[var(--fg-soft)]" : "font-medium"}`}>
                    {n.title}
                  </div>
                  <div className="text-xs text-[var(--fg-muted)] mt-0.5">{n.body}</div>
                </div>
                <div className="text-xs text-[var(--fg-muted)] flex-shrink-0">
                  {formatDateTime(n.at)}
                </div>
                {!isRead && <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />}
              </div>
            );
            return n.href ? (
              <Link
                key={n.id}
                href={n.href}
                className="block bg-white hover:bg-[var(--bg-soft)] transition-colors"
                onClick={() => markRead(n.id)}
              >
                {body}
              </Link>
            ) : (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className="w-full text-left bg-white hover:bg-[var(--bg-soft)] transition-colors"
              >
                {body}
              </button>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
