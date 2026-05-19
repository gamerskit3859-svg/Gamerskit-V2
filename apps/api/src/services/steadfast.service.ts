import { env } from "../env.js";

export type SteadfastPrimitive = string | number | boolean | null;
export type SteadfastJson =
  | SteadfastPrimitive
  | SteadfastJson[]
  | { [key: string]: SteadfastJson };

export type SteadfastCreateOrderPayload = {
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  alternative_phone?: string;
  recipient_email?: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
  item_description?: string;
  total_lot?: number;
  delivery_type?: 0 | 1;
};

export type SteadfastOrderLike = {
  _id?: unknown;
  orderNumber?: string;
  customerName?: string;
  phone?: string;
  alternativePhone?: string;
  email?: string;
  shippingAddress?: string;
  deliveryAddress?: string;
  location?: string;
  customerAddress?: string;
  dueAmount?: number;
  remaining?: number;
  total?: number;
  note?: string;
  notes?: string;
  items?: Array<{
    title?: string;
    name?: string;
    quantity?: number;
  }>;
  customer?: {
    name?: string;
    phone?: string;
    alternativePhone?: string;
    altPhone?: string;
    email?: string;
    address?: string;
    area?: string;
    thana?: string;
    district?: string;
    city?: string;
  };
};

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, unknown>;
};

export class SteadfastApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "SteadfastApiError";
    this.status = status;
    this.details = details;
  }
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function appendQuery(url: URL, query?: Record<string, unknown>): void {
  if (!query) return;
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
}

function asAmount(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

function compact(parts: Array<string | undefined | null>): string {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

export function mapGamersKitOrderToSteadfast(
  order: SteadfastOrderLike,
): SteadfastCreateOrderPayload {
  const customer = order.customer ?? {};
  const invoice = order.orderNumber || String(order._id ?? "");
  const address =
    order.shippingAddress ||
    order.deliveryAddress ||
    order.customerAddress ||
    order.location ||
    compact([
      customer.address,
      customer.area,
      customer.thana,
      customer.district,
      customer.city,
    ]);

  return {
    invoice,
    recipient_name: order.customerName || customer.name || "GamersKit Customer",
    recipient_phone: order.phone || customer.phone || "",
    alternative_phone:
      order.alternativePhone || customer.alternativePhone || customer.altPhone || undefined,
    recipient_email: order.email || customer.email || undefined,
    recipient_address: address || "Address not provided",
    cod_amount: asAmount(order.dueAmount ?? order.remaining ?? order.total),
    note: order.note || order.notes || undefined,
    item_description:
      order.items
        ?.map((item) => item.title || item.name)
        .filter(Boolean)
        .join(", ") || undefined,
    total_lot: Math.max(1, order.items?.length ?? 1),
    delivery_type: 0,
  };
}

class SteadfastService {
  private get baseUrl(): string {
    return trimSlash(env.STEADFAST_BASE_URL);
  }

  private assertConfigured(): void {
    if (!env.STEADFAST_API_KEY || !env.STEADFAST_SECRET_KEY) {
      throw new SteadfastApiError(
        "Steadfast API credentials are not configured.",
        500,
        null,
      );
    }
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    this.assertConfigured();
    const url = new URL(`${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
    appendQuery(url, options.query);

    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        "Api-Key": env.STEADFAST_API_KEY,
        "Secret-Key": env.STEADFAST_SECRET_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    const data = text ? this.parseJson(text) : null;

    if (!response.ok) {
      const message =
        typeof data === "object" && data && "message" in data
          ? String((data as { message?: unknown }).message)
          : `Steadfast request failed with status ${response.status}`;
      throw new SteadfastApiError(message, response.status, data);
    }

    return data as T;
  }

  private parseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  createOrder(payload: SteadfastCreateOrderPayload) {
    return this.request<SteadfastJson>("/create_order", {
      method: "POST",
      body: payload,
    });
  }

  bulkCreateOrder(payloads: SteadfastCreateOrderPayload[]) {
    return this.request<SteadfastJson>("/create_order/bulk-order", {
      method: "POST",
      body: { data: payloads },
    });
  }

  getStatusByConsignmentId(consignmentId: string) {
    return this.request<SteadfastJson>(
      `/status_by_cid/${encodeURIComponent(consignmentId)}`,
    );
  }

  getStatusByInvoice(invoice: string) {
    return this.request<SteadfastJson>(
      `/status_by_invoice/${encodeURIComponent(invoice)}`,
    );
  }

  getStatusByTrackingCode(trackingCode: string) {
    return this.request<SteadfastJson>(
      `/status_by_trackingcode/${encodeURIComponent(trackingCode)}`,
    );
  }

  getBalance() {
    return this.request<SteadfastJson>("/get_balance");
  }

  createReturnRequest(payload: Record<string, unknown>) {
    return this.request<SteadfastJson>("/create_return_request", {
      method: "POST",
      body: payload,
    });
  }

  getReturnRequest(id: string) {
    return this.request<SteadfastJson>(
      `/get_return_request/${encodeURIComponent(id)}`,
    );
  }

  getReturnRequests(query?: Record<string, unknown>) {
    return this.request<SteadfastJson>("/get_return_requests", { query });
  }

  getPayments(query?: Record<string, unknown>) {
    return this.request<SteadfastJson>("/get_payments", { query });
  }

  getPaymentById(id: string) {
    return this.request<SteadfastJson>(`/get_payment/${encodeURIComponent(id)}`);
  }

  getPoliceStations(query?: Record<string, unknown>) {
    return this.request<SteadfastJson>("/get_police_stations", { query });
  }
}

export const steadfastService = new SteadfastService();
