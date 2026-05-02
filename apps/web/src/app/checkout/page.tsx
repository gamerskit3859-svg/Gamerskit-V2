"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useCart } from "@/lib/cart";
import { formatBDT } from "@/lib/format";
import { track } from "@/lib/fb-pixel";
import { api } from "@/lib/api";

type Step = 1 | 2 | 3;

export default function CheckoutPage() {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const subtotal = useCart((s) => s.subtotal());
  const clear = useCart((s) => s.clear);
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "Dhaka",
    area: "",
    paymentMethod: "cod" as "cod" | "bkash" | "nagad",
    notes: "",
  });

  useEffect(() => {
    if (lines.length === 0) return;
    track({
      event: "InitiateCheckout",
      currency: "BDT",
      value: subtotal,
      contentIds: lines.map((l) => l.productId),
      items: lines.map((l) => ({
        id: l.productId,
        name: l.title,
        category: l.category,
        price: l.unitPrice,
        quantity: l.quantity,
      })),
    });
    // intentionally only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (lines.length === 0) {
    return (
      <section className="px-5 max-w-2xl mx-auto py-24 text-center">
        <h1 className="display-2">Your bag is empty.</h1>
        <Link href="/shop" className="btn btn-primary mt-6 inline-flex">
          Browse shop
        </Link>
      </section>
    );
  }

  async function submitOrder() {
    setSubmitting(true);
    setError(null);
    try {
      track({
        event: "AddPaymentInfo",
        currency: "BDT",
        value: subtotal,
        contentIds: lines.map((l) => l.productId),
        user: {
          email: form.email || undefined,
          phone: form.phone,
          firstName: form.name.split(" ")[0],
          lastName: form.name.split(" ").slice(1).join(" "),
          city: form.city,
        },
      });
      const { order, eventId } = await api.createOrder({
        customer: {
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          address: form.address,
          city: form.city,
          area: form.area,
        },
        items: lines.map((l) => ({
          productId: l.productId,
          title: l.title,
          image: l.image,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
        })),
        shippingFee: 0,
        discount: 0,
        advance: 0,
        paymentMethod: form.paymentMethod,
        source: "storefront",
        notes: form.notes,
      });
      track({
        event: "Purchase",
        currency: "BDT",
        value: order.total,
        orderId: order.orderNumber,
        contentIds: lines.map((l) => l.productId),
        items: lines.map((l) => ({
          id: l.productId,
          name: l.title,
          category: l.category,
          price: l.unitPrice,
          quantity: l.quantity,
        })),
        user: {
          email: form.email || undefined,
          phone: form.phone,
          firstName: form.name.split(" ")[0],
          lastName: form.name.split(" ").slice(1).join(" "),
          city: form.city,
        },
      });
      // Note: server already fired CAPI Purchase with its own event_id.
      // The browser fires the same name; Meta will dedupe if eventId matches.
      // We don't depend on that here; double events are also acceptable.
      void eventId;
      clear();
      router.push(`/order/${order.orderNumber}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const canStep2 =
    form.name.trim().length > 1 &&
    form.phone.replace(/\D/g, "").length >= 10 &&
    form.address.trim().length > 4 &&
    form.city.trim().length > 1;

  return (
    <section className="px-5 lg:px-8 max-w-[1100px] mx-auto py-12">
      <span className="eyebrow">Checkout</span>
      <h1 className="display-2 mt-2 mb-8">Almost there.</h1>

      {/* progress */}
      <div className="mb-10 flex items-center gap-2 text-xs text-[var(--fg-soft)]">
        {([1, 2, 3] as Step[]).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center font-medium ${
                step >= s
                  ? "bg-black text-white"
                  : "bg-[var(--bg-soft)] text-[var(--fg-muted)]"
              }`}
            >
              {s}
            </span>
            {s < 3 && <span className="w-12 h-px bg-[var(--line-strong)]" />}
          </div>
        ))}
        <span className="ml-4 uppercase tracking-widest">
          {step === 1 ? "Information" : step === 2 ? "Payment" : "Review"}
        </span>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-10 items-start">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {step === 1 && (
            <div className="grid gap-3">
              <Field
                label="Full name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Phone"
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                />
                <Field
                  label="Email (optional)"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                />
              </div>
              <Field
                label="Address"
                value={form.address}
                onChange={(v) => setForm({ ...form, address: v })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="City"
                  value={form.city}
                  onChange={(v) => setForm({ ...form, city: v })}
                />
                <Field
                  label="Area"
                  value={form.area}
                  onChange={(v) => setForm({ ...form, area: v })}
                />
              </div>
              <button
                disabled={!canStep2}
                onClick={() => setStep(2)}
                className="btn btn-primary mt-4 w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-3">
              {(["cod", "bkash", "nagad"] as const).map((m) => (
                <label
                  key={m}
                  className={`card-soft p-4 cursor-pointer flex justify-between items-center ${
                    form.paymentMethod === m ? "ring-2 ring-black" : ""
                  }`}
                >
                  <div>
                    <div className="font-medium capitalize">
                      {m === "cod"
                        ? "Cash on Delivery"
                        : m === "bkash"
                          ? "bKash"
                          : "Nagad"}
                    </div>
                    <div className="text-sm text-[var(--fg-soft)]">
                      {m === "cod"
                        ? "Pay when you receive."
                        : m === "bkash"
                          ? "Send advance to 01303-775977."
                          : "Send advance to 01303-775977."}
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="payment"
                    checked={form.paymentMethod === m}
                    onChange={() => setForm({ ...form, paymentMethod: m })}
                  />
                </label>
              ))}
              <textarea
                className="textarea mt-2"
                placeholder="Order notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              <div className="flex gap-3 mt-4">
                <button
                  className="btn btn-ghost flex-1"
                  onClick={() => setStep(1)}
                >
                  Back
                </button>
                <button className="btn btn-primary flex-1" onClick={() => setStep(3)}>
                  Review order
                </button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="grid gap-4">
              <div className="card-soft p-5">
                <h3 className="font-semibold mb-3">Delivery to</h3>
                <p className="text-sm leading-relaxed">
                  {form.name}
                  <br />
                  {form.phone}
                  {form.email && (
                    <>
                      <br />
                      {form.email}
                    </>
                  )}
                  <br />
                  {form.address}, {form.area && `${form.area}, `}
                  {form.city}
                </p>
              </div>
              <div className="card-soft p-5">
                <h3 className="font-semibold mb-3">Payment</h3>
                <p className="text-sm capitalize">{form.paymentMethod}</p>
              </div>
              {error && (
                <div className="text-sm text-red-600">Error: {error}</div>
              )}
              <div className="flex gap-3">
                <button
                  className="btn btn-ghost flex-1"
                  onClick={() => setStep(2)}
                >
                  Back
                </button>
                <button
                  className="btn btn-primary flex-1"
                  onClick={submitOrder}
                  disabled={submitting}
                >
                  {submitting ? "Placing…" : `Place order · ${formatBDT(subtotal)}`}
                </button>
              </div>
            </div>
          )}
        </motion.div>

        <aside className="glass-strong rounded-[var(--radius-lg)] p-6 h-fit sticky top-24">
          <h2 className="font-semibold text-lg mb-4">Your order</h2>
          <ul className="flex flex-col gap-3">
            {lines.map((l) => (
              <li key={l.productId} className="flex gap-3 items-center">
                <div className="relative w-12 h-12 rounded-md overflow-hidden bg-white flex-shrink-0">
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
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium line-clamp-1">
                    {l.title}
                  </div>
                  <div className="text-xs text-[var(--fg-muted)]">
                    Qty {l.quantity}
                  </div>
                </div>
                <div className="text-sm font-medium">
                  {formatBDT(l.unitPrice * l.quantity)}
                </div>
              </li>
            ))}
          </ul>
          <div className="hairline-t mt-4 pt-4 flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatBDT(subtotal)}</span>
          </div>
        </aside>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-[var(--fg-soft)]">{label}</span>
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
