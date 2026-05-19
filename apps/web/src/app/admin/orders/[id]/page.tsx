"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Package, Truck, CheckCircle, Clock, MapPin, Phone, Mail, CreditCard } from "lucide-react";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import {
  getCourierStatusText,
  getCourierTrackUrl,
  getStatusFromResponse,
} from "@/lib/courier";
import { formatBDT, formatDateTime } from "@/lib/format";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/types/shared";
import type { Order } from "@/types/shared";
import { Button, Card, Section, Pill } from "@/components/ui";

const STATUS_CONFIG = {
  pending: { tone: "warning" as const, icon: Clock },
  confirmed: { tone: "info" as const, icon: CheckCircle },
  processing: { tone: "info" as const, icon: Package },
  shipped: { tone: "info" as const, icon: Truck },
  delivered: { tone: "success" as const, icon: CheckCircle },
  cancelled: { tone: "danger" as const, icon: Clock },
  refunded: { tone: "danger" as const, icon: Clock },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: "Cash on Delivery",
  bkash: "bKash",
  nagad: "Nagad",
  card: "Card",
  manual: "Manual / Other",
};

function getCustomerAddress(order: Order) {
  const customer = order.customer ?? {};
  const address =
    customer.address ||
    customer.shippingAddress ||
    customer.deliveryAddress ||
    customer.customerAddress ||
    customer.location ||
    order.shippingAddress ||
    order.deliveryAddress ||
    order.customerAddress ||
    order.location ||
    "Location not provided";
  const location = [
    customer.district ?? customer.city,
    customer.thana ?? customer.area,
  ]
    .filter(Boolean)
    .join(", ");
  return { address, location };
}

