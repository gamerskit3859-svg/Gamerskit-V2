"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatDateTime } from "@/lib/format";
import type { AdminUserSummary, UserRole } from "@gamerskit/shared";

export default function StaffPage() {
  const [items, setItems] = useState<AdminUserSummary[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<UserRole | "all">("all");
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [draft, setDraft] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    role: "staff" as "staff" | "admin",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = getAdminToken();
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const r = await api.users(
          { role: role === "all" ? undefined : role, q: q || undefined },
          token,
        );
        if (!cancelled) setItems(r.items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, role]);

  async function changeRole(id: string, newRole: UserRole) {
    const token = getAdminToken();
    if (!token) return;
    const r = await api.updateUser(id, { role: newRole }, token);
    setItems((prev) => prev.map((u) => (u._id === id ? r.item : u)));
  }

  async function remove(u: AdminUserSummary) {
    if (!confirm(`Remove ${u.email}?`)) return;
    const token = getAdminToken();
    if (!token) return;
    try {
      await api.deleteUser(u._id, token);
      setItems((prev) => prev.filter((x) => x._id !== u._id));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function createStaff() {
    const token = getAdminToken();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.createUser(draft, token);
      setItems((prev) => [r.item, ...prev]);
      setOpenCreate(false);
      setDraft({ email: "", password: "", name: "", phone: "", role: "staff" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
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
          <span className="eyebrow">Admin</span>
          <h1 className="text-3xl font-semibold tracking-tight mt-2">Staff</h1>
          <p className="text-sm text-[var(--fg-soft)] mt-1">
            Manage admin and staff accounts that can sign in to this dashboard.
          </p>
        </div>
        <button onClick={() => setOpenCreate(true)} className="btn btn-primary">
          + Invite member
        </button>
      </header>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="select !w-auto"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole | "all")}
        >
          <option value="all">All roles</option>
          <option value="admin">Admins</option>
          <option value="staff">Staff</option>
          <option value="customer">Customers</option>
        </select>
        <input
          className="input !w-72 !ml-auto"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="card-soft p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-[var(--fg-muted)]">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-sm text-[var(--fg-muted)] text-center">No users.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white text-xs text-[var(--fg-soft)] text-left">
                <tr>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u._id} className="hairline-t bg-white">
                    <td className="py-3 px-4 font-medium">{u.email}</td>
                    <td className="py-3 px-4 text-[var(--fg-soft)]">{u.name || "—"}</td>
                    <td className="py-3 px-4 text-[var(--fg-soft)]">{u.phone || "—"}</td>
                    <td className="py-3 px-4">
                      <select
                        className="select !w-auto !py-1 !text-xs"
                        value={u.role}
                        onChange={(e) => changeRole(u._id, e.target.value as UserRole)}
                      >
                        <option value="customer">Customer</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-xs text-[var(--fg-muted)]">
                      {formatDateTime(u.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => remove(u)} className="text-xs underline text-red-600">
                        Remove
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
              className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl"
            >
              <h2 className="text-xl font-semibold mb-4">Invite member</h2>
              <div className="space-y-3">
                <div>
                  <label className="eyebrow">Email</label>
                  <input
                    type="email"
                    className="input mt-1"
                    value={draft.email}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="eyebrow">Name</label>
                  <input
                    className="input mt-1"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="eyebrow">Phone</label>
                  <input
                    className="input mt-1"
                    value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="eyebrow">Role</label>
                    <select
                      className="select mt-1"
                      value={draft.role}
                      onChange={(e) =>
                        setDraft({ ...draft, role: e.target.value as "staff" | "admin" })
                      }
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="eyebrow">Temp password</label>
                    <input
                      className="input mt-1"
                      type="text"
                      value={draft.password}
                      onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                      placeholder="min 6 chars"
                    />
                  </div>
                </div>
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
                <button
                  onClick={createStaff}
                  className="btn btn-primary"
                  disabled={busy || !draft.email || draft.password.length < 6}
                >
                  {busy ? "Inviting…" : "Send invite"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
