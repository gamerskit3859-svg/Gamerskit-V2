"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getAdminToken } from "@/lib/admin-token";
import { API_BASE } from "@/lib/api";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/cn";

interface User {
  id: string;
  email: string;
  name: string;
  role: "customer" | "staff" | "admin";
  avatar?: string;
  createdAt: string;
}

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
        const response = await fetch(`${API_BASE}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Failed to load users");
        const data = await response.json();
        setUsers(data.items || []);
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
      const response = await fetch(
        `${API_BASE}/api/admin/users/${userId}/role`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role }),
        },
      );
      if (!response.ok) throw new Error("Failed to update role");
      const data = await response.json();
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, role: data.user.role } : u)),
      );
      setSelectedUser(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div>
      <header className="mb-8">
        <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
          Admin
        </span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Users &amp; Roles
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Manage user roles and permissions
        </p>
      </header>

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
          <div className="overflow-x-auto">
            <table className="w-full">
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
                      key={user.id}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-lg bg-white p-6"
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
                onClick={() => handleRoleChange(selectedUser.id, newRole)}
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