export default function AdminOrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [courierLoading, setCourierLoading] = useState<"send" | "sync" | null>(null);

  useEffect(() => {
    const loadOrder = async () => {
      try {
        const { id } = await params;
        if (id === "new") {
          router.replace("/admin/orders/new");
          return;
        }
        const token = getAdminToken();
        if (!token) {
          router.push("/admin");
          return;
        }

        const result = await api.getOrderAdmin(id, token);
        setOrder(result.order);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [params, router]);

  const updateStatus = async (newStatus: Order["status"]) => {
    if (!order) return;

    try {
      const token = getAdminToken();
      if (!token) return;

      const result = await api.updateOrder(order._id, { status: newStatus }, token);
      setOrder(result.order);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const updatePaymentStatus = async (newPaymentStatus: Order["paymentStatus"]) => {
    if (!order) return;
    try {
      const token = getAdminToken();
      if (!token) return;
      const result = await api.updateOrder(
        order._id,
        { paymentStatus: newPaymentStatus },
        token,
      );
      setOrder(result.order);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const sendToSteadfast = async () => {
    if (!order || order.courier) return;
    const token = getAdminToken();
    if (!token) return;
    setCourierLoading("send");
    setNotice(null);
    try {
      const result = await api.sendOrderToSteadfast(order._id, token);
      setOrder(result.order);
      setNotice("Order sent to Steadfast successfully.");
    } catch (err) {
      setNotice(`Could not send order to Steadfast: ${(err as Error).message}`);
    } finally {
      setCourierLoading(null);
    }
  };

  const syncCourierStatus = async () => {
    if (!order?.courier) return;
    const token = getAdminToken();
    if (!token) return;
    setCourierLoading("sync");
    setNotice(null);
    try {
      const result = await api.syncCourierStatus(order._id, token);
      const syncedStatus = getStatusFromResponse(result.item);
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              courier: {
                ...prev.courier,
                status: syncedStatus ?? prev.courier?.status,
                response: result.item,
                updatedAt: new Date().toISOString(),
              },
            }
          : prev,
      );
      setNotice("Courier status synced successfully.");
    } catch (err) {
      setNotice(`Could not sync courier status: ${(err as Error).message}`);
    } finally {
      setCourierLoading(null);
    }
  };

  if (loading) {
    return (
      <Section width="default" spacing="lg">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
            <p className="text-sm text-fg-muted">Loading order details...</p>
          </div>
        </div>
      </Section>
    );
  }

  if (error || !order) {
    return (
      <Section width="default" spacing="lg">
        <div className="text-center py-12">
          <h1 className="text-2xl font-semibold mb-4">Order Not Found</h1>
          <p className="text-fg-muted mb-6">{error || "This order could not be found."}</p>
          <Button onClick={() => router.push("/admin/orders")}>
            <ArrowLeft size={16} className="mr-2" />
            Back to Orders
          </Button>
        </div>
      </Section>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const customer = order.customer ?? {
    name: "Unknown customer",
    phone: "Not provided",
  };
  const address = getCustomerAddress(order);
  const paymentLabel =
    PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod ?? "Unknown";
  const orderItems = Array.isArray(order.items) ? order.items : [];

  return (
    <Section width="default" spacing="lg" className="!max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/orders")}
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Orders
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Order {order.orderNumber}</h1>
            <p className="text-sm text-fg-muted">
              Placed on {formatDateTime(order.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Pill tone={statusConfig.tone}>
            <StatusIcon size={12} className="mr-1" />
            {order.status}
          </Pill>
          <select
            value={order.status}
            onChange={(e) => updateStatus(e.target.value as Order["status"])}
            className="px-3 py-1 text-sm border border-line rounded-md bg-white"
          >
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>
      {notice && (
        <div className="mb-6 rounded-lg border border-line bg-white px-4 py-3 text-sm text-fg-soft">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card padding="lg">
            <h2 className="text-lg font-semibold mb-4">Order Items</h2>
            <div className="space-y-4">
              {orderItems.map((item, index) => (
                <div key={index} className="flex gap-4 p-4 border border-line rounded-lg">
                  <div className="relative w-16 h-16 flex-shrink-0">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.title || "Order item"}
                        fill
                        className="object-cover rounded-md"
                        sizes="64px"
                      />
                    ) : (
                      <div className="w-full h-full bg-bg-soft rounded-md flex items-center justify-center">
                        <Package size={20} className="text-fg-muted" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm">{item.title || "Untitled item"}</h3>
                    {item.note && (
                      <p className="text-xs text-fg-muted mt-1">{item.note}</p>
                    )}
                    {item.selectedVariants &&
                      Object.keys(item.selectedVariants).length > 0 && (
                        <p className="mt-1 text-xs text-fg-muted">
                          {Object.entries(item.selectedVariants)
                            .map(([name, value]) => `${name}: ${value}`)
                            .join(" / ")}
                        </p>
                      )}
                    {item.custom && (
                      <Pill tone="info" className="mt-1">Custom Item</Pill>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-fg-muted">
                        {formatBDT(item.unitPrice ?? 0)} × {item.quantity ?? 1}
                      </span>
                      <span className="font-medium">
                        {formatBDT((item.unitPrice ?? 0) * (item.quantity ?? 1))}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="border-t border-line mt-6 pt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatBDT(order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>{formatBDT(order.shippingFee)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatBDT(order.discount)}</span>
                  </div>
                )}
                {order.advance > 0 && (
                  <div className="flex justify-between">
                    <span>Advance Paid</span>
                    <span className="text-green-600">-{formatBDT(order.advance)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg border-t border-line pt-2">
                  <span>Total</span>
                  <span>{formatBDT(order.total)}</span>
                </div>
                {order.remaining > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Remaining</span>
                    <span>{formatBDT(order.remaining)}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Order Notes */}
          {order.notes && (
            <Card padding="lg">
              <h2 className="text-lg font-semibold mb-3">Order Notes</h2>
              <p className="text-sm text-fg-muted whitespace-pre-wrap">{order.notes}</p>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Courier Information */}
          <Card padding="lg">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Truck size={18} />
              Courier Information
            </h2>
            {order.courier ? (
              <div className="space-y-3 text-sm">
                <InfoRow label="Provider" value={order.courier.provider || "Steadfast"} />
                <InfoRow label="Consignment ID" value={order.courier.consignmentId || "Not provided"} />
                <InfoRow label="Tracking code" value={order.courier.trackingCode || "Not provided"} />
                <InfoRow label="Delivery status" value={getCourierStatusText(order.courier)} />
                <InfoRow label="Courier status" value={order.courier.status || "Not synced"} />
                <InfoRow
                  label="Last synced"
                  value={
                    order.courier.updatedAt
                      ? formatDateTime(order.courier.updatedAt)
                      : "Not synced yet"
                  }
                />
                {order.courier.error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
                    {order.courier.error}
                  </div>
                )}
                <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={courierLoading === "sync"}
                    onClick={syncCourierStatus}
                    className="w-full sm:w-auto"
                  >
                    {courierLoading === "sync" ? "Syncing..." : "Sync Courier Status"}
                  </Button>
                  {getCourierTrackUrl(order.courier.trackingCode) && (
                    <a
                      href={getCourierTrackUrl(order.courier.trackingCode) ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-black/10 px-4 text-xs font-semibold hover:bg-neutral-100"
                    >
                      Track Courier
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-fg-muted">
                  This order has not been sent to Steadfast yet.
                </p>
                <Button
                  onClick={sendToSteadfast}
                  disabled={courierLoading === "send"}
                  className="w-full"
                >
                  {courierLoading === "send" ? "Sending..." : "Send to Steadfast"}
                </Button>
              </div>
            )}
          </Card>

          {/* Customer Information */}
          <Card padding="lg">
            <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-medium">{customer.name || "Unknown customer"}</h3>
              </div>
              <div className="flex items-center gap-2 text-sm text-fg-muted">
                <Phone size={14} />
                <span>{customer.phone || "Not provided"}</span>
              </div>
              {customer.email && (
                <div className="flex items-center gap-2 text-sm text-fg-muted">
                  <Mail size={14} />
                  <span>{customer.email}</span>
                </div>
              )}
              <div className="flex items-start gap-2 text-sm text-fg-muted">
                <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                <div>
                  <div>{address.address}</div>
                  {address.location && <div>{address.location}</div>}
                </div>
              </div>
            </div>
          </Card>

          {/* Payment Information */}
          <Card padding="lg">
            <h2 className="text-lg font-semibold mb-4">Payment Information</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard size={16} />
                <span className="text-sm font-medium">
                  {paymentLabel}
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-fg-muted mb-1">
                  Payment status
                </label>
                <select
                  value={order.paymentStatus ?? "unpaid"}
                  onChange={(e) =>
                    updatePaymentStatus(e.target.value as Order["paymentStatus"])
                  }
                  className="w-full h-9 rounded-md border border-line bg-bg px-2 text-sm outline-none focus:ring-2 focus:ring-black"
                >
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-sm">
                <div className="flex justify-between">
                  <span className="text-fg-muted">Total Amount</span>
                  <span className="font-medium">{formatBDT(order.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Courier COD</span>
                  <span className="font-medium">
                    {formatBDT(order.dueAmount ?? order.remaining ?? 0)}
                  </span>
                </div>
                {order.advance > 0 && (
                  <div className="flex justify-between">
                    <span className="text-fg-muted">Paid</span>
                    <span className="font-medium text-green-600">{formatBDT(order.advance)}</span>
                  </div>
                )}
                {order.remaining > 0 && (
                  <div className="flex justify-between">
                    <span className="text-fg-muted">Due</span>
                    <span className="font-medium text-orange-600">{formatBDT(order.remaining)}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Order Details */}
          <Card padding="lg">
            <h2 className="text-lg font-semibold mb-4">Order Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-fg-muted">Order Number</span>
                <span className="font-mono">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-muted">Source</span>
                <Pill tone={order.source === "manual" ? "info" : "neutral"}>
                  {order.source}
                </Pill>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-muted">Items</span>
                <span>{orderItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-muted">Created</span>
                <span>{formatDateTime(order.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-muted">Updated</span>
                <span>{formatDateTime(order.updatedAt)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-fg-muted">{label}</span>
      <span className="break-all text-right font-medium">{value}</span>
    </div>
  );
}
