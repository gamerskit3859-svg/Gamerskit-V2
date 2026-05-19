import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Track Order",
  description: "Track your GamersKit order status with your phone number.",
  path: "/track",
  keywords: ["track GamersKit order", "order tracking Bangladesh"],
});

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
