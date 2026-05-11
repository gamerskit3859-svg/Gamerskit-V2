/**
 * Thin wrappers around the backend REST API. Both the storefront (Server
 * Components) and admin (Client Components) use these helpers.
 */
import type {
  AdminCustomer,
  AdminUserSummary,
  AuthUser,
  Coupon,
  NotificationItem,
  Order,
  Product,
  UserRole,
} from "@/types/shared";

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
    const err = new Error(message) as Error & { status?: number; body?: unknown };
    err.status = res.status;
    err.body = body;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, unknown>) => {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== null) u.set(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : "";
};

export const api = {
  // === Public ===
  listProducts: (params: { category?: string; q?: string; featured?: boolean; page?: number; limit?: number } = {}) =>
    request<{ items: Product[]; total: number; page: number; limit: number; totalPages: number; hasMore: boolean }>(`/api/products${qs(params)}`),
  getProduct: (slug: string) => request<{ item: Product }>(`/api/products/${slug}`),
  listCategories: () =>
    request<{ items: any[] }>(`/api/categories`),
  getCategory: (idOrSlug: string) =>
    request<{ item: any }>(`/api/categories/${idOrSlug}`),
  createOrder: (body: unknown, token?: string) =>
    request<{ order: Order; eventId: string }>(`/api/orders`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    }),
  getOrder: (orderNumber: string) => request<{ order: Order }>(`/api/orders/by-number/${orderNumber}`),
  getOrdersByPhone: (phone: string) => request<{ orders: Order[] }>(`/api/orders/by-phone/${phone}`),
  validateCoupon: (code: string, subtotal: number) =>
    request<{ coupon: { code: string; type: "percent" | "fixed"; value: number; discount: number } }>(
      `/api/coupons/validate`,
      { method: "POST", body: JSON.stringify({ code, subtotal }) },
    ),

  // === Customer auth ===
  register: (body: { email: string; password: string; name?: string; phone?: string }) =>
    request<{ token: string; user: AuthUser }>(`/api/auth/register`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>(`/api/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  loginGoogle: (body: { email: string; name: string; avatar?: string; providerId: string }) =>
    request<{ token: string; user: AuthUser }>(`/api/auth/oauth/google`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  loginFacebook: (body: { email: string; name: string; avatar?: string; providerId: string }) =>
    request<{ token: string; user: AuthUser }>(`/api/auth/oauth/facebook`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: (token: string) => request<{ user: AuthUser }>(`/api/auth/me`, { token }),
  myOrders: (token: string) => request<{ items: Order[] }>(`/api/auth/orders`, { token }),

  // === Admin ===
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
  ) =>
    request<{ items: Order[]; total: number; page: number; limit: number }>(
      `/api/orders${qs(params)}`,
      { token },
    ),
  getOrderAdmin: (id: string, token: string) =>
    request<{ order: Order }>(`/api/orders/${id}`, { token }),
  updateOrder: (id: string, body: Partial<Order>, token: string) =>
    request<{ order: Order }>(`/api/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      token,
    }),

  stats: (params: { from?: string; to?: string }, token: string) =>
    request<{
      totalOrders: number;
      revenue: number;
      pendingOrders: number;
      deliveredOrders: number;
      productsSold: number;
      lowStockCount: number;
      newCustomers: number;
      grossRevenue: number;
      grossCost: number;
      grossProfit: number;
      statusBreakdown: Record<string, number>;
      revenueByDay: Array<{ _id: string; total: number; orders: number }>;
    }>(`/api/admin/stats${qs(params)}`, { token }),
  topProducts: (params: { from?: string; to?: string }, token: string) =>
    request<{ items: Array<{ _id: string; qty: number; revenue: number }> }>(
      `/api/admin/top-products${qs(params)}`,
      { token },
    ),
  reports: (params: { from?: string; to?: string }, token: string) =>
    request<{
      byCategory: Array<{ _id: string; qty: number; revenue: number }>;
      byPayment: Array<{ _id: string; count: number; revenue: number }>;
      bySource: Array<{ _id: string; count: number; revenue: number }>;
      aov: number;
      orderCount: number;
      repeatBuyers: number;
      grossRevenue: number;
      grossCost: number;
      grossProfit: number;
      grossMargin: number;
      transactions: Array<{
        _id: string;
        orderNumber: string;
        total: number;
        status: string;
        paymentMethod: string;
        customer?: { name?: string };
        createdAt: string;
      }>;
    }>(`/api/admin/reports${qs(params)}`, { token }),
  getAccounting: (params: { from: string; to: string }, token: string) =>
    request<{
      item: {
        rangeKey: string;
        shippingCharged: number;
        refunds: number;
        shippingExpense: number;
        ads: number;
        salaries: number;
        other: number;
        customExpenses: Array<{ id: string; label: string; value: number }>;
        notes: string;
        updatedAt: string | null;
      };
    }>(`/api/admin/accounting${qs(params)}`, { token }),
  saveAccounting: (
    params: { from: string; to: string },
    body: Partial<{
      shippingCharged: number;
      refunds: number;
      shippingExpense: number;
      ads: number;
      salaries: number;
      other: number;
      customExpenses: Array<{ id: string; label: string; value: number }>;
      notes: string;
    }>,
    token: string,
  ) =>
    request<{ item: unknown }>(`/api/admin/accounting${qs(params)}`, {
      method: "PUT",
      body: JSON.stringify(body),
      token,
    }),
  recentOrders: (token: string) =>
    request<{ items: Order[] }>(`/api/admin/recent-orders`, { token }),
  notifications: (token: string) =>
    request<{ items: NotificationItem[] }>(`/api/admin/notifications`, { token }),

  // Inventory
  adjustStock: (id: string, delta: number, token: string) =>
    request<{ item: Product }>(`/api/admin/products/${id}/stock`, {
      method: "POST",
      body: JSON.stringify({ delta }),
      token,
    }),
  updateProduct: (id: string, body: Partial<Product>, token: string) =>
    request<{ item: Product }>(`/api/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      token,
    }),
  createProduct: (body: Partial<Product>, token: string) =>
    request<{ item: Product }>(`/api/products`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    }),
  deleteProduct: (id: string, token: string) =>
    request<void>(`/api/products/${id}`, { method: "DELETE", token }),

  // Categories
  createCategory: (body: Partial<any>, token: string) =>
    request<{ item: any }>(`/api/categories`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    }),
  updateCategory: (id: string, body: Partial<any>, token: string) =>
    request<{ item: any }>(`/api/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      token,
    }),
  deleteCategory: (id: string, token: string) =>
    request<void>(`/api/categories/${id}`, { method: "DELETE", token }),

  // Customers
  customers: (params: { q?: string; page?: number; limit?: number }, token: string) =>
    request<{ items: AdminCustomer[]; total: number }>(`/api/admin/customers${qs(params)}`, {
      token,
    }),

  // Staff & users
  users: (params: { role?: UserRole | "all"; q?: string }, token: string) =>
    request<{ items: AdminUserSummary[] }>(`/api/admin/users${qs(params)}`, { token }),
  createUser: (
    body: { email: string; password: string; name?: string; phone?: string; role: "staff" | "admin" },
    token: string,
  ) =>
    request<{ item: AdminUserSummary }>(`/api/admin/users`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    }),
  updateUser: (id: string, body: Partial<AdminUserSummary> & { password?: string }, token: string) =>
    request<{ item: AdminUserSummary }>(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      token,
    }),
  deleteUser: (id: string, token: string) =>
    request<void>(`/api/admin/users/${id}`, { method: "DELETE", token }),

  // Coupons
  listCoupons: (token: string) => request<{ items: Coupon[] }>(`/api/admin/coupons`, { token }),
  createCoupon: (body: Partial<Coupon>, token: string) =>
    request<{ item: Coupon }>(`/api/admin/coupons`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    }),
  updateCoupon: (id: string, body: Partial<Coupon>, token: string) =>
    request<{ item: Coupon }>(`/api/admin/coupons/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      token,
    }),
  deleteCoupon: (id: string, token: string) =>
    request<void>(`/api/admin/coupons/${id}`, { method: "DELETE", token }),

  // Hero Images
  getHeroImages: () => request<{ items: any[] }>(`/api/hero-images`),
  listHeroImagesAdmin: (token: string) =>
    request<{ items: any[] }>(`/api/hero-images/admin/all`, { token }),
  createHeroImage: (
    body: { imageUrl: string; publicId: string; order?: number; isActive?: boolean; title?: string; subtitle?: string; link?: string },
    token: string,
  ) =>
    request<{ item: any }>(`/api/hero-images`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    }),
  updateHeroImage: (
    id: string,
    body: Partial<{ imageUrl: string; order: number; isActive: boolean; title: string; subtitle: string; link: string }>,
    token: string,
  ) =>
    request<{ item: any }>(`/api/hero-images/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      token,
    }),
  deleteHeroImage: (id: string, token: string) =>
    request<void>(`/api/hero-images/${id}`, { method: "DELETE", token }),
  reorderHeroImages: (
    order: Array<{ id: string; order: number }>,
    token: string,
  ) =>
    request<{ items: any[] }>(`/api/hero-images/reorder`, {
      method: "POST",
      body: JSON.stringify({ order }),
      token,
    }),
};
