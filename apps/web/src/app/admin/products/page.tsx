"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatBDT } from "@/lib/format";
import type { Product } from "@gamerskit/shared";

export default function AdminProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const r = await api.listProducts({
          q: q || undefined,
          category: category === "all" ? undefined : category,
        });
        if (!cancelled) setItems(r.items);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, category]);

  return (
    <div>
      <header className="mb-6">
        <span className="eyebrow">Admin</span>
        <h1 className="text-3xl font-semibold tracking-tight mt-2">Products</h1>
        <p className="text-sm text-[var(--fg-soft)] mt-1">
          {items.length} products. Use the storefront seed script to import 34
          products from gamerskitbd.com.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <input
            className="input !w-72"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="select !w-auto"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            <option value="rc-car">RC Cars</option>
            <option value="f1-jersey">F1 Jerseys</option>
            <option value="esports">E-sports</option>
            <option value="tshirt">T-Shirts</option>
            <option value="sleeves">Sleeves</option>
            <option value="mask">Masks</option>
            <option value="yoyo">YoYo</option>
            <option value="pc-accessories">PC Accessories</option>
            <option value="consoles">Consoles</option>
          </select>
        </div>
      </header>

      <div className="card-soft p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-[var(--fg-muted)]">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-sm text-[var(--fg-muted)] text-center">
            No products. Run <code>npm run seed</code> from the api workspace.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white text-xs text-[var(--fg-soft)] text-left">
                <tr>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-4">View</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p._id} className="hairline-t bg-white hover:bg-[var(--bg-soft)]">
                    <td className="py-3 px-4 flex items-center gap-3">
                      <div className="relative w-10 h-10 bg-[var(--bg-soft)] rounded overflow-hidden flex-shrink-0">
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
                      <div>
                        <div className="font-medium">{p.title}</div>
                        <div className="text-xs text-[var(--fg-muted)] font-mono">
                          {p.slug}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 capitalize">
                      {p.category.replace(/-/g, " ")}
                    </td>
                    <td className="py-3 px-4 font-medium">
                      {formatBDT(p.price)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs ${
                          p.stock > 5
                            ? "text-[var(--fg)]"
                            : p.stock > 0
                              ? "text-yellow-700"
                              : "text-red-600"
                        }`}
                      >
                        {p.stock}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/product/${p.slug}`}
                        className="text-xs underline underline-offset-4"
                      >
                        Open ↗
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
