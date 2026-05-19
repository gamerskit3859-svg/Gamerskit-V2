import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "My Account",
  description: "Manage your GamersKit account and order history.",
  path: "/account",
  noIndex: true,
});

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
