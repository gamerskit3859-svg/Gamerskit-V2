"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Sparkles } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { formatBDT } from "@/lib/format";
import {
  createEventId,
  getBrowserMeta,
  track,
  trackInitiateCheckout,
  trackPurchase,
} from "@/lib/fb-pixel";
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
type PaymentType = "full" | "partial";

type OrderSuccess = {
  orderNumber: string;
  total: number;
  paymentMethod: PaymentMethod;
};

interface CheckoutForm {
  name: string;
  phone: string;
  email: string;
  address: string;
  district: string;
  thana: string;
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;
  paidAmount: string;
  senderNumber: string;
  notes: string;
}

const PAYMENT_OPTIONS: Array<{ id: PaymentMethod; label: string; hint: string }> = [
  { id: "cod", label: "Cash on Delivery", hint: "Pay when you receive." },
  { id: "bkash", label: "bKash", hint: "Send advance to 01303-775977." },
  { id: "nagad", label: "Nagad", hint: "Send advance to 01303-775977." },
];

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cod: "Cash on Delivery",
  bkash: "bKash",
  nagad: "Nagad",
};

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
  const [success, setSuccess] = useState<OrderSuccess | null>(null);

  // Pre-fill name/phone/email from the signed-in customer's profile so they
  // don't have to retype it. Reads the auth store once on mount; the persist
  // Prefill from the in-memory cookie-backed auth session when available.
  const [form, setForm] = useState<CheckoutForm>(() => {
    const u = useAuth.getState().user;
    return {
      name: u?.name ?? "",
      phone: u?.phone ?? "",
      email: u?.email ?? "",
      address: "",
      district: "",
      thana: "",
      paymentMethod: "cod",
      paymentType: "full",
      paidAmount: "",
      senderNumber: "",
      notes: "",
    };
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

    const user = useAuth.getState().user;
    trackInitiateCheckout(
      lines,
      user
        ? {
            email: user.email,
            phone: user.phone,
            firstName: user.name?.split(" ")[0],
            lastName: user.name?.split(" ").slice(1).join(" "),
          }
        : undefined,
    );

    // intentionally only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (lines.length === 0 && !success) {
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

  const isMobilePayment =
    form.paymentMethod === "bkash" || form.paymentMethod === "nagad";
  const paidAmount =
    isMobilePayment && form.paymentType === "full"
      ? subtotal
      : Number(form.paidAmount || 0);
  const dueAmount = isMobilePayment ? Math.max(0, subtotal - paidAmount) : subtotal;
  const senderDigits = form.senderNumber.replace(/\D/g, "");
  const senderNumberValid = /^01[3-9]\d{8}$/.test(senderDigits);
  const paymentValid =
    !isMobilePayment ||
    (senderNumberValid &&
      (form.paymentType === "full" ||
        (paidAmount > 0 && paidAmount < subtotal)));
  const paymentError =
    !isMobilePayment || paymentValid
      ? null
      : !senderNumberValid
        ? "Enter a valid sender bKash/Nagad number."
        : "Partial paid amount must be greater than 0 and less than order total.";

  async function submitOrder() {
    setSubmitting(true);
    setError(null);

    try {
      if (!paymentValid) {
        setError(paymentError || "Please check payment details.");
        setSubmitting(false);
        return;
      }

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

      const purchaseEventId = createEventId();
      const browserMeta = getBrowserMeta();
      const cartLines = [...lines];

      const { order, eventId } = await api.createOrder(
        {
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
            selectedVariants: l.selectedVariants,
            variantSku: l.variantSku,
            variantPrice: l.unitPrice,
          })),
          shippingFee: 0,
          discount: 0,
          advance: isMobilePayment ? paidAmount : 0,
          paymentMethod: form.paymentMethod,
          paymentType: isMobilePayment ? form.paymentType : null,
          paidAmount: isMobilePayment ? paidAmount : 0,
          dueAmount: isMobilePayment ? dueAmount : subtotal,
          senderNumber: isMobilePayment ? senderDigits : null,
          source: "storefront",
          notes: form.notes,
          eventId: purchaseEventId,
          ...browserMeta,
        },
      );

      trackPurchase({
        eventId,
        orderId: order.orderNumber,
        value: order.total,
        items: order.items.map((item) => ({
          id: item.variantSku ?? item.productId ?? item.title,
          name: item.title,
          category: cartLines.find((line) => line.productId === item.productId)
            ?.category,
          price: item.unitPrice,
          quantity: item.quantity,
        })),
        user: {
          email: form.email || undefined,
          phone: form.phone,
          firstName: form.name.split(" ")[0],
          lastName: form.name.split(" ").slice(1).join(" "),
        },
      });

      void eventId;

      setSuccess({
        orderNumber: order.orderNumber,
        total: order.total,
        paymentMethod: order.paymentMethod as PaymentMethod,
      });
      clear();
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
    <>
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
                    className="h-11 rounded-[22px] border border-line bg-bg px-3 text-sm outline-none focus:ring-2 focus:ring-black"
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
                    className="h-11 rounded-[22px] border border-line bg-bg px-3 text-sm outline-none focus:ring-2 focus:ring-black disabled:cursor-not-allowed disabled:opacity-60"
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
                    onChange={() =>
                      setForm({
                        ...form,
                        paymentMethod: m.id,
                        paymentType: "full",
                        paidAmount: "",
                        senderNumber: m.id === "cod" ? "" : form.senderNumber,
                      })
                    }
                  />
                </label>
              ))}

              {isMobilePayment && (
                <Card tone="soft" className="grid gap-4">
                  <div>
                    <h3 className="font-semibold">
                      {form.paymentMethod === "bkash" ? "bKash" : "Nagad"} payment
                    </h3>
                    <p className="mt-1 text-sm text-fg-soft">
                      Choose how much you sent and add the sender number.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {(["full", "partial"] as PaymentType[]).map((type) => (
                      <label
                        key={type}
                        className={cn(
                          "flex cursor-pointer items-center justify-between rounded-[22px] border border-line bg-white px-3 py-3 text-sm font-medium",
                          form.paymentType === type && "ring-2 ring-black",
                        )}
                      >
                        <span>
                          {type === "full" ? "Full Payment" : "Partial Payment"}
                        </span>
                        <input
                          type="radio"
                          name="paymentType"
                          checked={form.paymentType === type}
                          onChange={() =>
                            setForm({
                              ...form,
                              paymentType: type,
                              paidAmount: "",
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>

                  {form.paymentType === "partial" && (
                    <Field
                      label="Paid Amount"
                      value={form.paidAmount}
                      onChange={(v) =>
                        setForm({
                          ...form,
                          paidAmount: v.replace(/[^\d.]/g, ""),
                        })
                      }
                    />
                  )}

                  <Field
                    label={`Sender ${
                      form.paymentMethod === "bkash" ? "bKash" : "Nagad"
                    } Number`}
                    value={form.senderNumber}
                    onChange={(v) => setForm({ ...form, senderNumber: v })}
                  />

                  <div className="grid gap-2 rounded-[var(--radius-sm)] border border-line bg-white p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-fg-soft">Paid amount</span>
                      <span className="font-medium">{formatBDT(paidAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-fg-soft">Due amount</span>
                      <span className="font-medium">{formatBDT(dueAmount)}</span>
                    </div>
                  </div>

                  {paymentError && (
                    <p className="text-sm text-red-600">{paymentError}</p>
                  )}
                </Card>
              )}

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

                <Button
                  className="flex-1"
                  disabled={!paymentValid}
                  onClick={() => setStep(3)}
                >
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
                <div className="grid gap-1 text-sm">
                  <p className="capitalize">{form.paymentMethod}</p>
                  {isMobilePayment && (
                    <>
                      <p className="capitalize text-fg-soft">
                        {form.paymentType} payment
                      </p>
                      <p>Paid: {formatBDT(paidAmount)}</p>
                      <p>Due: {formatBDT(dueAmount)}</p>
                      <p>Sender: {senderDigits}</p>
                    </>
                  )}
                </div>
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
    <OrderSuccessModal
      success={success}
      onTrack={() => {
        if (success) router.push(`/order/${success.orderNumber}`);
      }}
      onContinue={() => router.push("/shop")}
    />
    </>
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

function OrderSuccessModal({
  success,
  onTrack,
  onContinue,
}: {
  success: OrderSuccess | null;
  onTrack: () => void;
  onContinue: () => void;
}) {
  return (
    <AnimatePresence>
      {success && (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/45 px-3 py-4 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-success-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/70 bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-green-50 to-transparent" />
            <div className="pointer-events-none absolute right-5 top-5 text-green-500">
              <motion.div
                animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.08, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 0.8 }}
              >
                <Sparkles size={22} />
              </motion.div>
            </div>

            <div className="relative text-center">
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.08, type: "spring", stiffness: 220, damping: 16 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600 ring-8 ring-green-50/60"
              >
                <CheckCircle2 size={34} />
              </motion.div>

              <h2
                id="order-success-title"
                className="mt-5 text-2xl font-semibold tracking-tight text-foreground"
              >
                Congratulations!
              </h2>
              <p className="mt-2 text-sm leading-6 text-fg-soft">
                Your order has been placed successfully.
              </p>
            </div>

            <div className="relative mt-5 rounded-xl border border-line bg-bg-soft p-4 text-sm">
              <div className="flex justify-between gap-4 border-b border-line pb-2">
                <span className="text-fg-soft">Order number</span>
                <span className="break-all text-right font-mono font-medium">
                  {success.orderNumber}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-line py-2">
                <span className="text-fg-soft">Total amount</span>
                <span className="font-semibold">{formatBDT(success.total)}</span>
              </div>
              <div className="flex justify-between gap-4 pt-2">
                <span className="text-fg-soft">Payment method</span>
                <span className="font-medium">{PAYMENT_LABELS[success.paymentMethod]}</span>
              </div>
            </div>

            <div className="relative mt-6 grid gap-2 sm:grid-cols-2">
              <Button onClick={onTrack} className="w-full">
                Track Order
              </Button>
              <Button variant="secondary" onClick={onContinue} className="w-full">
                Continue Shopping
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
