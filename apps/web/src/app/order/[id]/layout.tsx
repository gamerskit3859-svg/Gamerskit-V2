import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Order Details",
  description: "View your GamersKit order details.",
  path: "/order",
  noIndex: true,
});

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
