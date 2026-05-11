"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CldUploadWidget } from "next-cloudinary";
import { Upload, X } from "lucide-react";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatBDT } from "@/lib/format";
import type { Product } from "@/types/shared";
import {
  Button,
  Card,
  FieldLabel,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/cn";

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
  images: string[];
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
  images: [],
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
    images: p.images,
    featured: !!p.featured,
  };
}

function stockColor(stock: number): string {
  if (stock > 5) return "text-foreground";
  if (stock > 0) return "text-yellow-700";
  return "text-red-600";
}

export default function AdminProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setCategoriesLoading] = useState(true);
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
      try {
        const result = await api.listCategories();
        if (!cancelled) {
          const topLevel = (result.items as Category[]).filter(
            (c: Category & { parentId?: string | null }) => !c.parentId,
          );
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

    const selectedCategory = categories.find((c) => c.slug === draft.category);
    if (!selectedCategory) {
      setError("Please select a valid category");
      setBusy(false);
      return;
    }

    const body: Partial<Product> = {
      title: draft.title.trim(),
      slug:
        draft.slug.trim() ||
        draft.title.trim().toLowerCase().replace(/\s+/g, "-"),
      category: selectedCategory._id,
      price: Number(draft.price),
      buyingPrice: Number(draft.buyingPrice) || 0,
      stock: Number(draft.stock),
      description: draft.description,
      images: draft.images,
      featured: draft.featured,
    };
    try {
      if (editing) {
        const r = await api.updateProduct(editing._id, body, token);
        setItems((prev) =>
          prev.map((p) => (p._id === editing._id ? r.item : p)),
        );
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
          <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
            Admin
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Products
          </h1>
          <p className="mt-1 text-sm text-fg-soft">
            {items.length} products. Use <code>npm run seed</code> to import 34
            from gamerskitbd.com.
          </p>
        </div>
        <Button onClick={startCreate}>+ New product</Button>
      </header>

      <div className="mb-5 mt-3 flex flex-wrap gap-3">
        <Input
          className="!w-72"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select
          className="!w-auto"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <Card tone="soft" padding="none" className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-fg-muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-fg-muted">
            No products. Create one or run <code>npm run seed</code>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white text-left text-xs text-fg-soft">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Featured</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr
                    key={p._id}
                    className="border-t border-line bg-white hover:bg-bg-soft"
                  >
                    <td className="flex items-center gap-3 px-4 py-3">
                      <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-bg-soft">
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
                        <div className="font-mono text-xs text-fg-muted">
                          {p.slug}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {categories.find((c) => c._id === p.category)?.name ||
                        "Unknown"}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatBDT(p.price)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs", stockColor(p.stock))}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {p.featured ? "Yes" : "—"}
                    </td>
                    <td className="space-x-3 whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/product/${p.slug}`}
                        target="_blank"
                        className="text-xs underline underline-offset-4"
                      >
                        Open ↗
                      </Link>
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        className="text-xs underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(p)}
                        className="text-xs text-red-600 underline"
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
      </Card>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
            onClick={() => !busy && setOpen(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl"
            >
              <h2 className="mb-4 text-xl font-semibold">
                {editing ? `Edit ${editing.title}` : "New product"}
              </h2>
              <div className="space-y-3">
                <FieldLabel label="Title">
                  <Input
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                  />
                </FieldLabel>
                <div className="grid grid-cols-2 gap-3">
                  <FieldLabel label="Slug">
                    <Input
                      className="font-mono"
                      value={draft.slug}
                      onChange={(e) =>
                        setDraft({ ...draft, slug: e.target.value })
                      }
                      placeholder="auto from title"
                    />
                  </FieldLabel>
                  <FieldLabel label="Category">
                    <Select
                      value={draft.category}
                      onChange={(e) =>
                        setDraft({ ...draft, category: e.target.value })
                      }
                    >
                      {categories.map((c) => (
                        <option key={c._id} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </FieldLabel>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <FieldLabel label="Selling price (৳)">
                    <Input
                      type="number"
                      value={draft.price}
                      onChange={(e) =>
                        setDraft({ ...draft, price: Number(e.target.value) })
                      }
                    />
                  </FieldLabel>
                  <FieldLabel label="Buying price (৳)">
                    <Input
                      type="number"
                      value={draft.buyingPrice}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          buyingPrice: Number(e.target.value),
                        })
                      }
                      placeholder="0"
                    />
                    <p className="mt-1 text-[11px] text-fg-muted">
                      Wholesale cost per unit. Used to compute gross profit in
                      reports.
                    </p>
                  </FieldLabel>
                  <FieldLabel label="Stock">
                    <Input
                      type="number"
                      value={draft.stock}
                      onChange={(e) =>
                        setDraft({ ...draft, stock: Number(e.target.value) })
                      }
                    />
                  </FieldLabel>
                </div>
                <FieldLabel label="Product Images">
                  <div className="space-y-3">
                    {/* Image Previews */}
                    {draft.images.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {draft.images.map((url, index) => (
                          <div key={index} className="relative group">
                            <div className="aspect-square relative overflow-hidden rounded-lg border border-line bg-bg-soft">
                              <Image
                                src={url}
                                alt={`Product image ${index + 1}`}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 50vw, 25vw"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setDraft({
                                    ...draft,
                                    images: draft.images.filter((_, i) => i !== index),
                                  });
                                }}
                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload Widget */}
                    <CldUploadWidget
                      uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
                      onSuccess={(result: any) => {
                        if (result.event === "success") {
                          setDraft({
                            ...draft,
                            images: [...draft.images, result.info.secure_url],
                          });
                        }
                      }}
                      options={{
                        maxFiles: 10,
                        maxFileSize: 5000000, // 5MB
                        resourceType: "image",
                        clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
                      }}
                    >
                      {({ open, isLoading }) => (
                        <button
                          type="button"
                          onClick={() => open()}
                          disabled={isLoading}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line bg-bg-soft py-8 text-sm text-fg-muted transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                        >
                          <Upload size={20} />
                          {isLoading ? "Uploading..." : "Click to upload images"}
                        </button>
                      )}
                    </CldUploadWidget>

                    <p className="text-xs text-fg-muted">
                      Upload up to 10 images. Max 5MB each. Supported formats: JPG, PNG, WebP.
                    </p>
                  </div>
                </FieldLabel>
                <FieldLabel label="Description">
                  <Textarea
                    className="h-20"
                    value={draft.description}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                  />
                </FieldLabel>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.featured}
                    onChange={(e) =>
                      setDraft({ ...draft, featured: e.target.checked })
                    }
                  />
                  Featured on landing page
                </label>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button onClick={save} disabled={busy || !draft.title}>
                  {busy ? "Saving…" : editing ? "Save changes" : "Create"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
