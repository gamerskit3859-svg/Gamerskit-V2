"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CldUploadWidget,
  type CloudinaryUploadWidgetResults,
} from "next-cloudinary";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
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
  description: string;
  image: string;
  icon: string;
  parentId: string | null;
  order: number;
  active: boolean;
  featured?: boolean;
  productCount: number;
  subcategories?: Category[];
  createdAt: string;
  updatedAt: string;
}

const blankForm = {
  slug: "",
  name: "",
  description: "",
  image: "",
  icon: "",
  parentId: "",
  order: 0,
  active: true,
  featured: false,
};

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(blankForm);

  const token = getAdminToken();

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      setLoading(true);
      const result = await api.listCategories();
      setCategories(result.items);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData(blankForm);
    setEditingId(null);
    setShowForm(false);
  }

  function editCategory(category: Category) {
    setFormData({
      slug: category.slug,
      name: category.name,
      description: category.description,
      image: category.image,
      icon: category.icon,
      parentId: category.parentId || "",
      order: category.order,
      active: category.active,
      featured: category.featured || false,
    });
    setEditingId(category._id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    setIsCreating(true);
    try {
      if (editingId) {
        await api.updateCategory(editingId, formData, token);
      } else {
        await api.createCategory(formData, token);
      }
      await loadCategories();
      resetForm();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  }

  async function deleteCategory(id: string) {
    if (!token || !confirm("Are you sure you want to delete this category?"))
      return;

    try {
      await api.deleteCategory(id, token);
      await loadCategories();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const renderCategories = (cats: Category[], level = 0) => (
    <>
      {cats.map((cat) => (
        <div key={cat._id}>
          <div
            className={cn(
              "grid min-w-[820px] grid-cols-[1fr_2fr_1fr_1fr_80px_80px_80px] items-center gap-4 border-b border-line p-3",
              level > 0 && "bg-bg-soft pl-12",
            )}
          >
            <span className="font-mono text-sm text-fg-muted">{cat.slug}</span>
            <div>
              <div className="flex items-center gap-2 font-medium">
                {cat.name}
                {cat.featured && (
                  <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                    Featured
                  </span>
                )}
              </div>
              {cat.description && (
                <div className="text-sm text-fg-soft">{cat.description}</div>
              )}
            </div>
            <span className="text-sm text-fg-soft">
              {cat.active ? "✓ Active" : "Inactive"}
            </span>
            <span className="text-sm text-fg-soft">
              {cat.productCount} products
            </span>
            <button
              type="button"
              onClick={() => editCategory(cat)}
              className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 transition hover:bg-blue-200"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => deleteCategory(cat._id)}
              className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 transition hover:bg-red-200 disabled:opacity-50"
              disabled={
                cat.productCount > 0 ||
                (cat.subcategories?.length ?? 0) > 0
              }
            >
              Delete
            </button>
          </div>
          {cat.subcategories &&
            cat.subcategories.length > 0 &&
            renderCategories(cat.subcategories, level + 1)}
        </div>
      ))}
    </>
  );

  return (
    <div className="min-h-screen">
      <header className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Categories</h1>
        <p className="text-fg-soft">
          Manage product categories and subcategories
        </p>
      </header>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-lg bg-red-100 p-4 text-red-700"
        >
          {error}
        </motion.div>
      )}

      <div className="mb-6">
        <Button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
        >
          {showForm ? "Cancel" : "+ New Category"}
        </Button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card padding="lg">
            <h2 className="mb-4 text-xl font-bold">
              {editingId ? "Edit Category" : "Create New Category"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldLabel label="Slug" required>
                  <Input
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({ ...formData, slug: e.target.value })
                    }
                    placeholder="e.g., rc-cars"
                    required
                  />
                </FieldLabel>
                <FieldLabel label="Name" required>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., RC Cars"
                    required
                  />
                </FieldLabel>
              </div>

              <FieldLabel label="Description">
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Category description"
                  rows={3}
                />
              </FieldLabel>

              <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-yellow-200 bg-yellow-50 p-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={formData.featured}
                  onChange={(e) =>
                    setFormData({ ...formData, featured: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <span>🌟 Mark as Featured Category</span>
              </label>

              {formData.featured && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-blue-200 bg-blue-50 p-4"
                >
                  <h3 className="mb-3 text-sm font-semibold text-blue-900">
                    Upload Featured Image (via Cloudinary)
                  </h3>
                  <div className="rounded-lg border-2 border-dashed border-blue-300 bg-white p-4">
                    <CldUploadWidget
                      uploadPreset={
                        process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
                      }
                      onSuccess={(result: CloudinaryUploadWidgetResults) => {
                        if (result.event === "success") {
                          const info = result.info;
                          if (
                            info &&
                            typeof info === "object" &&
                            "secure_url" in info &&
                            typeof info.secure_url === "string"
                          ) {
                            setFormData({
                              ...formData,
                              image: info.secure_url,
                            });
                          }
                        }
                      }}
                    >
                      {({ open }) => (
                        <button
                          type="button"
                          onClick={() => open()}
                          className="w-full rounded-lg bg-blue-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-600"
                        >
                          📸 Click to Upload Image
                        </button>
                      )}
                    </CldUploadWidget>
                  </div>
                  {formData.image && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs text-fg-soft">Preview:</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={formData.image}
                        alt="Featured category preview"
                        className="max-h-40 rounded-lg object-cover"
                      />
                      <p className="mt-2 break-all text-xs text-fg-muted">
                        {formData.image}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldLabel label="Icon">
                  <Input
                    value={formData.icon}
                    onChange={(e) =>
                      setFormData({ ...formData, icon: e.target.value })
                    }
                    placeholder="Icon name or URL"
                  />
                </FieldLabel>
                <FieldLabel label="Manual Image URL">
                  <Input
                    value={formData.image}
                    onChange={(e) =>
                      setFormData({ ...formData, image: e.target.value })
                    }
                    placeholder="https://..."
                    disabled={formData.featured}
                  />
                  {formData.featured && (
                    <p className="mt-1 text-xs text-fg-muted">
                      Use Cloudinary upload above or enter URL manually
                    </p>
                  )}
                </FieldLabel>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FieldLabel label="Parent Category">
                  <Select
                    value={formData.parentId}
                    onChange={(e) =>
                      setFormData({ ...formData, parentId: e.target.value })
                    }
                  >
                    <option value="">None (Root category)</option>
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    ))}
                  </Select>
                </FieldLabel>
                <FieldLabel label="Order">
                  <Input
                    type="number"
                    value={formData.order}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        order: Number(e.target.value),
                      })
                    }
                  />
                </FieldLabel>
                <FieldLabel label="Status">
                  <Select
                    value={formData.active ? "active" : "inactive"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        active: e.target.value === "active",
                      })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </FieldLabel>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Saving..." : "Save Category"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetForm}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </motion.div>
      )}

      {loading ? (
        <div className="py-12 text-center text-fg-soft">
          Loading categories...
        </div>
      ) : categories.length === 0 ? (
        <div className="py-12 text-center text-fg-soft">
          No categories yet. Create one to get started.
        </div>
      ) : (
        <Card padding="none" className="overflow-x-auto">
          <div className="grid min-w-[820px] grid-cols-[1fr_2fr_1fr_1fr_80px_80px_80px] items-center gap-4 bg-bg-soft p-3 text-sm font-semibold">
            <div>Slug</div>
            <div>Name</div>
            <div>Status</div>
            <div>Products</div>
            <div></div>
            <div></div>
          </div>
          {renderCategories(categories)}
        </Card>
      )}
    </div>
  );
}
