import { notFound } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Package, Truck, CheckCircle, Clock, MapPin, Phone, Mail, CreditCard } from "lucide-react";
import { api } from "@/lib/api";
import { formatBDT, formatDateTime } from "@/lib/format";
import { LinkButton, Card, Section, Pill } from "@/components/ui";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

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

  const statusConfig = STATUS_CONFIG[order!.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  return (
    <Section width="narrow" spacing="lg" className="!max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <LinkButton href="/track" variant="ghost" size="sm">
            <ArrowLeft size={16} className="mr-2" />
            Back to Orders
          </LinkButton>
          <div>
            <h1 className="text-2xl font-semibold">Order {order!.orderNumber}</h1>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Status Timeline */}
          <Card tone="soft" padding="lg">
            <h2 className="mb-6 font-semibold">Order Status</h2>
            <ol className="grid gap-4">
              {STATUSES.map((s, i) => {
                const reached = i <= Math.max(0, STATUSES.findIndex(status => status.key === order!.status));
                const isCurrent = s.key === order!.status;
                return (
                  <li
                    key={s.key}
                    className={cn(
                      "flex items-center gap-3",
                      !reached && "opacity-40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full border border-line-strong text-[10px]",
                        reached ? "bg-black text-white" : "bg-background",
                        isCurrent && "ring-2 ring-blue-500 ring-offset-2"
                      )}
                    >
                      {reached ? "✓" : i + 1}
                    </span>
                    <span className={cn("text-sm", isCurrent && "font-medium")}>{s.label}</span>
                  </li>
                );
              })}
            </ol>
          </Card>

          {/* Order Items */}
          <Card padding="lg">
            <h2 className="text-lg font-semibold mb-4">Order Items</h2>
            <div className="space-y-4">
              {order!.items.map((item, index) => (
                <div key={index} className="flex gap-4 p-4 border border-line rounded-lg">
                  <div className="relative w-16 h-16 flex-shrink-0">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.title}
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
                    <h3 className="font-medium text-sm">{item.title}</h3>
                    {item.note && (
                      <p className="text-xs text-fg-muted mt-1">{item.note}</p>
                    )}
                    {item.custom && (
                      <Pill tone="info" className="mt-1">Custom Item</Pill>
                    )}
                    <div className="flex items-center justify-between mt-2">
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
                    <span className="text-green-600">-{formatBDT(order!.advance)}</span>
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
              <p className="text-sm text-fg-muted whitespace-pre-wrap">{order!.notes}</p>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Information */}
          <Card padding="lg">
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
                <div>
                  <div>{order!.customer.address}</div>
                  <div>{order!.customer.district}{order!.customer.thana && `, ${order!.customer.thana}`}</div>
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
                  {PAYMENT_METHOD_LABELS[order!.paymentMethod]}
                </span>
              </div>
              <div className="text-sm">
                <div className="flex justify-between">
                  <span className="text-fg-muted">Total Amount</span>
                  <span className="font-medium">{formatBDT(order!.total)}</span>
                </div>
                {order!.advance > 0 && (
                  <div className="flex justify-between">
                    <span className="text-fg-muted">Paid</span>
                    <span className="font-medium text-green-600">{formatBDT(order!.advance)}</span>
                  </div>
                )}
                {order!.remaining > 0 && (
                  <div className="flex justify-between">
                    <span className="text-fg-muted">Due</span>
                    <span className="font-medium text-orange-600">{formatBDT(order!.remaining)}</span>
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
                <span className="font-mono">{order!.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-muted">Items</span>
                <span>{order!.items.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-muted">Created</span>
                <span>{formatDateTime(order!.createdAt)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-10 flex gap-3">
        <LinkButton href="/shop" variant="ghost">
          Continue shopping
        </LinkButton>
        <LinkButton href="/track">View all orders</LinkButton>
      </div>
    </Section>
  );
}
