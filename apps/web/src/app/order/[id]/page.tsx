import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { formatBDT, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUSES: Array<{ key: string; label: string }> = [
  { key: "pending", label: "Pending confirmation" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

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
  const idx = STATUSES.findIndex((s) => s.key === order!.status);

  return (
    <section className="px-5 lg:px-8 max-w-3xl mx-auto py-16">
      <span className="eyebrow">Order placed</span>
      <h1 className="display-2 mt-2">Thanks, {order!.customer.name.split(" ")[0]}.</h1>
      <p className="mt-3 text-[var(--fg-soft)]">
        Your order <span className="font-mono text-[var(--fg)]">{order!.orderNumber}</span>{" "}
        was placed on {formatDateTime(order!.createdAt)}.
      </p>

      {/* Status timeline */}
      <div className="mt-10 card-soft p-6">
        <h2 className="font-semibold mb-6">Status</h2>
        <ol className="grid gap-4">
          {STATUSES.map((s, i) => {
            const reached = i <= Math.max(0, idx);
            return (
              <li
                key={s.key}
                className={`flex items-center gap-3 ${
                  reached ? "" : "opacity-40"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                    reached ? "bg-black text-white" : "bg-[var(--bg)]"
                  } border border-[var(--line-strong)]`}
                >
                  {reached ? "✓" : i + 1}
                </span>
                <span className="text-sm">{s.label}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-6 card-soft p-6">
        <h2 className="font-semibold mb-3">Items</h2>
        <ul className="divide-y divide-[var(--line)]">
          {order!.items.map((l, i) => (
            <li key={i} className="py-3 flex justify-between text-sm">
              <span>
                {l.title}{" "}
                <span className="text-[var(--fg-muted)]">× {l.quantity}</span>
              </span>
              <span>{formatBDT(l.unitPrice * l.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="hairline-t mt-3 pt-3 flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatBDT(order!.total)}</span>
        </div>
      </div>

      <div className="mt-10 flex gap-3">
        <Link href="/shop" className="btn btn-ghost">
          Continue shopping
        </Link>
        <Link href="/track" className="btn btn-primary">
          Track another order
        </Link>
      </div>
    </section>
  );
}
