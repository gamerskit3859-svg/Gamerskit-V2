"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatBDT, formatDateTime } from "@/lib/format";
import type { Coupon } from "@gamerskit/shared";

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
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const r = await api.listCoupons(token);
        if (!cancelled) setItems(r.items);
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
        setItems((prev) => prev.map((c) => (c._id === editing._id ? r.item : c)));
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
    const r = await api.updateCoupon(c._id, { active: !c.active }, token);
    setItems((prev) => prev.map((x) => (x._id === c._id ? r.item : x)));
  }

  async function remove(c: Coupon) {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    const token = getAdminToken();
    if (!token) return;
    await api.deleteCoupon(c._id, token);
    setItems((prev) => prev.filter((x) => x._id !== c._id));
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
          <h1 className="text-3xl font-semibold tracking-tight mt-2">Coupons</h1>
          <p className="text-sm text-[var(--fg-soft)] mt-1">
            {items.length} coupons · click a row to edit, toggle active, or delete.
          </p>
        </div>
        <button onClick={startCreate} className="btn btn-primary">
          + New coupon
        </button>
      </header>

      <div className="card-soft p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-[var(--fg-muted)]">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-sm text-[var(--fg-muted)] text-center">
            No coupons yet — create your first one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white text-xs text-[var(--fg-soft)] text-left">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Discount</th>
                  <th className="py-3 px-4">Min order</th>
                  <th className="py-3 px-4">Redeemed</th>
                  <th className="py-3 px-4">Window</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c._id} className="hairline-t bg-white">
                    <td className="py-3 px-4 font-mono">{c.code}</td>
                    <td className="py-3 px-4">
                      {c.type === "percent" ? `${c.value}%` : formatBDT(c.value)}
                    </td>
                    <td className="py-3 px-4">{c.minOrder ? formatBDT(c.minOrder) : "—"}</td>
                    <td className="py-3 px-4">
                      {c.redeemed}
                      {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}
                    </td>
                    <td className="py-3 px-4 text-xs text-[var(--fg-muted)]">
                      {c.startsAt ? formatDateTime(c.startsAt) : "any"} →{" "}
                      {c.endsAt ? formatDateTime(c.endsAt) : "any"}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleActive(c)}
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          c.active ? "bg-black text-white" : "bg-[var(--bg-soft)] text-[var(--fg-soft)]"
                        }`}
                      >
                        {c.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right space-x-3">
                      <button onClick={() => startEdit(c)} className="text-xs underline">
                        Edit
                      </button>
                      <button onClick={() => remove(c)} className="text-xs underline text-red-600">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {openCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !busy && setOpenCreate(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl"
            >
              <h2 className="text-xl font-semibold mb-4">
                {editing ? `Edit ${editing.code}` : "New coupon"}
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="eyebrow">Code</label>
                  <input
                    className="input mt-1 uppercase"
                    value={draft.code}
                    onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                    placeholder="WELCOME10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="eyebrow">Type</label>
                    <select
                      className="select mt-1"
                      value={draft.type}
                      onChange={(e) =>
                        setDraft({ ...draft, type: e.target.value as DraftCoupon["type"] })
                      }
                    >
                      <option value="percent">Percent off</option>
                      <option value="fixed">Fixed amount</option>
                    </select>
                  </div>
                  <div>
                    <label className="eyebrow">
                      {draft.type === "percent" ? "Percent off" : "Amount (৳)"}
                    </label>
                    <input
                      type="number"
                      className="input mt-1"
                      value={draft.value}
                      onChange={(e) => setDraft({ ...draft, value: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="eyebrow">Min order (৳)</label>
                    <input
                      type="number"
                      className="input mt-1"
                      value={draft.minOrder}
                      onChange={(e) => setDraft({ ...draft, minOrder: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="eyebrow">Max redemptions</label>
                    <input
                      type="number"
                      className="input mt-1"
                      value={draft.maxRedemptions}
                      onChange={(e) =>
                        setDraft({ ...draft, maxRedemptions: Number(e.target.value) })
                      }
                      placeholder="0 = unlimited"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="eyebrow">Starts</label>
                    <input
                      type="date"
                      className="input mt-1"
                      value={draft.startsAt}
                      onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="eyebrow">Ends</label>
                    <input
                      type="date"
                      className="input mt-1"
                      value={draft.endsAt}
                      onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                  />
                  Active
                </label>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setOpenCreate(false)}
                  className="btn btn-ghost"
                  disabled={busy}
                >
                  Cancel
                </button>
                <button onClick={save} className="btn btn-primary" disabled={busy || !draft.code}>
                  {busy ? "Saving…" : editing ? "Save changes" : "Create coupon"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
