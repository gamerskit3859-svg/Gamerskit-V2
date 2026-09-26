"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatBDT } from "@/lib/format";
import { getEffectivePrice } from "@/lib/pricing";
import { getOrderDeliveryCharge } from "@/lib/delivery";
import { allLocation } from "@/static/Location";
import { PAYMENT_METHODS } from "@/types/shared";
import type { Order, OrderLineItem, PaymentMethod, Product } from "@/types/shared";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";

type PaymentType = "full" | "partial";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cod: "Cash on Delivery",
  bkash: "bKash",
  nagad: "Nagad",
  card: "Card",
  manual: "Manual / other",
};

/**
 * A line being edited. `selectedVariants` / `variantSku` are carried through
 * untouched from the saved order: the server matches stock movements on
 * (productId + selected variants), so rewriting them would strand the original
 * decrement on a different variant option.
 */
type Line = {
  key: string;
  productId?: string;
  title: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  custom: boolean;
  note?: string;
  selectedVariants?: Record<string, string>;
  variantSku?: string;
  variantPrice?: number;
};

let nextKey = 1;
const newKey = () => `edit_${nextKey++}`;

const eyebrow = "text-[10px] uppercase tracking-widest text-fg-muted";

function toLines(items: OrderLineItem[] = []): Line[] {
  return items.map((item) => ({
    key: newKey(),
    productId: item.productId,
    title: item.title ?? "Item",
    image: item.image,
    unitPrice: Number(item.unitPrice ?? 0),
    quantity: Number(item.quantity ?? 1),
    custom: item.custom === true,
    note: item.note,
    selectedVariants: item.selectedVariants,
    variantSku: item.variantSku,
    variantPrice: item.variantPrice,
  }));
}

