"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CldUploadWidget } from "next-cloudinary";
import Image from "next/image";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";

interface HeroImage {
  _id: string;
  imageUrl: string;
  publicId: string;
  order: number;
  isActive: boolean;
  title: string;
  subtitle: string;
  link: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminHeroImages() {
  const [images, setImages] = useState<HeroImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draggedFrom, setDraggedFrom] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    imageUrl: "",
    title: "",
    subtitle: "",
    link: "",
    order: 0,
    isActive: true,
  });

  const token = getAdminToken();

  useEffect(() => {
    loadImages();
  }, []);

  async function loadImages() {
    if (!token) return;
    try {
      setLoading(true);
      const result = await api.listHeroImagesAdmin(token);
      setImages(result.items);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      imageUrl: "",
      title: "",
      subtitle: "",
      link: "",
      order: 0,
      isActive: true,
    });
    setEditingId(null);
    setShowForm(false);
  }

  function editImage(image: HeroImage) {
    setFormData({
      imageUrl: image.imageUrl,
      title: image.title,
      subtitle: image.subtitle,
      link: image.link,
      order: image.order,
      isActive: image.isActive,
    });
    setEditingId(image._id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !formData.imageUrl) {
      setError("Image URL is required");
      return;
    }

    setIsCreating(true);
    try {
      if (editingId) {
        await api.updateHeroImage(editingId, formData, token);
      } else {
        const publicId = formData.imageUrl.split("/").pop()?.split("?")[0] || "hero";
        await api.createHeroImage(
          { ...formData, publicId },
          token,
        );
      }
      await loadImages();
      resetForm();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  }

  async function deleteImage(id: string) {
    if (!token || !confirm("Are you sure you want to delete this hero image?")) return;

    try {
      await api.deleteHeroImage(id, token);
      await loadImages();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleActive(id: string, currentState: boolean) {
    if (!token) return;
    try {
      await api.updateHeroImage(id, { isActive: !currentState }, token);
      await loadImages();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleDragStart(index: number) {
    setDraggedFrom(index);
  }

  async function handleDragOver(index: number) {
    if (draggedFrom === null || draggedFrom === index) return;

    const newImages = [...images];
    const [draggedImage] = newImages.splice(draggedFrom, 1);
    newImages.splice(index, 0, draggedImage);

    // Update order values
    const updatedImages = newImages.map((img, idx) => ({
      ...img,
      order: idx,
    }));

    setImages(updatedImages);

    if (!token) return;

    try {
      const orderData = updatedImages.map((img) => ({
        id: img._id,
        order: img.order,
      }));
      await api.reorderHeroImages(orderData, token);
    } catch (err) {
      setError((err as Error).message);
      await loadImages();
    }
  }

  function handleDragEnd() {
    setDraggedFrom(null);
  }

  const activeCount = images.filter((img) => img.isActive).length;
  const canActivateMore = activeCount < 4;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Hero Images</h1>
          <p className="text-gray-600">
            Manage hero section images. Maximum 4 active images allowed.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Active: {activeCount}/4 | Drag to reorder
          </p>
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
            {showForm ? "Cancel" : "+ Add Hero Image"}
          </button>
        </div>

        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-white rounded-lg border"
          >
            <h2 className="text-xl font-bold mb-4">
              {editingId ? "Edit Hero Image" : "Add New Hero Image"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-sm mb-3 text-blue-900">
                  Upload Image via Cloudinary
                </h3>
                <div className="bg-white rounded-lg p-4 border-2 border-dashed border-blue-300">
                  {formData.imageUrl ? (
                    <div className="space-y-3">
                      <div className="relative w-full h-40">
                        <Image
                          src={formData.imageUrl}
                          alt="Preview"
                          fill
                          className="object-cover rounded-lg"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, imageUrl: "" })
                        }
                        className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm"
                      >
                        Change Image
                      </button>
                    </div>
                  ) : (
                    <CldUploadWidget
                      uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
                      onSuccess={(result: any) => {
                        if (result.event === "success") {
                          setFormData({
                            ...formData,
                            imageUrl: result.info.secure_url,
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
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Hero title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) =>
                      setFormData({ ...formData, subtitle: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Hero subtitle"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Link (optional)</label>
                <input
                  type="text"
                  value={formData.link}
                  onChange={(e) =>
                    setFormData({ ...formData, link: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="/shop or /product/slug"
                />
              </div>

              <button
                type="submit"
                disabled={isCreating || !formData.imageUrl}
                className="w-full px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:bg-gray-400"
              >
                {isCreating ? "Saving..." : editingId ? "Update Image" : "Add Image"}
              </button>
            </form>
          </motion.div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading hero images...</div>
        ) : images.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No hero images yet. Add one to get started!
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {images.map((image, idx) => (
                <motion.div
                  key={image._id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={() => handleDragOver(idx)}
                  onDragEnd={handleDragEnd}
                  className={`p-4 border rounded-lg bg-white cursor-move hover:shadow-md transition ${
                    draggedFrom === idx ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="relative w-32 h-24 flex-shrink-0">
                      <Image
                        src={image.imageUrl}
                        alt={image.title || "Hero image"}
                        fill
                        className="object-cover rounded"
                      />
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-grow">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold">
                              Order {image.order}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                image.isActive
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {image.isActive ? "✓ Active" : "Inactive"}
                            </span>
                          </div>
                          {image.title && (
                            <p className="font-medium text-sm mt-1">{image.title}</p>
                          )}
                          {image.subtitle && (
                            <p className="text-sm text-gray-600">{image.subtitle}</p>
                          )}
                          {image.link && (
                            <p className="text-xs text-blue-600 mt-1">Link: {image.link}</p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-wrap justify-end">
                          {image.isActive && activeCount >= 4 && (
                            <span className="text-xs text-gray-500">Max reached</span>
                          )}
                          <button
                            onClick={() => toggleActive(image._id, image.isActive)}
                            disabled={
                              !image.isActive &&
                              activeCount >= 4
                            }
                            className={`px-2 py-1 text-xs rounded transition ${
                              image.isActive
                                ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                : "bg-green-100 text-green-700 hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-400"
                            }`}
                          >
                            {image.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => editImage(image)}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteImage(image._id)}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
