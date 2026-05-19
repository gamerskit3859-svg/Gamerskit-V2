import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Shopping Cart",
  description: "Review your GamersKit shopping cart before checkout.",
  path: "/cart",
  noIndex: true,
});

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
