"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatBDT } from "@/lib/format";
import { CATEGORIES, type CategorySlug, type Product } from "@gamerskit/shared";

interface DraftProduct {
  title: string;
  slug: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  images: string;
  featured: boolean;
}

const blank = (): DraftProduct => ({
  title: "",
  slug: "",
  category: CATEGORIES[0]?.slug ?? "rc-car",
  price: 0,
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
    stock: p.stock,
    description: p.description ?? "",
    images: p.images.join("\n"),
    featured: !!p.featured,
  };
}

export default function AdminProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [draft, setDraft] = useState<DraftProduct>(blank());
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setDraft(blank());
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
    const body: Partial<Product> = {
      title: draft.title.trim(),
      slug: draft.slug.trim() || draft.title.trim().toLowerCase().replace(/\s+/g, "-"),
      category: draft.category as CategorySlug,
      price: Number(draft.price),
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
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
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
                    <td className="py-3 px-4 capitalize">{p.category.replace(/-/g, " ")}</td>
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
                      {CATEGORIES.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="eyebrow">Price (৳)</label>
                    <input
                      type="number"
                      className="input mt-1"
                      value={draft.price}
                      onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                    />
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
