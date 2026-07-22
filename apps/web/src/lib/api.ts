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

const AUTH_TOKEN_STORAGE_KEY = "gk_auth_token";

function storedAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

/**
 * Resolve the API base URL. In local development, default to the local API.
 * On Vercel, never return localhost or throw during module import; an import
 * time error crashes every server-rendered route before page-level fallbacks
 * can run.
 */
function resolveApiBase(): string {
  // Server-side (SSR/RSC): INTERNAL_API_URL lets the Next.js container talk
  // directly to the API service over the Docker-internal network instead of
  // routing through nginx on `localhost` (which is unreachable inside the container).
  if (typeof window === "undefined" && process.env.INTERNAL_API_URL) {
    return process.env.INTERNAL_API_URL.trim().replace(/\/+$/, "");
  }

  const candidates = [
    process.env.NEXT_PUBLIC_API_URL ??
      "",
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
    process.env.API_URL ?? "",
  ]
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const isVercelProd =
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview";
  const isDeployedBrowser =
    typeof window !== "undefined" &&
    !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  const isLocalhost = (value: string) =>
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(value);

  if (isVercelProd || isDeployedBrowser) {
    return (
      candidates.find((value) => !isLocalhost(value)) ||
      "https://gamerskit-backend.vercel.app"
    );
  }

  return candidates[0] || "http://localhost:4000";
}

export const API_BASE = resolveApiBase();

export interface CategoryItem {
  _id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  icon: string;
  parentId: string | null;
  featured: boolean;
  order: number;
  active: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
  subcategories?: CategoryItem[];
}

