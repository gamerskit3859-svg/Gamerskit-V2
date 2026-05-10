import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { formatBDT, formatDateTime } from "@/lib/format";
import { LinkButton, Card, Section } from "@/components/ui";
import { cn } from "@/lib/cn";

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
    <Section width="narrow" spacing="lg" className="!max-w-3xl">
      <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
        Order placed
      </span>
      <h1 className="mt-2 text-[clamp(36px,5vw,64px)] leading-[1.06] tracking-[-0.035em] font-semibold">
        Thanks, {order!.customer.name.split(" ")[0]}.
      </h1>
      <p className="mt-3 text-fg-soft">
        Your order{" "}
        <span className="font-mono text-foreground">{order!.orderNumber}</span>{" "}
        was placed on {formatDateTime(order!.createdAt)}.
      </p>

      <Card tone="soft" className="mt-10">
        <h2 className="mb-6 font-semibold">Status</h2>
        <ol className="grid gap-4">
          {STATUSES.map((s, i) => {
            const reached = i <= Math.max(0, idx);
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
                  )}
                >
                  {reached ? "✓" : i + 1}
                </span>
                <span className="text-sm">{s.label}</span>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card tone="soft" className="mt-6">
        <h2 className="mb-3 font-semibold">Items</h2>
        <ul className="divide-y divide-line">
          {order!.items.map((l, i) => (
            <li key={i} className="flex justify-between py-3 text-sm">
              <span>
                {l.title} <span className="text-fg-muted">× {l.quantity}</span>
              </span>
              <span>{formatBDT(l.unitPrice * l.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-line pt-3 font-semibold">
          <span>Total</span>
          <span>{formatBDT(order!.total)}</span>
        </div>
      </Card>

      <div className="mt-10 flex gap-3">
        <LinkButton href="/shop" variant="ghost">
          Continue shopping
        </LinkButton>
        <LinkButton href="/track">Track another order</LinkButton>
      </div>
    </Section>
  );
}
