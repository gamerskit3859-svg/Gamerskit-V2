"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { AdminShell } from "@/components/admin/AdminShell";

interface User {
  id: string;
  email: string;
  name: string;
  role: "customer" | "staff" | "admin";
  avatar?: string;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<"customer" | "staff" | "admin">("customer");

  useEffect(() => {
    async function loadUsers() {
      const token = getAdminToken();
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/admin/users`, {
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

  async function handleRoleChange(userId: string, role: "customer" | "staff" | "admin") {
    const token = getAdminToken();
    if (!token) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error("Failed to update role");
      const data = await response.json();
      setUsers(users.map((u) => (u.id === userId ? { ...u, role: data.user.role } : u)));
      setSelectedUser(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <AdminShell>
      <div>
        <header className="mb-8">
          <span className="eyebrow">Admin</span>
          <h1 className="text-3xl font-semibold tracking-tight mt-2">Users & Roles</h1>
          <p className="text-sm text-[var(--fg-soft)] mt-1">Manage user roles and permissions</p>
        </header>

        {error && (
          <div className="card-soft p-4 text-sm text-red-600 mb-6">{error}</div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="card-soft overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--bg-soft)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--fg-soft)] uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--fg-soft)] uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--fg-soft)] uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--fg-soft)] uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-[var(--fg-soft)] uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-[var(--fg-soft)]">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-[var(--fg-soft)]">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-[var(--bg-soft)] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {user.avatar && (
                            <img
                              src={user.avatar}
                              alt={user.name}
                              className="w-8 h-8 rounded-full"
                            />
                          )}
                          <span className="font-medium">{user.name || "Unnamed"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--fg-soft)]">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                            user.role === "admin"
                              ? "bg-red-100 text-red-800"
                              : user.role === "staff"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--fg-soft)]">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
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
        </motion.div>

        {/* Role Change Modal */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg max-w-md w-full p-6"
            >
              <h2 className="text-xl font-semibold mb-4">Change User Role</h2>
              <p className="text-sm text-gray-600 mb-6">
                Update the role for <strong>{selectedUser.email}</strong>
              </p>

              <div className="space-y-3 mb-6">
                {(["customer", "staff", "admin"] as const).map((role) => (
                  <label key={role} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="role"
                      value={role}
                      checked={newRole === role}
                      onChange={(e) => setNewRole(e.target.value as any)}
                      className="w-4 h-4"
                    />
                    <span className="flex-1">
                      <span className="font-medium capitalize">{role}</span>
                      <span className="block text-xs text-gray-500">
                        {role === "customer"
                          ? "Regular customer account"
                          : role === "staff"
                          ? "Can manage inventory and orders"
                          : "Full admin access"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleRoleChange(selectedUser.id, newRole);
                  }}
                  className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Update role
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
