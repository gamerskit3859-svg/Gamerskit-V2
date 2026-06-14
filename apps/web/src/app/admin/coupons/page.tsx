"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatBDT, formatDateTime } from "@/lib/format";
import type { Coupon } from "@/types/shared";
import {
  Button,
  Card,
  FieldLabel,
  Input,
  Select,
} from "@/components/ui";
import { cn } from "@/lib/cn";

interface DraftCoupon {
  code: string;
  type: "percent" | "fixed";
  value: number;
  minOrder: number;
  maxRedemptions: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

const blankDraft = (): DraftCoupon => ({
  code: "",
  type: "percent",
  value: 10,
  minOrder: 0,
  maxRedemptions: 0,
  startsAt: "",
  endsAt: "",
  active: true,
});

export default function CouponsPage() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [draft, setDraft] = useState<DraftCoupon>(blankDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = getAdminToken();
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!token) throw new Error("Admin token not found. Please login again.");
        const r = await api.listCoupons(token);
        if (!cancelled) setItems(r.items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load coupons.");
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

  function startEdit(c: Coupon) {
    setEditing(c);
    setDraft({
      code: c.code,
      type: c.type,
      value: c.value,
      minOrder: c.minOrder ?? 0,
      maxRedemptions: c.maxRedemptions ?? 0,
      startsAt: c.startsAt ? c.startsAt.slice(0, 10) : "",
      endsAt: c.endsAt ? c.endsAt.slice(0, 10) : "",
      active: c.active,
    });
    setOpenCreate(true);
  }

  function startCreate() {
    setEditing(null);
    setDraft(blankDraft());
    setError(null);
    setOpenCreate(true);
  }

  async function save() {
    const token = getAdminToken();
    if (!token) return;
    setBusy(true);
    setError(null);
    const body = {
      code: draft.code.trim().toUpperCase(),
      type: draft.type,
      value: Number(draft.value),
      minOrder: Number(draft.minOrder) || undefined,
      maxRedemptions: Number(draft.maxRedemptions) || undefined,
      startsAt: draft.startsAt || undefined,
      endsAt: draft.endsAt || undefined,
      active: draft.active,
    };
    try {
      if (editing) {
        const r = await api.updateCoupon(editing._id, body, token);
        setItems((prev) =>
          prev.map((c) => (c._id === editing._id ? r.item : c)),
        );
      } else {
        const r = await api.createCoupon(body, token);
        setItems((prev) => [r.item, ...prev]);
      }
      setOpenCreate(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(c: Coupon) {
    const token = getAdminToken();
    if (!token) return;
    setError(null);
    try {
      const r = await api.updateCoupon(c._id, { active: !c.active }, token);
      setItems((prev) => prev.map((x) => (x._id === c._id ? r.item : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update coupon.");
    }
  }

  async function remove(c: Coupon) {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    const token = getAdminToken();
    if (!token) return;
    setError(null);
    try {
      await api.deleteCoupon(c._id, token);
      setItems((prev) => prev.filter((x) => x._id !== c._id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete coupon.");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
            Admin
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Coupons
          </h1>
          <p className="mt-1 text-sm text-fg-soft">
            {items.length} coupons · click a row to edit, toggle active, or
            delete.
          </p>
        </div>
        <Button onClick={startCreate}>+ New coupon</Button>
      </header>

      {error && !openCreate && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card tone="soft" padding="none" className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-fg-muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-fg-muted">
            No coupons yet — create your first one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[820px] w-full text-sm">
              <thead className="bg-white text-left text-xs text-fg-soft">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Discount</th>
                  <th className="px-4 py-3">Min order</th>
                  <th className="px-4 py-3">Redeemed</th>
                  <th className="px-4 py-3">Window</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr
                    key={c._id}
                    className="border-t border-line bg-white"
                  >
                    <td className="px-4 py-3 font-mono">{c.code}</td>
                    <td className="px-4 py-3">
                      {c.type === "percent"
                        ? `${c.value}%`
                        : formatBDT(c.value)}
                    </td>
                    <td className="px-4 py-3">
                      {c.minOrder ? formatBDT(c.minOrder) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {c.redeemed}
                      {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-muted">
                      {c.startsAt ? formatDateTime(c.startsAt) : "any"} →{" "}
                      {c.endsAt ? formatDateTime(c.endsAt) : "any"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleActive(c)}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          c.active
                            ? "bg-black text-white"
                            : "bg-bg-soft text-fg-soft",
                        )}
                      >
                        {c.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="space-x-3 px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="text-xs underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(c)}
                        className="text-xs text-red-600 underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AnimatePresence>
        {openCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-3 py-6 backdrop-blur-sm sm:p-4"
            onClick={() => !busy && setOpenCreate(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl sm:p-6"
            >
              <h2 className="mb-4 text-xl font-semibold">
                {editing ? `Edit ${editing.code}` : "New coupon"}
              </h2>
              <div className="space-y-3">
                <FieldLabel label="Code">
                  <Input
                    className="uppercase"
                    value={draft.code}
                    onChange={(e) =>
                      setDraft({ ...draft, code: e.target.value })
                    }
                    placeholder="WELCOME10"
                  />
                </FieldLabel>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldLabel label="Type">
                    <Select
                      value={draft.type}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          type: e.target.value as DraftCoupon["type"],
                        })
                      }
                    >
                      <option value="percent">Percent off</option>
                      <option value="fixed">Fixed amount</option>
                    </Select>
                  </FieldLabel>
                  <FieldLabel
                    label={
                      draft.type === "percent" ? "Percent off" : "Amount (৳)"
                    }
                  >
                    <Input
                      type="number"
                      value={draft.value}
                      onChange={(e) =>
                        setDraft({ ...draft, value: Number(e.target.value) })
                      }
                    />
                  </FieldLabel>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldLabel label="Min order (৳)">
                    <Input
                      type="number"
                      value={draft.minOrder}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          minOrder: Number(e.target.value),
                        })
                      }
                    />
                  </FieldLabel>
                  <FieldLabel label="Max redemptions">
                    <Input
                      type="number"
                      value={draft.maxRedemptions}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          maxRedemptions: Number(e.target.value),
                        })
                      }
                      placeholder="0 = unlimited"
                    />
                  </FieldLabel>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldLabel label="Starts">
                    <Input
                      type="date"
                      value={draft.startsAt}
                      onChange={(e) =>
                        setDraft({ ...draft, startsAt: e.target.value })
                      }
                    />
                  </FieldLabel>
                  <FieldLabel label="Ends">
                    <Input
                      type="date"
                      value={draft.endsAt}
                      onChange={(e) =>
                        setDraft({ ...draft, endsAt: e.target.value })
                      }
                    />
                  </FieldLabel>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(e) =>
                      setDraft({ ...draft, active: e.target.checked })
                    }
                  />
                  Active
                </label>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setOpenCreate(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button onClick={save} disabled={busy || !draft.code}>
                  {busy
                    ? "Saving…"
                    : editing
                      ? "Save changes"
                      : "Create coupon"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
