"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  CreditCard,
  History,
  MapPin,
  Package,
  PackageSearch,
  Pencil,
  Phone,
  PhoneCall,
  PhoneMissed,
  Repeat,
  RotateCcw,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { OrderEditForm } from "@/components/admin/OrderEditForm";
import { getAdminToken } from "@/lib/admin-token";
import { markScrollRestore } from "@/lib/hooks";
import { getCourierStatusText, getCourierTrackUrl } from "@/lib/courier";
import {
  formatBDT,
  formatDateTime,
  formatRelativeTime,
  formatSmartDateTime,
} from "@/lib/format";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  PAYMENT_STATUSES,
  TERMINAL_ORDER_STATUSES,
  resolveCourierCodAmount,
} from "@/types/shared";
import type { Order, OrderStatus } from "@/types/shared";
import {
  Button,
  Card,
  FieldLabel,
  Input,
  Pill,
  Select,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/cn";

// Icon per status. The badge colour comes from the shared ORDER_STATUS_TONES
// map so the list and this page can never disagree about what a status means.
const STATUS_ICONS: Record<OrderStatus, LucideIcon> = {
  confirmed: CheckCircle,
  called_confirmed: PhoneCall,
  called_no_answer: PhoneMissed,
  waiting_stock: PackageSearch,
  exchange: Repeat,
  delivered: CheckCircle,
  returned: RotateCcw,
  cancelled: Clock,
  refunded: Clock,
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
  const [editing, setEditing] = useState(false);
  // Notes are edited on their own rather than through the full order edit,
  // which is locked once the parcel is with the courier — that is exactly when
  // there is most to record.
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  // Empty string means "no override" — the amount falls back to the rule.
  const [codDraft, setCodDraft] = useState("");
  const [codSaving, setCodSaving] = useState(false);

  // Push rather than history.back(): the detail page is also reached straight
  // from the custom-order form, and back would drop the user into that form.
  // The marker tells the list to restore the offset it was left at.
  const backToOrders = () => {
    markScrollRestore("/admin/orders");
    router.push("/admin/orders");
  };

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
        setNoteDraft(result.order.notes ?? "");
        setCodDraft(
          result.order.courierCodAmount === null ||
            result.order.courierCodAmount === undefined
            ? ""
            : String(result.order.courierCodAmount),
        );
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

  const saveNote = async () => {
    if (!order) return;
    const token = getAdminToken();
    if (!token) return;
    setNoteSaving(true);
    setNotice(null);
    try {
      const result = await api.updateOrder(order._id, { notes: noteDraft }, token);
      setOrder(result.order);
      setNoteDraft(result.order.notes ?? "");
      setNotice("Note saved.");
    } catch (err) {
      setNotice(`Could not save the note: ${(err as Error).message}`);
    } finally {
      setNoteSaving(false);
    }
  };

  const saveCodAmount = async (next: number | null) => {
    if (!order) return;
    const token = getAdminToken();
    if (!token) return;
    setCodSaving(true);
    setNotice(null);
    try {
      const result = await api.updateOrder(
        order._id,
        { courierCodAmount: next },
        token,
      );
      setOrder(result.order);
      setCodDraft(next === null ? "" : String(next));
      setNotice(
        next === null
          ? "Collection amount reset to the default."
          : `Courier will collect ${formatBDT(next)}.`,
      );
    } catch (err) {
      setNotice(`Could not set the amount: ${(err as Error).message}`);
    } finally {
      setCodSaving(false);
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
      // The server persists the synced status, so adopt the saved order
      // wholesale — it also carries the auto "delivered" flip.
      const result = await api.syncCourierStatus(order._id, token);
      setOrder(result.order);
      setNotice(
        result.order.status === "delivered" && order.status !== "delivered"
          ? "Courier reports delivered — order status updated to delivered."
          : `Courier status synced${result.deliveryStatus ? `: ${result.deliveryStatus}` : ""}.`,
      );
    } catch (err) {
      setNotice(`Could not sync courier status: ${(err as Error).message}`);
    } finally {
      setCourierLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-b-2 border-black" />
          <p className="text-sm text-fg-muted">Loading order…</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="py-16 text-center">
        <h1 className="mb-3 text-xl font-semibold">Order not found</h1>
        <p className="mb-5 text-sm text-fg-muted">
          {error || "This order could not be found."}
        </p>
        <Button onClick={backToOrders}>
          <ArrowLeft size={16} className="mr-2" />
          Back to orders
        </Button>
      </div>
    );
  }

  const statusTone = ORDER_STATUS_TONES[order.status] ?? "neutral";
  const StatusIcon = STATUS_ICONS[order.status] ?? Clock;
  const customer = order.customer ?? {
    name: "Unknown customer",
    phone: "Not provided",
  };
  const address = getCustomerAddress(order);
  const paymentLabel =
    PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod ?? "Unknown";
  const orderItems = Array.isArray(order.items) ? order.items : [];
  const editHistory = Array.isArray(order.editHistory) ? order.editHistory : [];
  const statusHistory = Array.isArray(order.statusHistory)
    ? order.statusHistory
    : [];
  const unitCount = orderItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  const trackUrl = getCourierTrackUrl(order.courier?.trackingCode);
  const codIsDefault =
    order.courierCodAmount === null || order.courierCodAmount === undefined;

  // Mirrors the server-side edit lock in PUT /api/orders/:id: once the
  // consignment is with the courier, editing here would leave the two copies
  // out of sync, and terminal orders have already been accounted for.
  const editBlockedReason = order.courier
    ? "This order has already been sent to Steadfast and can no longer be edited."
    : TERMINAL_ORDER_STATUSES.includes(order.status)
      ? `A ${(ORDER_STATUS_LABELS[order.status] ?? order.status).toLowerCase()} order can no longer be edited.`
      : null;

  return (
    // A plain div, not <Section>: the admin shell already supplies the page
    // padding and max width, and nesting a Section inside it was paying for
    // both twice — that alone was most of the empty space on this page.
    <div className="mx-auto w-full max-w-6xl">
      {/* Header. One block: who this order is, what state it is in, and how
          much it is worth — the three things worth knowing before scrolling. */}
      <header className="mb-3 flex items-start gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="!shrink-0 !px-2 sm:!px-3"
          aria-label="Back to orders"
          onClick={backToOrders}
        >
          <ArrowLeft size={16} />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="truncate font-mono text-base font-semibold sm:text-lg">
              {order.orderNumber}
            </h1>
            <Pill tone={statusTone}>
              <StatusIcon size={11} className="mr-1" />
              {ORDER_STATUS_LABELS[order.status] ?? order.status}
            </Pill>
            {order.source === "manual" && <Pill tone="info">manual</Pill>}
          </div>
          {/* Placed / size / value on one line instead of three rows and a
              separate "Order details" card repeating them further down. */}
          <p className="mt-0.5 text-xs text-fg-muted">
            {formatDateTime(order.createdAt)}
            {" · "}
            {unitCount} {unitCount === 1 ? "unit" : "units"}
            {" · "}
            <span className="font-medium text-fg-soft">{formatBDT(order.total)}</span>
          </p>
        </div>
      </header>

      {/* Quick actions. Calling the customer and moving the parcel are what
          this page is opened for, so they sit above the fold at every width
          rather than in a sidebar card below the item list. */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {customer.phone && (
          <a
            href={`tel:${customer.phone}`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-semibold hover:bg-bg-soft"
          >
            <Phone size={14} />
            Call
          </a>
        )}
        {order.courier ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={courierLoading === "sync"}
              onClick={syncCourierStatus}
            >
              {courierLoading === "sync" ? "Syncing…" : "Sync courier"}
            </Button>
            {trackUrl && (
              <a
                href={trackUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-semibold hover:bg-bg-soft"
              >
                <Truck size={14} />
                Track
              </a>
            )}
          </>
        ) : (
          <Button
            size="sm"
            disabled={courierLoading === "send"}
            onClick={sendToSteadfast}
          >
            {courierLoading === "send" ? "Sending…" : "Send to Steadfast"}
          </Button>
        )}
        {!editing && (
          <Button
            size="sm"
            variant="ghost"
            disabled={!!editBlockedReason}
            title={editBlockedReason ?? "Edit customer, items and totals"}
            onClick={() => {
              setNotice(null);
              setEditing(true);
            }}
          >
            <Pencil size={14} className="mr-1.5" />
            Edit
          </Button>
        )}
      </div>

      {/* The two dropdowns that actually get used, side by side. Full width on
          a phone so they are comfortable to tap. */}
      <Card padding="sm" className="mb-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel label="Order status">
              <Select
                value={order.status}
                onChange={(e) => updateStatus(e.target.value as Order["status"])}
              >
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {ORDER_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </FieldLabel>
            {/* The time sits with the control that sets it — this is where the
                eye is after changing a status. */}
            <span
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-fg-muted"
              title={
                order.statusChangedAt
                  ? `Status changed ${formatDateTime(order.statusChangedAt)} · ${formatRelativeTime(order.statusChangedAt)}`
                  : `Not moved since it was placed on ${formatDateTime(order.createdAt)}.`
              }
            >
              <Clock size={11} className="shrink-0 opacity-60" />
              {order.statusChangedAt
                ? `changed ${formatSmartDateTime(order.statusChangedAt)}`
                : "not changed yet"}
            </span>
          </div>
          <div>
            <FieldLabel label="Payment status">
              <Select
                value={order.paymentStatus ?? "unpaid"}
                onChange={(e) =>
                  updatePaymentStatus(e.target.value as Order["paymentStatus"])
                }
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </Select>
            </FieldLabel>
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-fg-muted">
              <CreditCard size={11} className="shrink-0 opacity-60" />
              {paymentLabel}
            </span>
          </div>
        </div>
      </Card>

      {!editing && editBlockedReason && (
        <div className="mb-3 rounded-lg border border-line bg-bg-soft px-3 py-2 text-xs text-fg-muted">
          {editBlockedReason}
        </div>
      )}
      {notice && (
        <div className="mb-3 rounded-lg border border-line bg-white px-3 py-2 text-sm text-fg-soft">
          {notice}
        </div>
      )}

      {editing ? (
        <OrderEditForm
          order={order}
          onCancel={() => setEditing(false)}
          onSaved={(updated) => {
            setOrder(updated);
            setEditing(false);
            setNotice("Order updated. Stock has been adjusted for any item changes.");
          }}
        />
      ) : (
        // Two columns from xl, not lg: at lg the 260px admin sidebar has just
        // appeared and the content column is only ~684px wide.
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3 xl:items-start">
          {/* Main column */}
          <div className="space-y-3 xl:col-span-2">
            <Panel title="Items" icon={Package} count={orderItems.length}>
              {/* A divided list rather than a bordered box per line: the
                  borders were costing ~16px of padding per item with nothing
                  to show for it. */}
              <ul className="divide-y divide-line">
                {orderItems.map((item, index) => (
                  <li key={index} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-bg-soft">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-fg-muted">
                          <Package size={16} />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 text-sm font-medium">
                          {item.title || "Untitled item"}
                        </p>
                        <p className="shrink-0 text-sm font-semibold">
                          {formatBDT((item.unitPrice ?? 0) * (item.quantity ?? 1))}
                        </p>
                      </div>
                      <p className="mt-0.5 text-xs text-fg-muted">
                        {formatBDT(item.unitPrice ?? 0)} × {item.quantity ?? 1}
                        {item.selectedVariants &&
                          Object.keys(item.selectedVariants).length > 0 && (
                            <>
                              {" · "}
                              {Object.entries(item.selectedVariants)
                                .map(([name, value]) => `${name}: ${value}`)
                                .join(" / ")}
                            </>
                          )}
                      </p>
                      {item.note && (
                        <p className="mt-0.5 text-xs text-fg-muted">{item.note}</p>
                      )}
                      {item.custom && (
                        <Pill tone="info" className="mt-1">
                          Custom
                        </Pill>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
                <MoneyRow label="Subtotal" value={formatBDT(order.subtotal)} />
                <MoneyRow label="Shipping" value={formatBDT(order.shippingFee)} />
                {order.discount > 0 && (
                  <MoneyRow
                    label="Discount"
                    value={`-${formatBDT(order.discount)}`}
                    tone="text-green-600"
                  />
                )}
                {order.advance > 0 && (
                  <MoneyRow
                    label="Advance paid"
                    value={`-${formatBDT(order.advance)}`}
                    tone="text-green-600"
                  />
                )}
                <div className="flex justify-between border-t border-line pt-1.5 text-base font-semibold">
                  <dt>Total</dt>
                  <dd>{formatBDT(order.total)}</dd>
                </div>
                {order.remaining > 0 && (
                  <MoneyRow
                    label="Remaining"
                    value={formatBDT(order.remaining)}
                    tone="text-orange-600"
                  />
                )}
              </dl>
            </Panel>

            <Panel title="Internal notes" icon={Pencil}>
              <Textarea
                rows={3}
                placeholder="Called the customer, asked to deliver after 5pm…"
                aria-label="Order notes"
                value={noteDraft}
                disabled={noteSaving}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={noteSaving || noteDraft === (order.notes ?? "")}
                  onClick={saveNote}
                >
                  {noteSaving ? "Saving…" : "Save note"}
                </Button>
                {noteDraft !== (order.notes ?? "") && !noteSaving && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setNoteDraft(order.notes ?? "")}
                  >
                    Discard
                  </Button>
                )}
                <span className="ml-auto text-[11px] text-fg-muted">
                  The customer never sees this
                </span>
              </div>
            </Panel>
          </div>

          {/* Sidebar */}
          <div className="space-y-3">
            <Panel title="Customer" icon={Phone}>
              <p className="text-sm font-medium">
                {customer.name || "Unknown customer"}
              </p>
              <div className="mt-1.5 space-y-1 text-sm">
                {customer.phone ? (
                  <a
                    href={`tel:${customer.phone}`}
                    className="block text-fg-soft underline underline-offset-2"
                  >
                    {customer.phone}
                  </a>
                ) : (
                  <span className="block text-fg-muted">No phone number</span>
                )}
                {customer.email && (
                  <a
                    href={`mailto:${customer.email}`}
                    className="block break-all text-fg-soft underline underline-offset-2"
                  >
                    {customer.email}
                  </a>
                )}
              </div>
              <div className="mt-2 flex items-start gap-1.5 text-xs text-fg-muted">
                <MapPin size={13} className="mt-0.5 shrink-0" />
                <span>
                  {address.address}
                  {address.location && (
                    <span className="block">{address.location}</span>
                  )}
                </span>
              </div>
            </Panel>

            {/* Collection amount and shipment details were two separate cards
                asking the same question — what the courier does with this
                parcel — so they are one panel now. */}
            <Panel title="Courier" icon={Truck}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-fg-muted">Collects</span>
                <span className="text-lg font-semibold">
                  {formatBDT(resolveCourierCodAmount(order))}
                  <span className="ml-1.5 align-middle text-[11px] font-normal text-fg-muted">
                    {codIsDefault ? "default" : "set by you"}
                  </span>
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-fg-muted">
                {order.status === "exchange"
                  ? "An exchange collects nothing unless you set an amount."
                  : "Defaults to what is still due on this order."}
              </p>

              {order.courier ? (
                <>
                  <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-xs">
                    <InfoRow
                      label="Provider"
                      value={order.courier.provider || "Steadfast"}
                    />
                    <InfoRow
                      label="Consignment"
                      value={order.courier.consignmentId || "—"}
                    />
                    <InfoRow
                      label="Tracking"
                      value={order.courier.trackingCode || "—"}
                    />
                    <InfoRow
                      label="Delivery"
                      value={getCourierStatusText(order.courier)}
                    />
                    <InfoRow
                      label="Last synced"
                      value={
                        order.courier.updatedAt
                          ? formatSmartDateTime(order.courier.updatedAt)
                          : "Never"
                      }
                    />
                  </dl>
                  {order.courier.error && (
                    <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                      {order.courier.error}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-fg-muted">
                    Already sent — the consignment carries the amount it was
                    created with, so changing it here would have no effect.
                  </p>
                </>
              ) : (
                <div className="mt-3 border-t border-line pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="!w-28"
                      aria-label="Amount for the courier to collect"
                      placeholder={String(resolveCourierCodAmount(order))}
                      value={codDraft}
                      disabled={codSaving}
                      onChange={(e) => setCodDraft(e.target.value)}
                    />
                    <Button
                      size="sm"
                      disabled={codSaving || codDraft.trim() === ""}
                      onClick={() =>
                        saveCodAmount(Math.max(0, Number(codDraft) || 0))
                      }
                    >
                      {codSaving ? "Saving…" : "Set"}
                    </Button>
                    {!codIsDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={codSaving}
                        onClick={() => saveCodAmount(null)}
                      >
                        Use default
                      </Button>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] text-fg-muted">
                    Set 0 to hand the parcel over with nothing to collect.
                  </p>
                </div>
              )}
            </Panel>

            <Panel title="Record" icon={History}>
              <dl className="space-y-1.5 text-xs">
                <InfoRow label="Source" value={order.source} />
                <InfoRow label="Payment method" value={paymentLabel} />
                {order.couponCode && (
                  <InfoRow label="Coupon" value={order.couponCode} />
                )}
                <InfoRow label="Placed" value={formatDateTime(order.createdAt)} />
                <InfoRow label="Updated" value={formatDateTime(order.updatedAt)} />
              </dl>
            </Panel>

            {/* Both trails are reference material, not daily work, so they are
                collapsed — they were adding two full-height cards to the
                bottom of every order. */}
            {(statusHistory.length > 0 || editHistory.length > 0) && (
              <Panel title="History" icon={History}>
                {statusHistory.length > 0 && (
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-sm font-medium">
                      Status changes ({statusHistory.length})
                      <span className="text-fg-muted transition-transform group-open:rotate-180">
                        ⌄
                      </span>
                    </summary>
                    <ol className="mt-1 space-y-2.5">
                      {[...statusHistory].reverse().map((entry, index) => (
                        <li
                          key={index}
                          className="border-l-2 border-line pl-2.5 text-xs"
                        >
                          <div className="text-fg-muted">
                            {formatDateTime(entry.at)} ·{" "}
                            {formatRelativeTime(entry.at)}
                          </div>
                          <div className="mt-0.5 text-fg-soft">
                            {entry.from
                              ? `${ORDER_STATUS_LABELS[entry.from] ?? entry.from} → `
                              : ""}
                            <span className="font-medium text-foreground">
                              {ORDER_STATUS_LABELS[entry.to] ?? entry.to}
                            </span>
                          </div>
                          <div className="text-fg-muted">
                            {entry.via === "courier"
                              ? "Courier sync"
                              : entry.byEmail ?? "Admin"}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
                {editHistory.length > 0 && (
                  <details className="group mt-1 border-t border-line pt-1">
                    <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-sm font-medium">
                      Edits ({editHistory.length})
                      <span className="text-fg-muted transition-transform group-open:rotate-180">
                        ⌄
                      </span>
                    </summary>
                    <ol className="mt-1 space-y-2.5">
                      {[...editHistory].reverse().map((entry, index) => (
                        <li
                          key={index}
                          className="border-l-2 border-line pl-2.5 text-xs"
                        >
                          <div className="text-fg-muted">
                            {formatDateTime(entry.at)}
                            {entry.byEmail ? ` · ${entry.byEmail}` : ""}
                          </div>
                          <ul className="mt-0.5 space-y-0.5 text-fg-soft">
                            {entry.changes.map((change, changeIndex) => (
                              <li key={changeIndex}>{change}</li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </Panel>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A sidebar/main card with a small, quiet heading. The headings here used to be
 * `text-lg` inside `p-8` cards, which meant a five-line panel spent more height
 * on its own title than on its content.
 */
function Panel({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  /** Shown after the title, e.g. "Items 3". */
  count?: number;
  children: ReactNode;
}) {
  return (
    <Card padding="sm">
      <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
        {Icon && <Icon size={13} />}
        {title}
        {count !== undefined && (
          <span className="font-normal normal-case tracking-normal">
            ({count})
          </span>
        )}
      </h2>
      {children}
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-fg-muted">{label}</dt>
      <dd className="break-all text-right font-medium">{value}</dd>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className={cn("flex justify-between", tone)}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
