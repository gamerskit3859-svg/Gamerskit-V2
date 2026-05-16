"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CldUploadWidget } from "next-cloudinary";
import type {
  CloudinaryUploadWidgetError,
  CloudinaryUploadWidgetResults,
} from "next-cloudinary";
import { Upload, X, AlertCircle, CheckCircle2 } from "lucide-react";

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
  parentId?: string | null;
}

type ProductCategory =
  | string
  | {
      _id?: string;
      slug?: string;
      name?: string;
    };

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

function getProductCategoryValue(category: ProductCategory): string {
  if (!category) return "";

  if (typeof category === "string") {
    return category;
  }

  return category.slug || category._id || "";
}

function fromProduct(p: Product, categories: Category[]): DraftProduct {
  const categoryValue = getProductCategoryValue(
    p.category as ProductCategory,
  );

  const matchedCategory = categories.find(
    (c) => c._id === categoryValue || c.slug === categoryValue,
  );

  return {
    title: p.title,
    slug: p.slug,
    category: matchedCategory?.slug ?? "",
    price: p.price,
    buyingPrice: p.buyingPrice ?? 0,
    stock: p.stock,
    description: p.description ?? "",
    images: p.images ?? [],
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
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");

  const [draft, setDraft] = useState<DraftProduct>(blank());
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadState, setUploadState] = useState<
    | { kind: "idle" }
    | { kind: "uploading" }
    | { kind: "success"; count: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setCategoriesLoading(true);

      try {
        const result = await api.listCategories();

        if (!cancelled) {
          const topLevel = (result.items as Category[]).filter(
            (c) => !c.parentId,
          );

          setCategories(topLevel);

          if (topLevel.length > 0) {
            setDraft(blank(topLevel[0].slug));
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to load categories:", err);
        }

        if (!cancelled) {
          setCategories([]);
        }
      } finally {
        if (!cancelled) {
          setCategoriesLoading(false);
        }
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

        if (!cancelled) {
          setItems(r.items);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
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
    setUploadState({ kind: "idle" });
    setOpen(true);
  }

  function startEdit(p: Product) {
    if (categoriesLoading || categories.length === 0) {
      setError("Categories are still loading. Please try again.");
      return;
    }

    setEditing(p);
    setDraft(fromProduct(p, categories));
    setError(null);
    setUploadState({ kind: "idle" });
    setOpen(true);
  }

  async function save() {
    const token = getAdminToken();

    if (!token) {
      setError("Admin token not found. Please login again.");
      return;
    }

    setBusy(true);
    setError(null);

    const selectedCategory = categories.find(
      (c) => c.slug === draft.category || c._id === draft.category,
    );

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

    if (!token) {
      setError("Admin token not found. Please login again.");
      return;
    }

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
            {items.length} products.
          </p>

          {error && !open && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        <Button onClick={startCreate} disabled={categoriesLoading}>
          + New product
        </Button>
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
          disabled={categoriesLoading}
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
            No products
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-sm">
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
                {items.map((p) => {
                  const productCategoryValue = getProductCategoryValue(
                    p.category as ProductCategory,
                  );

                  const productCategory = categories.find(
                    (c) =>
                      c._id === productCategoryValue ||
                      c.slug === productCategoryValue,
                  );

                  return (
                    <tr
                      key={p._id}
                      className="border-t border-line bg-white hover:bg-bg-soft"
                    >
                      <td className="flex items-center gap-3 px-4 py-3">
                        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-bg-soft">
                          {p.images?.[0] && (
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
                        {productCategory?.name || "Unknown"}
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
                          disabled={categoriesLoading}
                          className="text-xs underline disabled:cursor-not-allowed disabled:opacity-50"
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
                  );
                })}
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
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-3 py-6 backdrop-blur-sm sm:p-4"
            onClick={() => !busy && setOpen(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-xl sm:p-6"
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

                <div className="grid gap-3 sm:grid-cols-2">
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
                      disabled={categoriesLoading}
                    >
                      <option value="" disabled>
                        Select category
                      </option>

                      {categories.map((c) => (
                        <option key={c._id} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </FieldLabel>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <FieldLabel label="Selling price (৳)">
                    <Input
                      type="number"
                      value={draft.price}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          price: Number(e.target.value),
                        })
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
                        setDraft({
                          ...draft,
                          stock: Number(e.target.value),
                        })
                      }
                    />
                  </FieldLabel>
                </div>

                <FieldLabel label="Product Images">
                  <div className="space-y-3">
                    {draft.images.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {draft.images.map((url, index) => (
                          <div key={url} className="group relative">
                            <div className="relative aspect-square overflow-hidden rounded-lg border border-line bg-bg-soft">
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
                                    images: draft.images.filter(
                                      (_, i) => i !== index,
                                    ),
                                  });
                                }}
                                className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {uploadPreset ? (
                      <CldUploadWidget
                        uploadPreset={uploadPreset}
                        onOpen={() => setUploadState({ kind: "uploading" })}
                        onQueuesEnd={(
                          results: CloudinaryUploadWidgetResults,
                        ) => {
                          const info = results?.info;

                          if (info && typeof info === "object") {
                            // no-op
                          }
                        }}
                        onSuccess={(result: CloudinaryUploadWidgetResults) => {
                          if (
                            result.event === "success" &&
                            result.info &&
                            typeof result.info === "object" &&
                            "secure_url" in result.info &&
                            typeof result.info.secure_url === "string"
                          ) {
                            const url = result.info.secure_url;

                            setDraft((d) => ({
                              ...d,
                              images: d.images.includes(url)
                                ? d.images
                                : [...d.images, url],
                            }));

                            setUploadState((s) => ({
                              kind: "success",
                              count: s.kind === "success" ? s.count + 1 : 1,
                            }));
                          }
                        }}
                        onError={(error: CloudinaryUploadWidgetError) => {
                          const message =
                            typeof error === "string"
                              ? error
                              : (error as { statusText?: string })
                                  ?.statusText ??
                                "Upload failed. Please try again.";

                          setUploadState({ kind: "error", message });
                        }}
                        options={{
                          maxFiles: 10,
                          maxFileSize: 5_000_000,
                          resourceType: "image",
                          clientAllowedFormats: [
                            "jpg",
                            "jpeg",
                            "png",
                            "webp",
                          ],
                          multiple: true,
                        }}
                      >
                        {({ open, isLoading }) => (
                          <button
                            type="button"
                            onClick={() => {
                              setUploadState({ kind: "idle" });
                              open();
                            }}
                            disabled={isLoading}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line bg-bg-soft py-8 text-sm text-fg-muted transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                          >
                            <Upload size={20} />

                            {isLoading || uploadState.kind === "uploading"
                              ? "Uploading…"
                              : "Click to upload images"}
                          </button>
                        )}
                      </CldUploadWidget>
                    ) : (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        <AlertCircle
                          size={14}
                          className="mt-0.5 flex-shrink-0"
                        />

                        <div>
                          Image upload is disabled — the{" "}
                          <code className="font-mono">
                            NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
                          </code>{" "}
                          environment variable is not set.
                        </div>
                      </div>
                    )}

                    {uploadState.kind === "success" && (
                      <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
                        <CheckCircle2 size={14} />
                        Uploaded {uploadState.count}{" "}
                        {uploadState.count === 1 ? "image" : "images"} to
                        Cloudinary.
                      </div>
                    )}

                    {uploadState.kind === "error" && (
                      <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                        <AlertCircle size={14} />
                        {uploadState.message}
                      </div>
                    )}

                    <p className="text-xs text-fg-muted">
                      Upload up to 10 images. Max 5MB each. Supported formats:
                      JPG, PNG, WebP.
                    </p>
                  </div>
                </FieldLabel>

                <FieldLabel label="Description">
                  <Textarea
                    className="h-20"
                    value={draft.description}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        description: e.target.value,
                      })
                    }
                  />
                </FieldLabel>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.featured}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        featured: e.target.checked,
                      })
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

                <Button
                  onClick={save}
                  disabled={
                    busy ||
                    !draft.title.trim() ||
                    !draft.category ||
                    categoriesLoading
                  }
                >
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
