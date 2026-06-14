import { notFound } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  Mail,
  CreditCard,
} from "lucide-react";
import { api } from "@/lib/api";
import { getCourierStatusText, getCourierTrackUrl } from "@/lib/courier";
import { formatBDT, formatDateTime } from "@/lib/format";
import { LinkButton, Card, Section, Pill } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Order } from "@/types/shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUSES: Array<{ key: string; label: string }> = [
  { key: "pending", label: "Pending confirmation" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

const STATUS_CONFIG = {
  pending: { tone: "warning" as const, icon: Clock },
  confirmed: { tone: "info" as const, icon: CheckCircle },
  processing: { tone: "info" as const, icon: Package },
  shipped: { tone: "info" as const, icon: Truck },
  delivered: { tone: "success" as const, icon: CheckCircle },
  cancelled: { tone: "danger" as const, icon: Clock },
};

const PAYMENT_METHOD_LABELS = {
  cod: "Cash on Delivery",
  bkash: "bKash",
  nagad: "Nagad",
  card: "Card",
  manual: "Manual / Other",
};

function getDeliveryInfo(order: Order) {
  const customer = order.customer;
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
    "";
  const area = customer.thana || customer.area || "";
  const district = customer.district || customer.city || "";
  const location = [area, district].filter(Boolean).join(", ");

  return {
    address,
    area,
    district,
    location,
    hasLocation: Boolean(address || location),
  };
}

function paymentTypeLabel(type?: Order["paymentType"]) {
  if (type === "full") return "Full Payment";
  if (type === "partial") return "Partial Payment";
  return null;
}

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let order: Awaited<ReturnType<typeof api.getOrder>>["order"];
  try {
    order = (await api.getOrder(id)).order;
  } catch {
    notFound();
  }

  const statusConfig =
    STATUS_CONFIG[order!.status as keyof typeof STATUS_CONFIG] ||
    STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const delivery = getDeliveryInfo(order!);
  const paidAmount = order!.paidAmount ?? order!.advance ?? 0;
  const dueAmount = order!.dueAmount ?? order!.remaining ?? 0;
  const paymentType = paymentTypeLabel(order!.paymentType);
  const showSender =
    (order!.paymentMethod === "bkash" || order!.paymentMethod === "nagad") &&
    order!.senderNumber;

  return (
    <Section
      width="narrow"
      spacing="md"
      className="!max-w-5xl px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <LinkButton
            href="/track"
            variant="ghost"
            size="sm"
            className="w-full sm:w-auto">
            <ArrowLeft size={16} className="mr-2" />
            Back to Orders
          </LinkButton>
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold sm:text-2xl">
              Order {order!.orderNumber}
            </h1>
            <p className="text-sm text-fg-muted">
              Placed on {formatDateTime(order!.createdAt)}
            </p>
          </div>
        </div>
        <Pill tone={statusConfig.tone}>
          <StatusIcon size={12} className="mr-1" />
          {order!.status}
        </Pill>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Status Timeline */}
          <Card tone="soft" padding="md" className="sm:p-6">
            <h2 className="mb-6 font-semibold">Order Status</h2>
            <ol className="grid gap-4">
              {STATUSES.map((s, i) => {
                const reached =
                  i <=
                  Math.max(
                    0,
                    STATUSES.findIndex(
                      (status) => status.key === order!.status,
                    ),
                  );
                const isCurrent = s.key === order!.status;
                return (
                  <li
                    key={s.key}
                    className={cn(
                      "flex items-center gap-3",
                      !reached && "opacity-40",
                    )}>
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full border border-line-strong text-[10px]",
                        reached ? "bg-black text-white" : "bg-background",
                        isCurrent && "ring-2 ring-blue-500 ring-offset-2",
                      )}>
                      {reached ? "✓" : i + 1}
                    </span>
                    <span className={cn("text-sm", isCurrent && "font-medium")}>
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>

          {/* Order Items */}
          <Card padding="md" className="sm:p-6">
            <h2 className="text-lg font-semibold mb-4">Order Items</h2>
            <div className="space-y-4">
              {order!.items.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-4 rounded-lg border border-line p-4 sm:flex-row">
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-bg-soft sm:h-16 sm:w-16">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="w-full h-full bg-bg-soft rounded-md flex items-center justify-center">
                        <Package size={20} className="text-fg-muted" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-sm font-medium">
                      {item.title}
                    </h3>
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
                      <Pill tone="info" className="mt-1">
                        Custom Item
                      </Pill>
                    )}
                    <div className="mt-2 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm text-fg-muted">
                        {formatBDT(item.unitPrice)} × {item.quantity}
                      </span>
                      <span className="font-medium">
                        {formatBDT(item.unitPrice * item.quantity)}
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
                  <span>{formatBDT(order!.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>{formatBDT(order!.shippingFee)}</span>
                </div>
                {order!.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatBDT(order!.discount)}</span>
                  </div>
                )}
                {order!.advance > 0 && (
                  <div className="flex justify-between">
                    <span>Advance Paid</span>
                    <span className="text-green-600">
                      -{formatBDT(order!.advance)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg border-t border-line pt-2">
                  <span>Total</span>
                  <span>{formatBDT(order!.total)}</span>
                </div>
                {order!.remaining > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Remaining</span>
                    <span>{formatBDT(order!.remaining)}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Order Notes */}
          {order!.notes && (
            <Card padding="lg">
              <h2 className="text-lg font-semibold mb-3">Order Notes</h2>
              <p className="text-sm text-fg-muted whitespace-pre-wrap">
                {order!.notes}
              </p>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5 lg:space-y-6">
          {/* Customer Information */}
          <Card padding="md" className="sm:p-6">
            <h2 className="text-lg font-semibold mb-4">Delivery Information</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-medium">{order!.customer.name}</h3>
              </div>
              <div className="flex items-center gap-2 text-sm text-fg-muted">
                <Phone size={14} />
                <span>{order!.customer.phone}</span>
              </div>
              {order!.customer.email && (
                <div className="flex items-center gap-2 text-sm text-fg-muted">
                  <Mail size={14} />
                  <span>{order!.customer.email}</span>
                </div>
              )}
              <div className="flex items-start gap-2 text-sm text-fg-muted">
                <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  {delivery.hasLocation ? (
                    <>
                      {delivery.address && (
                        <div className="break-words">{delivery.address}</div>
                      )}
                      {delivery.location && (
                        <div className="break-words">{delivery.location}</div>
                      )}
                    </>
                  ) : (
                    <div>Location not provided</div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Payment Information */}
          <Card padding="md" className="sm:p-6">
            <h2 className="text-lg font-semibold mb-4">Payment Information</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard size={16} />
                <span className="text-sm font-medium">
                  {PAYMENT_METHOD_LABELS[order!.paymentMethod]}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                {paymentType && (
                  <div className="flex justify-between gap-4">
                    <span className="text-fg-muted">Payment Type</span>
                    <span className="font-medium">{paymentType}</span>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span className="text-fg-muted">Total Amount</span>
                  <span className="font-medium">{formatBDT(order!.total)}</span>
                </div>
                {paidAmount > 0 && (
                  <div className="flex justify-between gap-4">
                    <span className="text-fg-muted">Paid</span>
                    <span className="font-medium text-green-600">
                      {formatBDT(paidAmount)}
                    </span>
                  </div>
                )}
                {dueAmount > 0 && (
                  <div className="flex justify-between gap-4">
                    <span className="text-fg-muted">Due</span>
                    <span className="font-medium text-orange-600">
                      {formatBDT(dueAmount)}
                    </span>
                  </div>
                )}
                {showSender && (
                  <div className="flex justify-between gap-4">
                    <span className="text-fg-muted">Sender Number</span>
                    <span className="break-all font-medium">
                      {order!.senderNumber}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Delivery Tracking */}
          <Card padding="md" className="sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Truck size={18} />
              Delivery Tracking
            </h2>
            {order!.courier ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-fg-muted">Courier</span>
                  <span className="font-medium">
                    {order!.courier.provider || "Steadfast"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-fg-muted">Tracking code</span>
                  <span className="break-all text-right font-mono">
                    {order!.courier.trackingCode || "Not provided"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-fg-muted">Delivery status</span>
                  <span className="text-right font-medium">
                    {getCourierStatusText(order!.courier)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-fg-muted">Last updated</span>
                  <span className="text-right">
                    {order!.courier.updatedAt
                      ? formatDateTime(order!.courier.updatedAt)
                      : "Not synced yet"}
                  </span>
                </div>
                {getCourierTrackUrl(order!.courier.trackingCode) && (
                  <a
                    href={
                      getCourierTrackUrl(order!.courier.trackingCode) ?? "#"
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-black/10 px-4 text-sm font-semibold hover:bg-neutral-100">
                    Track Delivery
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-fg-muted">
                Courier tracking is not available yet.
              </p>
            )}
          </Card>

          {/* Order Details */}
          <Card padding="md" className="sm:p-6">
            <h2 className="text-lg font-semibold mb-4">Order Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-fg-muted">Order Number</span>
                <span className="break-all text-right font-mono">
                  {order!.orderNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-muted">Items</span>
                <span>
                  {order!.items.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-muted">Created</span>
                <span>{formatDateTime(order!.createdAt)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <LinkButton href="/shop" variant="ghost" className="w-full sm:w-auto">
          Continue shopping
        </LinkButton>
        <LinkButton href="/track" className="w-full sm:w-auto">
          View all orders
        </LinkButton>
      </div>
    </Section>
  );
}
