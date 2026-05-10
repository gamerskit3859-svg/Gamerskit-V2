"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatBDT } from "@/lib/format";
import type { Product } from "@gamerskit/shared";

interface Category {
  _id: string;
  slug: string;
  name: string;
}

interface DraftProduct {
  title: string;
  slug: string;
  category: string;
  price: number;
  buyingPrice: number;
  stock: number;
  description: string;
  images: string;
  featured: boolean;
}

const blank = (firstCategorySlug?: string): DraftProduct => ({
  title: "",
  slug: "",
  category: firstCategorySlug ?? "",
  price: 0,
  buyingPrice: 0,
  stock: 0,
  description: "",
  images: "",
  featured: false,
});

function fromProduct(p: Product): DraftProduct {
  return {
    title: p.title,
    slug: p.slug,
    category: p.category,
    price: p.price,
    buyingPrice: p.buyingPrice ?? 0,
    stock: p.stock,
    description: p.description ?? "",
    images: p.images.join("\n"),
    featured: !!p.featured,
  };
}

export default function AdminProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [draft, setDraft] = useState<DraftProduct>(blank());
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load categories on mount
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await api.listCategories();
        if (!cancelled) {
          // Filter top-level categories
          const topLevel = (result.items as any[]).filter((c) => !c.parentId);
          setCategories(topLevel);
          if (topLevel.length > 0) {
            setDraft(blank(topLevel[0].slug));
          }
        }
      } catch (err) {
        console.error("Failed to load categories:", err);
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const r = await api.listProducts({
          q: q || undefined,
          category: category === "all" ? undefined : category,
          limit: 200,
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

  function startCreate() {
    setEditing(null);
    setDraft(blank(categories.length > 0 ? categories[0].slug : ""));
    setError(null);
    setOpen(true);
  }

  function startEdit(p: Product) {
    setEditing(p);
    setDraft(fromProduct(p));
    setError(null);
    setOpen(true);
  }

  async function save() {
    const token = getAdminToken();
    if (!token) return;
    setBusy(true);
    setError(null);
    
    // Find the category ID by slug
    const selectedCategory = categories.find((c) => c.slug === draft.category);
    if (!selectedCategory) {
      setError("Please select a valid category");
      setBusy(false);
      return;
    }

    const body: Partial<Product> = {
      title: draft.title.trim(),
      slug: draft.slug.trim() || draft.title.trim().toLowerCase().replace(/\s+/g, "-"),
      category: selectedCategory._id,
      price: Number(draft.price),
      buyingPrice: Number(draft.buyingPrice) || 0,
      stock: Number(draft.stock),
      description: draft.description,
      images: draft.images
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean),
      featured: draft.featured,
    };
    try {
      if (editing) {
        const r = await api.updateProduct(editing._id, body, token);
        setItems((prev) => prev.map((p) => (p._id === editing._id ? r.item : p)));
      } else {
        const r = await api.createProduct(body, token);
        setItems((prev) => [r.item, ...prev]);
      }
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Product) {
    if (!confirm(`Delete ${p.title}?`)) return;
    const token = getAdminToken();
    if (!token) return;
    await api.deleteProduct(p._id, token);
    setItems((prev) => prev.filter((x) => x._id !== p._id));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Admin</span>
          <h1 className="text-3xl font-semibold tracking-tight mt-2">Products</h1>
          <p className="text-sm text-[var(--fg-soft)] mt-1">
            {items.length} products. Use <code>npm run seed</code> to import 34 from gamerskitbd.com.
          </p>
        </div>
        <button onClick={startCreate} className="btn btn-primary">
          + New product
        </button>
      </header>

      <div className="mt-3 mb-5 flex flex-wrap gap-3">
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
          {categories.map((c) => (
            <option key={c._id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card-soft p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-[var(--fg-muted)]">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-sm text-[var(--fg-muted)] text-center">
            No products. Create one or run <code>npm run seed</code>.
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
                  <th className="py-3 px-4">Featured</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p._id} className="hairline-t bg-white hover:bg-[var(--bg-soft)]">
                    <td className="py-3 px-4 flex items-center gap-3">
                      <div className="relative w-10 h-10 bg-[var(--bg-soft)] rounded overflow-hidden flex-shrink-0">
                        {p.images[0] && (
                          <Image src={p.images[0]} alt="" fill sizes="40px" className="object-cover" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{p.title}</div>
                        <div className="text-xs text-[var(--fg-muted)] font-mono">{p.slug}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 capitalize">
                      {categories.find((c) => c._id === p.category)?.name || "Unknown"}
                    </td>
                    <td className="py-3 px-4 font-medium">{formatBDT(p.price)}</td>
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
                    <td className="py-3 px-4 text-xs">{p.featured ? "Yes" : "—"}</td>
                    <td className="py-3 px-4 text-right space-x-3 whitespace-nowrap">
                      <Link
                        href={`/product/${p.slug}`}
                        target="_blank"
                        className="text-xs underline underline-offset-4"
                      >
                        Open ↗
                      </Link>
                      <button onClick={() => startEdit(p)} className="text-xs underline">
                        Edit
                      </button>
                      <button
                        onClick={() => remove(p)}
                        className="text-xs underline text-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !busy && setOpen(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-xl"
            >
              <h2 className="text-xl font-semibold mb-4">
                {editing ? `Edit ${editing.title}` : "New product"}
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="eyebrow">Title</label>
                  <input
                    className="input mt-1"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="eyebrow">Slug</label>
                    <input
                      className="input mt-1 font-mono"
                      value={draft.slug}
                      onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                      placeholder="auto from title"
                    />
                  </div>
                  <div>
                    <label className="eyebrow">Category</label>
                    <select
                      className="select mt-1"
                      value={draft.category}
                      onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    >
                      {categories.map((c) => (
                        <option key={c._id} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="eyebrow">Selling price (৳)</label>
                    <input
                      type="number"
                      className="input mt-1"
                      value={draft.price}
                      onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="eyebrow">Buying price (৳)</label>
                    <input
                      type="number"
                      className="input mt-1"
                      value={draft.buyingPrice}
                      onChange={(e) => setDraft({ ...draft, buyingPrice: Number(e.target.value) })}
                      placeholder="0"
                    />
                    <p className="text-[11px] text-[var(--fg-muted)] mt-1">
                      Wholesale cost per unit. Used to compute gross profit in reports.
                    </p>
                  </div>
                  <div>
                    <label className="eyebrow">Stock</label>
                    <input
                      type="number"
                      className="input mt-1"
                      value={draft.stock}
                      onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div>
                  <label className="eyebrow">Image URLs (one per line)</label>
                  <textarea
                    className="textarea mt-1 h-20 font-mono text-xs"
                    value={draft.images}
                    onChange={(e) => setDraft({ ...draft, images: e.target.value })}
                  />
                </div>
                <div>
                  <label className="eyebrow">Description</label>
                  <textarea
                    className="textarea mt-1 h-20"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.featured}
                    onChange={(e) => setDraft({ ...draft, featured: e.target.checked })}
                  />
                  Featured on landing page
                </label>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setOpen(false)} className="btn btn-ghost" disabled={busy}>
                  Cancel
                </button>
                <button
                  onClick={save}
                  className="btn btn-primary"
                  disabled={busy || !draft.title}
                >
                  {busy ? "Saving…" : editing ? "Save changes" : "Create"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
