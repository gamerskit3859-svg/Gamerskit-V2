"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import { formatBDT } from "@/lib/format";
import type { Product } from "@gamerskit/shared";

type Line = {
  key: string;
  productId?: string;
  title: string;
  image?: string;
  unitPrice: number;
  originalPrice?: number;
  quantity: number;
  custom?: boolean;
  note?: string;
};

let nextKey = 1;
const k = () => `l_${nextKey++}`;

export default function CustomOrderPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [shippingFee, setShippingFee] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<
    "cod" | "bkash" | "nagad" | "card" | "manual"
  >("cod");
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "Dhaka",
    area: "",
  });
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          unitPrice: p.price,
          originalPrice: p.price,
          quantity: 1,
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
  const total = Math.max(0, subtotal + shippingFee - discount);
  const remaining = Math.max(0, total - advance);

  async function submit() {
    if (lines.length === 0) {
      setError("Add at least one item.");
      return;
    }
    if (!customer.name || !customer.phone || !customer.address) {
      setError("Customer name, phone, and address are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await api.createOrder({
        customer,
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
        advance,
        paymentMethod,
        source: "manual",
        notes,
      });
      router.push(`/admin/orders?highlight=${r.order.orderNumber}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <span className="eyebrow">Admin</span>
        <h1 className="text-3xl font-semibold tracking-tight mt-2">
          New custom order
        </h1>
        <p className="text-sm text-[var(--fg-soft)] mt-1">
          Build a manual order with custom prices, ad-hoc line items, and
          flexible payment. Fires a Purchase event with the final value.
        </p>
      </header>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* lines builder */}
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Items</h2>
            <div className="flex gap-2">
              <button
                className="btn btn-ghost !py-1.5 !px-3 !text-xs"
                onClick={addCustomLine}
              >
                <Plus size={12} /> Custom item
              </button>
              <button
                className="btn btn-primary !py-1.5 !px-3 !text-xs"
                onClick={() => setShowSearch(true)}
              >
                <Plus size={12} /> Add product
              </button>
            </div>
          </div>

          {lines.length === 0 ? (
            <div className="text-sm text-[var(--fg-muted)] py-12 text-center">
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
                    className="bg-white rounded-lg p-3 border border-[var(--line)] flex flex-wrap items-center gap-3"
                  >
                    <div className="relative w-12 h-12 bg-[var(--bg-soft)] rounded overflow-hidden flex-shrink-0">
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
                    <input
                      className="input flex-1 min-w-[140px]"
                      value={l.title}
                      onChange={(e) =>
                        update(l.key, { title: e.target.value })
                      }
                      readOnly={!l.custom}
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-[var(--fg-muted)] uppercase tracking-widest">
                        Price
                      </span>
                      <input
                        className="input !w-24 !py-1.5 text-right"
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
                          <span className="text-[10px] text-[var(--fg-muted)] line-through">
                            {formatBDT(l.originalPrice)}
                          </span>
                        )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-[var(--fg-muted)] uppercase tracking-widest">
                        Qty
                      </span>
                      <input
                        className="input !w-16 !py-1.5 text-right"
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
                    <div className="font-semibold whitespace-nowrap min-w-[80px] text-right">
                      {formatBDT(l.unitPrice * l.quantity)}
                    </div>
                    <button
                      onClick={() => removeLine(l.key)}
                      className="p-2 hover:bg-[var(--bg-soft)] rounded-full"
                      aria-label="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}

          {/* totals row */}
          <div className="hairline-t mt-5 pt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <NumField
              label="Shipping fee"
              value={shippingFee}
              onChange={setShippingFee}
            />
            <NumField label="Discount" value={discount} onChange={setDiscount} />
            <NumField label="Advance paid" value={advance} onChange={setAdvance} />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-[var(--fg-muted)] uppercase tracking-widest">
                Payment
              </span>
              <select
                className="select"
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as typeof paymentMethod)
                }
              >
                <option value="cod">Cash on Delivery</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="card">Card</option>
                <option value="manual">Manual / other</option>
              </select>
            </div>
          </div>
        </div>

        {/* customer + summary */}
        <aside className="flex flex-col gap-4">
          <div className="card-soft p-5">
            <h2 className="font-semibold mb-3">Customer</h2>
            <div className="grid gap-2">
              <input
                className="input"
                placeholder="Full name"
                value={customer.name}
                onChange={(e) =>
                  setCustomer({ ...customer, name: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Phone"
                value={customer.phone}
                onChange={(e) =>
                  setCustomer({ ...customer, phone: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Email (optional)"
                value={customer.email}
                onChange={(e) =>
                  setCustomer({ ...customer, email: e.target.value })
                }
              />
              <textarea
                className="textarea"
                placeholder="Address"
                value={customer.address}
                onChange={(e) =>
                  setCustomer({ ...customer, address: e.target.value })
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input"
                  placeholder="City"
                  value={customer.city}
                  onChange={(e) =>
                    setCustomer({ ...customer, city: e.target.value })
                  }
                />
                <input
                  className="input"
                  placeholder="Area"
                  value={customer.area}
                  onChange={(e) =>
                    setCustomer({ ...customer, area: e.target.value })
                  }
                />
              </div>
              <textarea
                className="textarea"
                placeholder="Internal notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="glass-strong rounded-[var(--radius-lg)] p-5 sticky top-24">
            <h2 className="font-semibold mb-3">Summary</h2>
            <Row label="Subtotal" value={subtotal} />
            <Row label="Shipping" value={shippingFee} />
            <Row label="Discount" value={-discount} />
            <Row label="Advance" value={-advance} />
            <div className="hairline-t pt-2 mt-2">
              <Row label="Total" value={total} bold />
              <Row label="Remaining" value={remaining} bold />
            </div>
            {error && (
              <div className="text-sm text-red-600 mt-3">{error}</div>
            )}
            <button
              onClick={submit}
              disabled={submitting}
              className="btn btn-primary w-full mt-4"
            >
              {submitting ? "Saving…" : `Create order · ${formatBDT(total)}`}
            </button>
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-24"
            onClick={() => setShowSearch(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-[var(--radius-lg)] p-4 w-full max-w-xl mx-4"
            >
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  className="input flex-1"
                  placeholder="Search products…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  onClick={() => setShowSearch(false)}
                  className="p-2 rounded-full hover:bg-[var(--bg-soft)]"
                >
                  <X size={16} />
                </button>
              </div>
              <ul className="mt-3 max-h-80 overflow-y-auto">
                {filtered.map((p) => (
                  <li
                    key={p._id}
                    className="p-2 hover:bg-[var(--bg-soft)] rounded-lg flex items-center gap-3 cursor-pointer"
                    onClick={() => addProduct(p)}
                  >
                    <div className="relative w-10 h-10 bg-white rounded overflow-hidden flex-shrink-0">
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
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium line-clamp-1">
                        {p.title}
                      </div>
                      <div className="text-xs text-[var(--fg-muted)] capitalize">
                        {p.category.replace(/-/g, " ")} · {formatBDT(p.price)}
                      </div>
                    </div>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="p-4 text-sm text-[var(--fg-muted)] text-center">
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
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-[var(--fg-muted)] uppercase tracking-widest">
        {label}
      </span>
      <input
        className="input text-right"
        type="number"
        min={0}
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
      className={`flex justify-between text-sm py-0.5 ${
        bold ? "font-semibold" : ""
      }`}
    >
      <span className={bold ? "" : "text-[var(--fg-soft)]"}>{label}</span>
      <span className="tabular-nums">{formatBDT(value)}</span>
    </div>
  );
}
