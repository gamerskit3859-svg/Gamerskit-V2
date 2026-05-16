"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatDateTime } from "@/lib/format";
import type { AdminUserSummary, UserRole } from "@/types/shared";
import {
  Button,
  Card,
  FieldLabel,
  Input,
  Select,
} from "@/components/ui";

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
          <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
            Admin
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Staff</h1>
          <p className="mt-1 text-sm text-fg-soft">
            Manage admin and staff accounts that can sign in to this dashboard.
          </p>
        </div>
        <Button onClick={() => setOpenCreate(true)}>+ Invite member</Button>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          className="!w-auto"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole | "all")}
        >
          <option value="all">All roles</option>
          <option value="admin">Admins</option>
          <option value="staff">Staff</option>
          <option value="customer">Customers</option>
        </Select>
        <Input
          className="!ml-auto !w-72"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Card tone="soft" padding="none" className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-fg-muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-fg-muted">
            No users.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="bg-white text-left text-xs text-fg-soft">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr
                    key={u._id}
                    className="border-t border-line bg-white"
                  >
                    <td className="px-4 py-3 font-medium">{u.email}</td>
                    <td className="px-4 py-3 text-fg-soft">{u.name || "—"}</td>
                    <td className="px-4 py-3 text-fg-soft">
                      {u.phone || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        className="!w-auto !py-1 !text-xs"
                        value={u.role}
                        onChange={(e) =>
                          changeRole(u._id, e.target.value as UserRole)
                        }
                      >
                        <option value="customer">Customer</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-muted">
                      {formatDateTime(u.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => remove(u)}
                        className="text-xs text-red-600 underline"
                      >
                        Remove
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
              className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl sm:p-6"
            >
              <h2 className="mb-4 text-xl font-semibold">Invite member</h2>
              <div className="space-y-3">
                <FieldLabel label="Email">
                  <Input
                    type="email"
                    value={draft.email}
                    onChange={(e) =>
                      setDraft({ ...draft, email: e.target.value })
                    }
                  />
                </FieldLabel>
                <FieldLabel label="Name">
                  <Input
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </FieldLabel>
                <FieldLabel label="Phone">
                  <Input
                    value={draft.phone}
                    onChange={(e) =>
                      setDraft({ ...draft, phone: e.target.value })
                    }
                  />
                </FieldLabel>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldLabel label="Role">
                    <Select
                      value={draft.role}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          role: e.target.value as "staff" | "admin",
                        })
                      }
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </Select>
                  </FieldLabel>
                  <FieldLabel label="Temp password">
                    <Input
                      type="text"
                      value={draft.password}
                      onChange={(e) =>
                        setDraft({ ...draft, password: e.target.value })
                      }
                      placeholder="min 6 chars"
                    />
                  </FieldLabel>
                </div>
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
                <Button
                  onClick={createStaff}
                  disabled={busy || !draft.email || draft.password.length < 6}
                >
                  {busy ? "Inviting…" : "Send invite"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
