"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatBDT } from "@/lib/format";
import { getEffectivePrice } from "@/lib/pricing";
import { getOrderDeliveryCharge } from "@/lib/delivery";
import { allLocation } from "@/static/Location";
import type { Product } from "@/types/shared";
import {
  Button,
  Card,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/cn";

type PaymentMethod = "cod" | "bkash" | "nagad" | "card" | "manual";
type PaymentType = "full" | "partial";

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cod", label: "Cash on Delivery" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "card", label: "Card" },
  { value: "manual", label: "Manual / other" },
];

type Line = {
  key: string;
  productId?: string;
  title: string;
  image?: string;
  unitPrice: number;
  originalPrice?: number;
  quantity: number;
  custom?: boolean;
  freeDelivery?: boolean;
  note?: string;
};

let nextKey = 1;
const k = () => `l_${nextKey++}`;

const eyebrow =
  "text-[10px] uppercase tracking-widest text-fg-muted";

export default function CustomOrderPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [paymentType, setPaymentType] = useState<PaymentType>("partial");
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    alternativePhone: "",
    email: "",
    address: "",
    district: "Dhaka City",
    thana: "",
  });
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locations = useMemo(() => allLocation(), []);
  const selectedDistrict = useMemo(
    () => locations.find((item) => item.district === customer.district),
    [locations, customer.district],
  );
  const thanas = useMemo(
    () => selectedDistrict?.thana.filter(Boolean) || [],
    [selectedDistrict],
  );

  useEffect(() => {
    api
      .listProducts({})
      .then((r) => setProducts(r.items))
      .catch(() => setProducts([]));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return products.slice(0, 8);
    const s = search.toLowerCase();
    return products
      .filter(
        (p) =>
          p.title.toLowerCase().includes(s) ||
          p.category.toLowerCase().includes(s),
      )
      .slice(0, 8);
  }, [products, search]);

  function addProduct(p: Product) {
    setLines((cur) => {
      const existing = cur.find((l) => l.productId === p._id);
      if (existing) {
        return cur.map((l) =>
          l.productId === p._id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...cur,
        {
          key: k(),
          productId: p._id,
          title: p.title,
          image: p.images[0],
          unitPrice: getEffectivePrice(p),
          originalPrice: p.price,
          quantity: 1,
          freeDelivery: p.freeDelivery === true,
        },
      ];
    });
    setShowSearch(false);
    setSearch("");
  }

  function addCustomLine() {
    setLines((cur) => [
      ...cur,
      {
        key: k(),
        title: "Custom item",
        unitPrice: 0,
        quantity: 1,
        custom: true,
      },
    ]);
  }

  function update(key: string, patch: Partial<Line>) {
    setLines((cur) => cur.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((cur) => cur.filter((l) => l.key !== key));
  }

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const shippingFee = getOrderDeliveryCharge(
    lines.map((l) => ({ freeDelivery: l.freeDelivery })),
    customer.district,
  );
  const total = Math.max(0, subtotal + shippingFee - discount);
  const onlinePayment = paymentMethod === "bkash" || paymentMethod === "nagad";
  const paidAmount = onlinePayment && paymentType === "full" ? total : advance;
  const remaining = Math.max(0, total - paidAmount);

  async function submit() {
    if (lines.length === 0) {
      setError("Add at least one item.");
      return;
    }
    if (!customer.name || !customer.phone || !customer.address) {
      setError("Customer name, phone, and address are required.");
      return;
    }
    if (onlinePayment) {
      const senderDigits = customer.phone.replace(/\D/g, "");
      if (!/^01[3-9]\d{8}$/.test(senderDigits)) {
        setError("Customer phone must be a valid Bangladesh mobile number for bKash/Nagad orders.");
        return;
      }
      if (paymentType === "partial" && (advance <= 0 || advance >= total)) {
        setError("Partial paid amount must be greater than 0 and less than the total.");
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const token = getAdminToken();
      const noteParts = [
        notes.trim(),
        customer.alternativePhone.trim()
          ? `Alternative phone: ${customer.alternativePhone.trim()}`
          : "",
      ].filter(Boolean);
      const customerPayload = {
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        district: customer.district,
        thana: customer.thana,
      };
      const r = await api.createOrder({
        customer: customerPayload,
        items: lines.map((l) => ({
          productId: l.productId,
          title: l.title,
          image: l.image,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          custom: l.custom ?? false,
          note: l.note,
        })),
        shippingFee,
        discount,
        advance: paidAmount,
        paymentMethod,
        paymentType: onlinePayment ? paymentType : null,
        paidAmount,
        dueAmount: remaining,
        senderNumber: onlinePayment ? customer.phone : null,
        source: "manual",
        notes: noteParts.join("\n"),
      }, token ?? undefined);
      router.push(`/admin/orders/${r.order._id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
          Admin
        </span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          New custom order
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Build a manual order with custom prices, ad-hoc line items, and
          flexible payment. Fires a Purchase event with the final value.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <Card tone="soft" padding="md">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Items</h2>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={addCustomLine}
              >
                <Plus size={12} /> Custom item
              </Button>
              <Button size="sm" onClick={() => setShowSearch(true)}>
                <Plus size={12} /> Add product
              </Button>
            </div>
          </div>

          {lines.length === 0 ? (
            <div className="py-12 text-center text-sm text-fg-muted">
              No items yet. Add a product or a custom line.
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
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-3"
                  >
                    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-bg-soft">
                      {l.image && (
                        <Image
                          src={l.image}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <Input
                      className="min-w-[140px] flex-1"
                      value={l.title}
                      onChange={(e) =>
                        update(l.key, { title: e.target.value })
                      }
                      readOnly={!l.custom}
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className={eyebrow}>Price</span>
                      <Input
                        className="!w-24 !py-1.5 text-right"
                        type="number"
                        min={0}
                        value={l.unitPrice}
                        onChange={(e) =>
                          update(l.key, {
                            unitPrice: Math.max(0, Number(e.target.value)),
                          })
                        }
                      />
                      {l.originalPrice !== undefined &&
                        l.originalPrice !== l.unitPrice && (
                          <span className="text-[10px] text-fg-muted line-through">
                            {formatBDT(l.originalPrice)}
                          </span>
                        )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className={eyebrow}>Qty</span>
                      <Input
                        className="!w-16 !py-1.5 text-right"
                        type="number"
                        min={1}
                        value={l.quantity}
                        onChange={(e) =>
                          update(l.key, {
                            quantity: Math.max(1, Number(e.target.value)),
                          })
                        }
                      />
                    </div>
                    <div className="min-w-[80px] whitespace-nowrap text-right font-semibold">
                      {formatBDT(l.unitPrice * l.quantity)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(l.key)}
                      className="rounded-full p-2 hover:bg-bg-soft"
                      aria-label="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}

          <div className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <span className={eyebrow}>Shipping fee (auto)</span>
              <div className="flex h-11 items-center rounded-[var(--radius-sm)] border border-line bg-bg-soft px-3 text-sm font-medium">
                {shippingFee === 0 ? "Free delivery" : formatBDT(shippingFee)}
              </div>
            </div>
            <NumField label="Discount" value={discount} onChange={setDiscount} />
            <div className="flex flex-col gap-1">
              <span className={eyebrow}>Payment</span>
              <Select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PaymentMethod)
                }
              >
                {PAYMENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            {onlinePayment && (
              <div className="flex flex-col gap-1">
                <span className={eyebrow}>Payment type</span>
                <Select
                  value={paymentType}
                  onChange={(e) => {
                    const next = e.target.value as PaymentType;
                    setPaymentType(next);
                    if (next === "full") setAdvance(total);
                  }}
                >
                  <option value="partial">Partial Payment</option>
                  <option value="full">Full Payment</option>
                </Select>
              </div>
            )}
            <NumField
              label={onlinePayment ? "Paid amount" : "Advance paid"}
              value={paidAmount}
              disabled={onlinePayment && paymentType === "full"}
              onChange={setAdvance}
            />
          </div>
        </Card>

        <aside className="flex flex-col gap-4">
          <Card tone="soft" padding="md">
            <h2 className="mb-3 font-semibold">Customer</h2>
            <div className="grid gap-2">
              <Input
                placeholder="Full name"
                value={customer.name}
                onChange={(e) =>
                  setCustomer({ ...customer, name: e.target.value })
                }
              />
              <Input
                placeholder="Phone"
                value={customer.phone}
                onChange={(e) =>
                  setCustomer({ ...customer, phone: e.target.value })
                }
              />
              <Input
                placeholder="Alternative phone (optional)"
                value={customer.alternativePhone}
                onChange={(e) =>
                  setCustomer({ ...customer, alternativePhone: e.target.value })
                }
              />
              <Input
                placeholder="Email (optional)"
                value={customer.email}
                onChange={(e) =>
                  setCustomer({ ...customer, email: e.target.value })
                }
              />
              <Textarea
                placeholder="Address"
                value={customer.address}
                onChange={(e) =>
                  setCustomer({ ...customer, address: e.target.value })
                }
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className={eyebrow}>District</span>
                  <Select
                    value={customer.district}
                    onChange={(e) =>
                      setCustomer({
                        ...customer,
                        district: e.target.value,
                        thana: "",
                      })
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
                    onChange={(e) =>
                      setCustomer({ ...customer, thana: e.target.value })
                    }
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
            <h2 className="mb-3 font-semibold">Summary</h2>
            <Row label="Subtotal" value={subtotal} />
            <Row label="Shipping" value={shippingFee} />
            <Row label="Discount" value={-discount} />
            <Row label="Paid" value={-paidAmount} />
            <div className="mt-2 border-t border-line pt-2">
              <Row label="Total" value={total} bold />
              <Row label="Due" value={remaining} bold />
            </div>
            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
            <Button
              onClick={submit}
              disabled={submitting}
              className="mt-4 w-full justify-center"
            >
              {submitting ? "Saving…" : `Create order · ${formatBDT(total)}`}
            </Button>
          </div>
        </aside>
      </div>

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
                        <Image
                          src={p.images[0]}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-sm font-medium">
                        {p.title}
                      </div>
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
    <div
      className={cn(
        "flex justify-between py-0.5 text-sm",
        bold && "font-semibold",
      )}
    >
      <span className={bold ? "" : "text-fg-soft"}>{label}</span>
      <span className="tabular-nums">{formatBDT(value)}</span>
    </div>
  );
}
