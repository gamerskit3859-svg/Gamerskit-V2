"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useCart } from "@/lib/cart";
import { formatBDT } from "@/lib/format";
import { track } from "@/lib/fb-pixel";
import { api } from "@/lib/api";
import {
  Button,
  LinkButton,
  Card,
  Section,
  Input,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { allLocation } from "@/static/Location";

type Step = 1 | 2 | 3;
type PaymentMethod = "cod" | "bkash" | "nagad";

interface CheckoutForm {
  name: string;
  phone: string;
  email: string;
  address: string;
  district: string;
  thana: string;
  paymentMethod: PaymentMethod;
  notes: string;
}

const PAYMENT_OPTIONS: Array<{ id: PaymentMethod; label: string; hint: string }> = [
  { id: "cod", label: "Cash on Delivery", hint: "Pay when you receive." },
  { id: "bkash", label: "bKash", hint: "Send advance to 01303-775977." },
  { id: "nagad", label: "Nagad", hint: "Send advance to 01303-775977." },
];

const STEP_LABELS: Record<Step, string> = {
  1: "Information",
  2: "Payment",
  3: "Review",
};

export default function CheckoutPage() {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const subtotal = useCart((s) => s.subtotal());
  const clear = useCart((s) => s.clear);

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<CheckoutForm>({
    name: "",
    phone: "",
    email: "",
    address: "",
    district: "",
    thana: "",
    paymentMethod: "cod",
    notes: "",
  });

  const locations = useMemo(() => allLocation(), []);

  const selectedDistrict = useMemo(
    () => locations.find((item) => item.district === form.district),
    [locations, form.district],
  );

  const thanas = useMemo(
    () => selectedDistrict?.thana.filter(Boolean) || [],
    [selectedDistrict],
  );

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
      <Section width="narrow" spacing="lg" className="!max-w-2xl text-center">
        <h1 className="text-[clamp(36px,5vw,64px)] leading-[1.06] tracking-[-0.035em] font-semibold">
          Your bag is empty.
        </h1>

        <LinkButton href="/shop" className="mt-6">
          Browse shop
        </LinkButton>
      </Section>
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
        },
      });

      const { order, eventId } = await api.createOrder({
        customer: {
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          address: form.address,
          district: form.district,
          thana: form.thana,
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
        },
      });

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
    form.district.trim().length > 1 &&
    form.thana.trim().length > 1;

  return (
    <Section width="narrow" spacing="md" className="!max-w-[1100px]">
      <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
        Checkout
      </span>

      <h1 className="mt-2 mb-8 text-[clamp(36px,5vw,64px)] leading-[1.06] tracking-[-0.035em] font-semibold">
        Almost there.
      </h1>

      <div className="mb-10 flex items-center gap-2 text-xs text-fg-soft">
        {([1, 2, 3] as Step[]).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full font-medium",
                step >= s ? "bg-black text-white" : "bg-bg-soft text-fg-muted",
              )}
            >
              {s}
            </span>

            {s < 3 && <span className="h-px w-12 bg-line-strong" />}
          </div>
        ))}

        <span className="ml-4 uppercase tracking-widest">
          {STEP_LABELS[step]}
        </span>
      </div>

      <div className="grid items-start gap-10 lg:grid-cols-[1fr_360px]">
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-fg-soft">District</span>

                  <select
                    value={form.district}
                    onChange={(e) => {
                      setForm({
                        ...form,
                        district: e.target.value,
                        thana: "",
                      });
                    }}
                    className="h-11 rounded-[var(--radius-sm)] border border-line bg-bg px-3 text-sm outline-none focus:ring-2 focus:ring-black"
                  >
                    <option value="">Select district</option>

                    {locations.map((item) => (
                      <option key={item.name} value={item.district}>
                        {item.district}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-fg-soft">Thana</span>

                  <select
                    value={form.thana}
                    onChange={(e) =>
                      setForm({ ...form, thana: e.target.value })
                    }
                    disabled={!form.district}
                    className="h-11 rounded-[var(--radius-sm)] border border-line bg-bg px-3 text-sm outline-none focus:ring-2 focus:ring-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">Select thana</option>

                    {thanas.map((thana) => (
                      <option key={thana} value={thana}>
                        {thana}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <Button
                disabled={!canStep2}
                onClick={() => setStep(2)}
                className="mt-4 w-full"
              >
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-3">
              {PAYMENT_OPTIONS.map((m) => (
                <label
                  key={m.id}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-[var(--radius-md)] border border-line bg-bg-soft p-4 transition-shadow",
                    form.paymentMethod === m.id && "ring-2 ring-black",
                  )}
                >
                  <div>
                    <div className="font-medium">{m.label}</div>
                    <div className="text-sm text-fg-soft">{m.hint}</div>
                  </div>

                  <input
                    type="radio"
                    name="payment"
                    checked={form.paymentMethod === m.id}
                    onChange={() => setForm({ ...form, paymentMethod: m.id })}
                  />
                </label>
              ))}

              <Textarea
                placeholder="Order notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-2"
              />

              <div className="mt-4 flex gap-3">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>

                <Button className="flex-1" onClick={() => setStep(3)}>
                  Review order
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4">
              <Card tone="soft">
                <h3 className="mb-3 font-semibold">Delivery to</h3>

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
                  {form.address}, {form.thana}, {form.district}
                </p>
              </Card>

              <Card tone="soft">
                <h3 className="mb-3 font-semibold">Payment</h3>
                <p className="text-sm capitalize">{form.paymentMethod}</p>
              </Card>

              {error && <div className="text-sm text-red-600">Error: {error}</div>}

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setStep(2)}
                >
                  Back
                </Button>

                <Button
                  className="flex-1"
                  onClick={submitOrder}
                  disabled={submitting}
                >
                  {submitting ? "Placing…" : `Place order · ${formatBDT(subtotal)}`}
                </Button>
              </div>
            </div>
          )}
        </motion.div>

        <aside className="glass-strong sticky top-24 h-fit rounded-[var(--radius-lg)] p-6">
          <h2 className="mb-4 text-lg font-semibold">Your order</h2>

          <ul className="flex flex-col gap-3">
            {lines.map((l) => (
              <li key={l.productId} className="flex items-center gap-3">
                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-white">
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

                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-sm font-medium">
                    {l.title}
                  </div>
                  <div className="text-xs text-fg-muted">Qty {l.quantity}</div>
                </div>

                <div className="text-sm font-medium">
                  {formatBDT(l.unitPrice * l.quantity)}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex justify-between border-t border-line pt-4 font-semibold">
            <span>Total</span>
            <span>{formatBDT(subtotal)}</span>
          </div>
        </aside>
      </div>
    </Section>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function Field({ label, value, onChange }: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-fg-soft">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}