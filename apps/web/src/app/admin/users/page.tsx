"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getAdminToken } from "@/lib/admin-token";
import { api } from "@/lib/api";
import { Button, Card } from "@/components/ui";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { cn } from "@/lib/cn";
import type { AdminUserSummary } from "@/types/shared";

type User = AdminUserSummary & {
  avatar?: string;
};

const ROLE_DESCRIPTIONS: Record<User["role"], string> = {
  customer: "Regular customer account",
  staff: "Can manage inventory and orders",
  admin: "Full admin access",
};

const ROLE_BADGE: Record<User["role"], string> = {
  admin: "bg-red-100 text-red-800",
  staff: "bg-blue-100 text-blue-800",
  customer: "bg-gray-100 text-gray-800",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<User["role"]>("customer");

  useEffect(() => {
    async function loadUsers() {
      const token = getAdminToken();
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const data = await api.users({ role: "all" }, token);
        setUsers((data.items || []) as User[]);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  async function handleRoleChange(userId: string, role: User["role"]) {
    const token = getAdminToken();
    if (!token) return;
    try {
      const data = await api.updateUser(userId, { role }, token);
      setUsers(
        users.map((u) => (u._id === userId ? { ...u, role: data.item.role } : u)),
      );
      setSelectedUser(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title={<>Users &amp; Roles</>}
        description="Manage user roles and permissions"
      />

      {error && (
        <Card
          tone="soft"
          padding="sm"
          className="mb-6 text-sm text-red-600"
        >
          {error}
        </Card>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card tone="soft" padding="none" className="overflow-hidden">
          {/* Below md the table becomes cards: five columns of which two are
              long strings do not fit a phone. */}
          <ul className="divide-y divide-line md:hidden">
            {loading ? (
              <li className="p-6 text-center text-sm text-fg-soft">
                Loading users...
              </li>
            ) : users.length === 0 ? (
              <li className="p-6 text-center text-sm text-fg-soft">
                No users found
              </li>
            ) : (
              users.map((user) => (
                <li key={user._id} className="flex items-center gap-3 p-3">
                  {user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatar}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-soft text-xs font-medium text-fg-soft">
                      {(user.name || user.email || "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {user.name || "Unnamed"}
                    </p>
                    <p className="truncate text-xs text-fg-soft">{user.email}</p>
                    <p className="mt-1 flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          ROLE_BADGE[user.role],
                        )}
                      >
                        {user.role}
                      </span>
                      <span className="text-[11px] text-fg-muted">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUser(user);
                      setNewRole(user.role);
                    }}
                    className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-blue-600"
                  >
                    Role
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[760px] w-full">
              <thead className="border-b border-line bg-bg-soft">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-soft">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-soft">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-soft">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-soft">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-fg-soft">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-sm text-fg-soft"
                    >
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-sm text-fg-soft"
                    >
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user._id}
                      className="transition-colors hover:bg-bg-soft"
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-3">
                          {user.avatar && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={user.avatar}
                              alt={user.name}
                              className="h-8 w-8 rounded-full"
                            />
                          )}
                          <span className="font-medium">
                            {user.name || "Unnamed"}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-fg-soft">
                        {user.email}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={cn(
                            "inline-block rounded-full px-3 py-1 text-xs font-semibold",
                            ROLE_BADGE[user.role],
                          )}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-fg-soft">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUser(user);
                            setNewRole(user.role);
                          }}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          Change role
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 py-6 sm:p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-lg bg-white p-4 sm:p-6"
          >
            <h2 className="mb-4 text-xl font-semibold">Change User Role</h2>
            <p className="mb-6 text-sm text-fg-soft">
              Update the role for <strong>{selectedUser.email}</strong>
            </p>

            <div className="mb-6 space-y-3">
              {(["customer", "staff", "admin"] as const).map((role) => (
                <label
                  key={role}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-line p-3 hover:bg-bg-soft"
                >
                  <input
                    type="radio"
                    name="role"
                    value={role}
                    checked={newRole === role}
                    onChange={(e) =>
                      setNewRole(e.target.value as User["role"])
                    }
                    className="h-4 w-4"
                  />
                  <span className="flex-1">
                    <span className="font-medium capitalize">{role}</span>
                    <span className="block text-xs text-fg-muted">
                      {ROLE_DESCRIPTIONS[role]}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setSelectedUser(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleRoleChange(selectedUser._id, newRole)}
                className="flex-1"
              >
                Update role
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