export interface HeroImageItem {
  _id: string;
  imageUrl: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  publicId: string;
  order: number;
  isActive: boolean;
  title: string;
  subtitle: string;
  link: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShopBannerItem {
  _id: string;
  imageUrl: string;
  publicId: string;
  order: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Portfolio CMS (hidden /admin/gooblique section). */
export interface GoobliqueHero {
  title: string;
  subtitle: string;
  media: { type: "image" | "video"; url: string } | null;
}

export interface DemoVideoItem {
  _id: string;
  title: string;
  video: {
    url: string;
    key: string;
  };
  orientation: "portrait" | "landscape";
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface SteadfastStatusResponse {
  item: unknown;
  order?: Order;
}

type ProductListParams = {
  category?: string;
  q?: string;
  featured?: boolean;
  isFeatured?: boolean;
  bestSelling?: boolean;
  isBestSelling?: boolean;
  newArrival?: boolean;
  isNewArrival?: boolean;
  page?: number;
  limit?: number;
};

type AdminProductListParams = ProductListParams & {
  stock?: "low" | "out";
};

async function request<T>(
  path: string,
  init?: RequestInit & {
    token?: string;
    next?: { revalidate?: number };
    timeoutMs?: number;
  },
): Promise<T> {
  const headers = new Headers(init?.headers);
  // Multipart uploads must keep the browser-generated content-type, which
  // carries the boundary — setting it by hand makes the body unparseable.
  if (!(init?.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  const authToken =
    init?.token && init.token !== "cookie-session" ? init.token : storedAuthToken();
  if (authToken && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${authToken}`);
  }
  const cache = init?.cache ?? "no-store";
  const timeoutMs = init?.timeoutMs ?? 12_000;
  const controller =
    !init?.signal && timeoutMs > 0 ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      cache,
      credentials: "include",
      signal: init?.signal ?? controller?.signal,
    });
  } catch (cause) {
    const err = new Error(
      `[api] ${init?.method ?? "GET"} ${path} failed. Is the API running at ${API_BASE}?`,
    ) as Error & { cause?: unknown };
    err.cause = cause;
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => null);
    }
    const message = `[api] ${init?.method ?? "GET"} ${path} → ${res.status}`;
    if (process.env.NODE_ENV !== "production") {
      console.error(message, body);
    }
    const err = new Error(message) as Error & { status?: number; body?: unknown };
    err.status = res.status;
    err.body = body;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** A 100MB video on a slow uplink needs far longer than the 12s default. */
const UPLOAD_TIMEOUT_MS = 10 * 60_000;

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
  listProducts: (params: ProductListParams = {}) =>
    request<{ items: Product[]; total: number; page: number; limit: number; totalPages: number; hasMore: boolean }>(`/api/products${qs(params)}`, {
      cache: "no-store",
    }),
  listProductsFresh: (params: ProductListParams = {}) =>
    request<{ items: Product[]; total: number; page: number; limit: number; totalPages: number; hasMore: boolean }>(
      `/api/products${qs(params)}`,
      { cache: "no-store" },
    ),
  getProduct: (slug: string) =>
    request<{ item: Product }>(`/api/products/${slug}`, {
      cache: "no-store",
    }),
  listCategories: () =>
    request<{ items: CategoryItem[] }>(`/api/categories`, {
      cache: "no-store",
      timeoutMs: 8_000,
    }),
  listCategoriesFresh: () =>
    request<{ items: CategoryItem[] }>(`/api/categories`, {
      cache: "no-store",
      timeoutMs: 8_000,
    }),
  getCategory: (idOrSlug: string) =>
    request<{ item: CategoryItem }>(`/api/categories/${idOrSlug}`, {
      cache: "no-store",
    }),
  getCategoryFresh: (idOrSlug: string) =>
    request<{ item: CategoryItem }>(`/api/categories/${idOrSlug}`, {
      cache: "no-store",
      timeoutMs: 8_000,
    }),
  createOrder: (body: unknown, token?: string) =>
    request<{ order: Order; eventId: string }>(`/api/orders`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    }),
  getOrder: (orderNumber: string) =>
    request<{ order: Order }>(`/api/orders/by-number/${orderNumber}`, {
      cache: "no-store",
    }),
  getOrdersByPhone: (phone: string) =>
    request<{ orders: Order[] }>(`/api/orders/by-phone/${phone}`, {
      cache: "no-store",
    }),
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
  me: (token?: string | null) => {
    void token;
    return request<{ user: AuthUser }>(`/api/auth/me`, { cache: "no-store" });
  },
  logout: () => request<void>(`/api/auth/logout`, { method: "POST" }),
  myOrders: (token?: string | null) => {
    void token;
    return request<{ items: Order[] }>(`/api/auth/orders`, { cache: "no-store" });
  },

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
    request<{ items: Order[]; total: number; page: number; limit: number; totalPages: number }>(
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
  sendOrderToSteadfast: (orderId: string, token: string) =>
    request<{ item: unknown; order: Order }>(
      `/api/admin/steadfast/orders/${orderId}/create`,
      {
        method: "POST",
        token,
      },
    ),
  getCourierStatus: async (
    orderId: string,
    token: string,
  ): Promise<SteadfastStatusResponse> => {
    const { order } = await api.getOrderAdmin(orderId, token);
    const courier = order.courier;
    if (!courier) {
      throw new Error("Courier tracking is not available yet.");
    }
    if (courier.consignmentId) {
      const result = await request<{ item: unknown }>(
        `/api/admin/steadfast/status/consignment/${encodeURIComponent(courier.consignmentId)}`,
        { token, cache: "no-store" },
      );
      return { ...result, order };
    }
    if (courier.trackingCode) {
      const result = await request<{ item: unknown }>(
        `/api/admin/steadfast/status/tracking/${encodeURIComponent(courier.trackingCode)}`,
        { token, cache: "no-store" },
      );
      return { ...result, order };
    }
    if (courier.invoice || order.orderNumber) {
      const result = await request<{ item: unknown }>(
        `/api/admin/steadfast/status/invoice/${encodeURIComponent(courier.invoice || order.orderNumber)}`,
        { token, cache: "no-store" },
      );
      return { ...result, order };
    }
    throw new Error("Courier tracking is missing tracking identifiers.");
  },
  syncCourierStatus: (orderId: string, token: string) =>
    api.getCourierStatus(orderId, token),
  getSteadfastBalance: (token: string) =>
    request<{ item: unknown }>(`/api/admin/steadfast/balance`, {
      token,
      cache: "no-store",
    }),
  bulkSendOrdersToSteadfast: async (orderIds: string[], token: string) => {
    const results = await Promise.allSettled(
      orderIds.map((id) => api.sendOrderToSteadfast(id, token)),
    );
    return {
      successful: results.filter((r) => r.status === "fulfilled").length,
      failed: results.filter((r) => r.status === "rejected").length,
      skipped: 0,
      results,
    };
  },

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
      damagedQuantity: number;
      damagedCost: number;
      damagedEntries: number;
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
      damagedQuantity: number;
      damagedCost: number;
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
  listProductsAdmin: (params: AdminProductListParams, token: string) =>
    request<{ items: Product[]; total: number; page: number; limit: number; totalPages: number; hasMore: boolean }>(
      `/api/products/admin/all${qs(params)}`,
      { token, cache: "no-store" },
    ),
  inventorySummary: (token: string) =>
    request<{ total: number; low: number; out: number; stockValue: number }>(
      `/api/admin/inventory-summary`,
      { token },
    ),

  // Inventory
  adjustStock: (id: string, delta: number, token: string) =>
    request<{ item: Product }>(`/api/admin/products/${id}/stock`, {
      method: "POST",
      body: JSON.stringify({ delta }),
      token,
    }),
  markDamaged: (
    id: string,
    body: { quantity: number; reason?: string },
    token: string,
  ) =>
    request<{
      item: Product;
      damaged: {
        _id: string;
        title: string;
        quantity: number;
        unitCost: number;
        totalCost: number;
        reason: string;
        createdAt: string;
      };
    }>(`/api/admin/products/${id}/damage`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    }),
  listDamaged: (params: { from?: string; to?: string; limit?: number }, token: string) =>
    request<{
      items: Array<{
        _id: string;
        productId?: string;
        title: string;
        quantity: number;
        unitCost: number;
        totalCost: number;
        reason: string;
        createdAt: string;
      }>;
      quantity: number;
      cost: number;
      entries: number;
    }>(`/api/admin/damaged${qs(params)}`, { token }),
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
  listCategoriesAdmin: (token: string) =>
    request<{ items: CategoryItem[] }>(`/api/categories/admin/all`, {
      token,
      cache: "no-store",
    }),
  createCategory: (body: Partial<CategoryItem>, token: string) =>
    request<{ item: CategoryItem }>(`/api/categories`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    }),
  updateCategory: (id: string, body: Partial<CategoryItem>, token: string) =>
    request<{ item: CategoryItem }>(`/api/categories/${id}`, {
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
  getHeroImages: () =>
    request<{ items: HeroImageItem[] }>(`/api/hero-images`, {
      cache: "no-store",
    }),
  getShopBanners: () =>
    request<{ items: ShopBannerItem[] }>(`/api/settings/shop-banners`, {
      cache: "no-store",
    }),
  listShopBannersAdmin: (token: string) =>
    request<{ items: ShopBannerItem[] }>(`/api/settings/shop-banners/admin/all`, {
      token,
    }),
  createShopBanner: (
    body: { imageUrl: string; publicId: string; order?: number; isActive?: boolean },
    token: string,
  ) =>
    request<{ item: ShopBannerItem }>(`/api/settings/shop-banners`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    }),
  updateShopBanner: (
    id: string,
    body: Partial<{ imageUrl: string; publicId: string; order: number; isActive: boolean }>,
    token: string,
  ) =>
    request<{ item: ShopBannerItem }>(`/api/settings/shop-banners/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      token,
    }),
  deleteShopBanner: (id: string, token: string) =>
    request<void>(`/api/settings/shop-banners/${id}`, {
      method: "DELETE",
      token,
    }),
  reorderShopBanners: (
    order: Array<{ id: string; order: number }>,
    token: string,
  ) =>
    request<{ items: ShopBannerItem[] }>(`/api/settings/shop-banners/reorder`, {
      method: "POST",
      body: JSON.stringify({ order }),
      token,
    }),
  listHeroImagesAdmin: (token: string) =>
    request<{ items: HeroImageItem[] }>(`/api/hero-images/admin/all`, { token }),
  createHeroImage: (
    body: { imageUrl: string; mediaUrl?: string; mediaType?: "image" | "video"; publicId: string; order?: number; isActive?: boolean; title?: string; subtitle?: string; link?: string },
    token: string,
  ) =>
    request<{ item: HeroImageItem }>(`/api/hero-images`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    }),
  updateHeroImage: (
    id: string,
    body: Partial<{ imageUrl: string; mediaUrl: string; mediaType: "image" | "video"; order: number; isActive: boolean; title: string; subtitle: string; link: string }>,
    token: string,
  ) =>
    request<{ item: HeroImageItem }>(`/api/hero-images/${id}`, {
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
    request<{ items: HeroImageItem[] }>(`/api/hero-images/reorder`, {
      method: "POST",
      body: JSON.stringify({ order }),
      token,
    }),

  // === Portfolio CMS (hidden) ===
  // Video uploads are large, so they opt out of the default 12s request timeout.
  getGoobliqueHero: () =>
    request<GoobliqueHero>(`/api/v1/gooblique/hero`, { cache: "no-store" }),
  updateGoobliqueHero: (body: FormData, token: string) =>
    request<GoobliqueHero>(`/api/v1/gooblique/hero`, {
      method: "PUT",
      body,
      token,
      timeoutMs: UPLOAD_TIMEOUT_MS,
    }),
  listDemoVideos: () =>
    request<{ items: DemoVideoItem[] }>(`/api/v1/gooblique/demo-videos`, {
      cache: "no-store",
    }),
  createDemoVideo: (body: FormData, token: string) =>
    request<{ item: DemoVideoItem }>(`/api/v1/gooblique/demo-videos`, {
      method: "POST",
      body,
      token,
      timeoutMs: UPLOAD_TIMEOUT_MS,
    }),
  updateDemoVideo: (id: string, body: FormData, token: string) =>
    request<{ item: DemoVideoItem }>(`/api/v1/gooblique/demo-videos/${id}`, {
      method: "PUT",
      body,
      token,
      timeoutMs: UPLOAD_TIMEOUT_MS,
    }),
  deleteDemoVideo: (id: string, token: string) =>
    request<{ item: DemoVideoItem }>(`/api/v1/gooblique/demo-videos/${id}`, {
      method: "DELETE",
      token,
    }),
  reorderDemoVideos: (
    order: Array<{ id: string; order: number }>,
    token: string,
  ) =>
    request<{ items: DemoVideoItem[] }>(`/api/v1/gooblique/demo-videos/reorder`, {
      method: "POST",
      body: JSON.stringify({ order }),
      token,
    }),
};
