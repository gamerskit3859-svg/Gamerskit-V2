"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CldUploadWidget } from "next-cloudinary";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";

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

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    slug: "",
    name: "",
    description: "",
    image: "",
    icon: "",
    parentId: "",
    order: 0,
    active: true,
    featured: false,
  });

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
    setFormData({
      slug: "",
      name: "",
      description: "",
      image: "",
      icon: "",
      parentId: "",
      order: 0,
      active: true,
      featured: false,
    });
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
    if (!token || !confirm("Are you sure you want to delete this category?")) return;

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
            className={`grid grid-cols-[1fr_2fr_1fr_1fr_80px_80px_80px] gap-4 items-center p-3 border-b ${
              level > 0 ? "bg-gray-50 pl-12" : ""
            }`}
          >
            <span className="text-sm font-mono text-gray-500">{cat.slug}</span>
            <div>
              <div className="font-medium flex items-center gap-2">
                {cat.name}
                {cat.featured && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                    Featured
                  </span>
                )}
              </div>
              {cat.description && (
                <div className="text-sm text-gray-600">{cat.description}</div>
              )}
            </div>
            <span className="text-sm text-gray-600">
              {cat.active ? "✓ Active" : "Inactive"}
            </span>
            <span className="text-sm text-gray-600">{cat.productCount} products</span>
            <button
              onClick={() => editCategory(cat)}
              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
            >
              Edit
            </button>
            <button
              onClick={() => deleteCategory(cat._id)}
              className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
              disabled={cat.productCount > 0 || (cat.subcategories?.length ?? 0) > 0}
            >
              Delete
            </button>
          </div>
          {cat.subcategories && cat.subcategories.length > 0 && (
            renderCategories(cat.subcategories, level + 1)
          )}
        </div>
      ))}
    </>
  );

  return (
    <div className="min-h-screen">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Categories</h1>
          <p className="text-gray-600">Manage product categories and subcategories</p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg"
          >
            {error}
          </motion.div>
        )}

        <div className="mb-6">
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
          >
            {showForm ? "Cancel" : "+ New Category"}
          </button>
        </div>

        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-white rounded-lg border"
          >
            <h2 className="text-xl font-bold mb-4">
              {editingId ? "Edit Category" : "Create New Category"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Slug *</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({ ...formData, slug: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g., rc-cars"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g., RC Cars"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Category description"
                  rows={3}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-4 p-3 border-2 border-yellow-200 bg-yellow-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) =>
                      setFormData({ ...formData, featured: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span>🌟 Mark as Featured Category</span>
                </label>
              </div>

              {formData.featured && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-blue-50 rounded-lg border border-blue-200"
                >
                  <h3 className="font-semibold text-sm mb-3 text-blue-900">
                    Upload Featured Image (via Cloudinary)
                  </h3>
                  <div className="bg-white rounded-lg p-4 border-2 border-dashed border-blue-300">
                    <CldUploadWidget
                      uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
                      onSuccess={(result: any) => {
                        if (result.event === "success") {
                          setFormData({
                            ...formData,
                            image: result.info.secure_url,
                          });
                        }
                      }}
                    >
                      {({ open }) => (
                        <button
                          type="button"
                          onClick={() => open()}
                          className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium text-sm"
                        >
                          📸 Click to Upload Image
                        </button>
                      )}
                    </CldUploadWidget>
                  </div>
                  {formData.image && (
                    <div className="mt-4">
                      <p className="text-xs text-gray-600 mb-2">Preview:</p>
                      <img
                        src={formData.image}
                        alt="Featured category preview"
                        className="max-h-40 rounded-lg object-cover"
                      />
                      <p className="text-xs text-gray-500 mt-2 break-all">
                        {formData.image}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Icon</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) =>
                      setFormData({ ...formData, icon: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Icon name or URL"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Manual Image URL</label>
                  <input
                    type="text"
                    value={formData.image}
                    onChange={(e) =>
                      setFormData({ ...formData, image: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="https://..."
                    disabled={formData.featured}
                  />
                  {formData.featured && (
                    <p className="text-xs text-gray-500 mt-1">
                      Use Cloudinary upload above or enter URL manually
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Parent Category</label>
                  <select
                    value={formData.parentId}
                    onChange={(e) =>
                      setFormData({ ...formData, parentId: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">None (Root category)</option>
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Order</label>
                  <input
                    type="number"
                    value={formData.order}
                    onChange={(e) =>
                      setFormData({ ...formData, order: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={formData.active ? "active" : "inactive"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        active: e.target.value === "active",
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                >
                  {isCreating ? "Saving..." : "Save Category"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-600">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            No categories yet. Create one to get started.
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden overflow-x-auto">
            <div className="grid grid-cols-[1fr_2fr_1fr_1fr_80px_80px_80px] gap-4 items-center p-3 bg-gray-100 font-semibold text-sm">
              <div>Slug</div>
              <div>Name</div>
              <div>Status</div>
              <div>Products</div>
              <div></div>
              <div></div>
            </div>
            {renderCategories(categories)}
          </div>
        )}
      </div>
  );
}