export function OrderEditForm({
  order,
  onCancel,
  onSaved,
}: {
  order: Order;
  onCancel: () => void;
  onSaved: (order: Order) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [lines, setLines] = useState<Line[]>(() => toLines(order.items));
  const [shippingFee, setShippingFee] = useState(Number(order.shippingFee ?? 0));
  const [discount, setDiscount] = useState(Number(order.discount ?? 0));
  const [paidAmount, setPaidAmount] = useState(
    Number(order.paidAmount ?? order.advance ?? 0),
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    order.paymentMethod ?? "cod",
  );
  const [paymentType, setPaymentType] = useState<PaymentType>(
    order.paymentType === "full" ? "full" : "partial",
  );
  const [senderNumber, setSenderNumber] = useState(order.senderNumber ?? "");
  const [notes, setNotes] = useState(order.notes ?? "");
  const [customer, setCustomer] = useState({
    name: order.customer?.name ?? "",
    phone: order.customer?.phone ?? "",
    email: order.customer?.email ?? "",
    address: order.customer?.address ?? "",
    // Older admin-created orders stored location as city/area; the edit form
    // normalizes everything onto the district/thana pair the storefront uses.
    district: order.customer?.district ?? order.customer?.city ?? "",
    thana: order.customer?.thana ?? order.customer?.area ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locations = useMemo(() => allLocation(), []);
  const thanas = useMemo(
    () =>
      locations.find((item) => item.district === customer.district)?.thana.filter(Boolean) ??
      [],
    [locations, customer.district],
  );

  useEffect(() => {
    api
      .listProducts({ limit: 200 })
      .then((r) => setProducts(r.items))
      .catch(() => setProducts([]));
  }, []);

  const productById = useMemo(
    () => new Map(products.map((p) => [p._id, p])),
    [products],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return products.slice(0, 8);
    const s = search.toLowerCase();
    return products
      .filter(
        (p) =>
          p.title.toLowerCase().includes(s) || p.category.toLowerCase().includes(s),
      )
      .slice(0, 8);
  }, [products, search]);

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const total = Math.max(0, subtotal + shippingFee - discount);
  const onlinePayment = paymentMethod === "bkash" || paymentMethod === "nagad";
  const effectivePaid = onlinePayment && paymentType === "full" ? total : paidAmount;
  const due = Math.max(0, total - effectivePaid);

  // The delivery rules only know about products still in the catalog; lines
  // whose product was deleted fall back to "not free", matching the server.
  const autoShippingFee = getOrderDeliveryCharge(
    lines.map((l) => ({
      freeDelivery: l.custom
        ? false
        : productById.get(l.productId ?? "")?.freeDelivery === true,
    })),
    customer.district,
  );

  function addProduct(p: Product) {
    setLines((cur) => {
      // Only merge into a plain (variant-less) line for the same product;
      // variant lines stay separate so their stock keys don't collide.
      const existing = cur.find(
        (l) =>
          l.productId === p._id &&
          !l.custom &&
          Object.keys(l.selectedVariants ?? {}).length === 0,
      );
      if (existing) {
        return cur.map((l) =>
          l.key === existing.key ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...cur,
        {
          key: newKey(),
          productId: p._id,
          title: p.title,
          image: p.images[0],
          unitPrice: getEffectivePrice(p),
          quantity: 1,
          custom: false,
        },
      ];
    });
    setShowSearch(false);
    setSearch("");
  }

  function addCustomLine() {
    setLines((cur) => [
      ...cur,
      { key: newKey(), title: "Custom item", unitPrice: 0, quantity: 1, custom: true },
    ]);
  }

  function update(key: string, patch: Partial<Line>) {
    setLines((cur) => cur.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((cur) => cur.filter((l) => l.key !== key));
  }

  async function save() {
    if (lines.length === 0) {
      setError("An order must have at least one item.");
      return;
    }
    if (!customer.name.trim() || !customer.phone.trim() || !customer.address.trim()) {
      setError("Customer name, phone, and address are required.");
      return;
    }
    if (onlinePayment) {
      if (!/^01[3-9]\d{8}$/.test(senderNumber.replace(/\D/g, ""))) {
        setError("A valid sender number is required for bKash/Nagad orders.");
        return;
      }
      if (paymentType === "partial" && (effectivePaid <= 0 || effectivePaid >= total)) {
        setError("Partial paid amount must be greater than 0 and less than the total.");
        return;
      }
    }

    const token = getAdminToken();
    if (!token) {
      setError("Your admin session has expired. Please sign in again.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await api.editOrder(
        order._id,
        {
          customer: {
            name: customer.name.trim(),
            phone: customer.phone.trim(),
            email: customer.email.trim(),
            address: customer.address.trim(),
            district: customer.district,
            thana: customer.thana,
          },
          items: lines.map((l) => ({
            productId: l.productId,
            title: l.title,
            image: l.image,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            custom: l.custom,
            note: l.note,
            selectedVariants: l.selectedVariants,
            variantSku: l.variantSku,
            variantPrice: l.variantPrice,
          })),
          shippingFee,
          discount,
          paidAmount: effectivePaid,
          paymentMethod,
          paymentType: onlinePayment ? paymentType : null,
          senderNumber: onlinePayment ? senderNumber.replace(/\D/g, "") : null,
          notes,
        },
        token,
      );
      onSaved(result.order);
    } catch (err) {
      const body = (err as { body?: { error?: unknown } }).body;
      setError(
        typeof body?.error === "string" ? body.error : (err as Error).message,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[1fr_360px]">
      <Card tone="soft" padding="md">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Items</h2>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={addCustomLine}>
              <Plus size={12} /> Custom item
            </Button>
            <Button size="sm" onClick={() => setShowSearch(true)}>
              <Plus size={12} /> Add product
            </Button>
          </div>
        </div>

        {lines.length === 0 ? (
          <div className="py-12 text-center text-sm text-fg-muted">
            No items left. Add at least one before saving.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {lines.map((l) => (
                <motion.li
                  layout
                  key={l.key}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="rounded-lg border border-line bg-white p-3 sm:flex sm:flex-wrap sm:items-center sm:gap-3"
                >
                  {/* Two stacked rows on a phone — thumbnail and title, then the
                      numbers — and the original single row from sm, where both
                      wrappers go display:contents. */}
                  <div className="flex items-center gap-3 sm:contents">
                  <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-bg-soft">
                    {l.image && (
                      <Image src={l.image} alt="" fill sizes="48px" className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 sm:min-w-[140px]">
                    <Input
                      value={l.title}
                      aria-label="Item title"
                      onChange={(e) => update(l.key, { title: e.target.value })}
                      readOnly={!l.custom}
                    />
                    {l.selectedVariants && Object.keys(l.selectedVariants).length > 0 && (
                      <p className="mt-1 text-[10px] text-fg-muted">
                        {Object.entries(l.selectedVariants)
                          .map(([name, value]) => `${name}: ${value}`)
                          .join(" / ")}
                      </p>
                    )}
                  </div>
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-3 sm:mt-0 sm:contents">
                  <div className="flex flex-col gap-0.5">
                    <span className={eyebrow}>Price</span>
                    <Input
                      className="!w-24 !py-1.5 text-right"
                      type="number"
                      min={0}
                      value={l.unitPrice}
                      onChange={(e) =>
                        update(l.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className={eyebrow}>Qty</span>
                    <Input
                      className="!w-16 !py-1.5 text-right"
                      type="number"
                      min={1}
                      value={l.quantity}
                      onChange={(e) =>
                        update(l.key, { quantity: Math.max(1, Number(e.target.value) || 1) })
                      }
                    />
                  </div>
                  <div className="whitespace-nowrap text-right font-semibold sm:min-w-[80px]">
                    {formatBDT(l.unitPrice * l.quantity)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(l.key)}
                    className="rounded-full p-2 hover:bg-bg-soft"
                    aria-label="Remove item"
                  >
                    <Trash2 size={14} />
                  </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}

        <div className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className={eyebrow}>Shipping fee</span>
            <Input
              className="text-right"
              type="number"
              min={0}
              value={shippingFee}
              onChange={(e) => setShippingFee(Math.max(0, Number(e.target.value) || 0))}
            />
            {shippingFee !== autoShippingFee && (
              <button
                type="button"
                onClick={() => setShippingFee(autoShippingFee)}
                className="self-start text-[10px] text-fg-muted underline"
              >
                Reset to auto ({autoShippingFee === 0 ? "free" : formatBDT(autoShippingFee)})
              </button>
            )}
          </label>
          <NumField label="Discount" value={discount} onChange={setDiscount} />
          <label className="flex flex-col gap-1">
            <span className={eyebrow}>Payment</span>
            <Select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_LABELS[value]}
                </option>
              ))}
            </Select>
          </label>
          {onlinePayment && (
            <label className="flex flex-col gap-1">
              <span className={eyebrow}>Payment type</span>
              <Select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as PaymentType)}
              >
                <option value="partial">Partial payment</option>
                <option value="full">Full payment</option>
              </Select>
            </label>
          )}
          <NumField
            label={onlinePayment ? "Paid amount" : "Advance paid"}
            value={effectivePaid}
            disabled={onlinePayment && paymentType === "full"}
            onChange={setPaidAmount}
          />
          {onlinePayment && (
            <label className="flex flex-col gap-1">
              <span className={eyebrow}>Sender number</span>
              <Input
                value={senderNumber}
                onChange={(e) => setSenderNumber(e.target.value)}
                placeholder="01XXXXXXXXX"
              />
            </label>
          )}
        </div>
      </Card>

      <aside className="flex flex-col gap-4">
        <Card tone="soft" padding="md">
          <h2 className="mb-3 font-semibold">Customer</h2>
          <div className="grid gap-2">
            <Input
              placeholder="Full name"
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            />
            <Input
              placeholder="Phone"
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            />
            <Input
              placeholder="Email (optional)"
              value={customer.email}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            />
            <Textarea
              placeholder="Address"
              value={customer.address}
              onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className={eyebrow}>District</span>
                <Select
                  value={customer.district}
                  onChange={(e) =>
                    setCustomer({ ...customer, district: e.target.value, thana: "" })
                  }
                >
                  <option value="">Select district</option>
                  {locations.map((item) => (
                    <option key={item.name} value={item.district}>
                      {item.district}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1">
                <span className={eyebrow}>Thana / Area</span>
                <Select
                  value={customer.thana}
                  onChange={(e) => setCustomer({ ...customer, thana: e.target.value })}
                  disabled={!customer.district}
                >
                  <option value="">Select thana</option>
                  {thanas.map((thana) => (
                    <option key={thana} value={thana}>
                      {thana}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <Textarea
              placeholder="Internal notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </Card>

        <div className="glass-strong sticky top-24 rounded-2xl p-5">
          <h2 className="mb-3 font-semibold">Updated summary</h2>
          <Row label="Subtotal" value={subtotal} />
          <Row label="Shipping" value={shippingFee} />
          <Row label="Discount" value={-discount} />
          <Row label="Paid" value={-effectivePaid} />
          <div className="mt-2 border-t border-line pt-2">
            <Row label="Total" value={total} bold />
            <Row label="Due" value={due} bold />
          </div>
          {total !== order.total && (
            <p className="mt-2 text-xs text-fg-muted">
              Was {formatBDT(order.total)} · stock will be adjusted for any item changes.
            </p>
          )}
          {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={onCancel} disabled={saving} className="flex-1 justify-center">
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} className="flex-1 justify-center">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </aside>

      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 py-10 sm:pt-24"
            onClick={() => setShowSearch(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong mx-4 w-full max-w-xl rounded-2xl p-4"
            >
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  className="flex-1"
                  placeholder="Search products…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowSearch(false)}
                  className="rounded-full p-2 hover:bg-bg-soft"
                >
                  <X size={16} />
                </button>
              </div>
              <ul className="mt-3 max-h-80 overflow-y-auto">
                {filtered.map((p) => (
                  <li
                    key={p._id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-bg-soft"
                    onClick={() => addProduct(p)}
                  >
                    <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-white">
                      {p.images[0] && (
                        <Image src={p.images[0]} alt="" fill sizes="40px" className="object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-sm font-medium">{p.title}</div>
                      <div className="text-xs capitalize text-fg-muted">
                        {p.category.replace(/-/g, " ")} · {formatBDT(getEffectivePrice(p))}
                      </div>
                    </div>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="p-4 text-center text-sm text-fg-muted">
                    No products found.
                  </li>
                )}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NumField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={eyebrow}>{label}</span>
      <Input
        className="text-right"
        type="number"
        min={0}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
    </label>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className={cn("flex justify-between py-0.5 text-sm", bold && "font-semibold")}>
      <span className={bold ? "" : "text-fg-soft"}>{label}</span>
      <span className="tabular-nums">{formatBDT(value)}</span>
    </div>
  );
}
