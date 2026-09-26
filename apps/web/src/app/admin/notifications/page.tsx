"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bell, Box, ShoppingBag, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatDateTime } from "@/lib/format";
import type { NotificationItem, NotificationType } from "@/types/shared";
import { Button, Card } from "@/components/ui";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { cn } from "@/lib/cn";

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
    return new Set(
      JSON.parse(localStorage.getItem(READ_KEY) ?? "[]") as string[],
    );
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

function iconBg(type: NotificationType): string {
  if (type === "low_stock") return "bg-yellow-100 text-yellow-700";
  if (type === "signup") return "bg-green-100 text-green-700";
  return "bg-bg-soft";
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<NotificationType | "all">("all");
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadIds());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api.notifications(token);
      setItems(r.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const token = getAdminToken();
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!token) throw new Error("Admin token not found. Please login again.");
        const r = await api.notifications(token);
        if (!cancelled) setItems(r.items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load notifications.");
          setItems([]);
        }
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
  const unreadCount = useMemo(
    () => items.filter((n) => !readIds.has(n.id)).length,
    [items, readIds],
  );

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
      <AdminPageHeader
        title="Notifications"
        description={`${items.length} events · ${unreadCount} unread (last 14 days).`}
        actions={
          <>
            <Button variant="ghost" onClick={reload}>
              Refresh
            </Button>
            <Button onClick={markAllRead} disabled={unreadCount === 0}>
              Mark all read
            </Button>
          </>
        }
      />

      {/* Scrolls sideways rather than wrapping: four tabs on two rows waste a
          row of a phone screen. */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
        {TYPES.map((t) => (
          <Button
            key={t.key}
            size="sm"
            className="!shrink-0"
            variant={filter === t.key ? "primary" : "ghost"}
            aria-pressed={filter === t.key}
            onClick={() => setFilter(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card
        tone="soft"
        padding="none"
        className="divide-y divide-line overflow-hidden"
      >
        {loading ? (
          <div className="p-8 text-sm text-fg-muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-fg-muted">
            Nothing here. You&rsquo;re all caught up.
          </div>
        ) : (
          filtered.map((n) => {
            const isRead = readIds.has(n.id);
            const body = (
              <div className="flex items-start gap-3 p-3 sm:gap-4 sm:p-4">
                <div
                  className={cn(
                    "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
                    iconBg(n.type),
                  )}
                >
                  {iconFor(n.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "text-sm",
                      isRead ? "text-fg-soft" : "font-medium",
                    )}
                  >
                    {n.title}
                  </div>
                  <div className="mt-0.5 text-xs text-fg-muted">{n.body}</div>
                  {/* On a phone the timestamp sits under the text instead of
                      taking width away from it. */}
                  <div className="mt-1 text-[11px] text-fg-muted sm:hidden">
                    {formatDateTime(n.at)}
                  </div>
                </div>
                <div className="hidden flex-shrink-0 text-xs text-fg-muted sm:block">
                  {formatDateTime(n.at)}
                </div>
                {!isRead && (
                  <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                )}
              </div>
            );
            return n.href ? (
              <Link
                key={n.id}
                href={n.href}
                className="block bg-white transition-colors hover:bg-bg-soft"
                onClick={() => markRead(n.id)}
              >
                {body}
              </Link>
            ) : (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead(n.id)}
                className="w-full bg-white text-left transition-colors hover:bg-bg-soft"
              >
                {body}
              </button>
            );
          })
        )}
      </Card>
    </motion.div>
  );
}
