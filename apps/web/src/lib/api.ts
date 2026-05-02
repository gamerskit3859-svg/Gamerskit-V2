/**
 * Thin wrappers around the backend REST API. Both the storefront (Server
 * Components) and admin (Client Components) use these helpers.
 */
import type { Order, Product } from "@gamerskit/shared";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:4000";

async function request<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  if (init?.token) headers.set("authorization", `Bearer ${init.token}`);
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: init?.cache ?? "no-store",
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => null);
    }
    const message = `[api] ${init?.method ?? "GET"} ${path} → ${res.status}`;
    console.error(message, body);
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listProducts: (params: { category?: string; q?: string; featured?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.category) qs.set("category", params.category);
    if (params.q) qs.set("q", params.q);
    if (params.featured) qs.set("featured", "true");
    return request<{ items: Product[] }>(`/api/products?${qs.toString()}`);
  },
  getProduct: (slug: string) =>
    request<{ item: Product }>(`/api/products/${slug}`),
  createOrder: (body: unknown) =>
    request<{ order: Order; eventId: string }>(`/api/orders`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getOrder: (orderNumber: string) =>
    request<{ order: Order }>(`/api/orders/by-number/${orderNumber}`),
  // admin
  listOrdersAdmin: (
    params: {
      from?: string;
      to?: string;
      status?: string;
      source?: string;
      q?: string;
      page?: number;
      limit?: number;
    },
    token: string,
  ) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    });
    return request<{ items: Order[]; total: number; page: number; limit: number }>(
      `/api/orders?${qs.toString()}`,
      { token },
    );
  },
  stats: (params: { from?: string; to?: string }, token: string) => {
    const qs = new URLSearchParams();
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    return request<{
      totalOrders: number;
      revenue: number;
      pendingOrders: number;
      deliveredOrders: number;
      productsSold: number;
      lowStockCount: number;
      statusBreakdown: Record<string, number>;
      revenueByDay: Array<{ _id: string; total: number; orders: number }>;
    }>(`/api/admin/stats?${qs.toString()}`, { token });
  },
  topProducts: (params: { from?: string; to?: string }, token: string) => {
    const qs = new URLSearchParams();
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    return request<{ items: Array<{ _id: string; qty: number; revenue: number }> }>(
      `/api/admin/top-products?${qs.toString()}`,
      { token },
    );
  },
  login: (email: string, password: string) =>
    request<{
      token: string;
      user: { id: string; email: string; role: string; name?: string };
    }>(`/api/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
};
