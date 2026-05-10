"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CldUploadWidget } from "next-cloudinary";
import Image from "next/image";
import {
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  AlertCircle,
  Save,
  X,
} from "lucide-react";
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
}

export default function AdminHeroImages() {
  const [images, setImages] = useState<HeroImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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

  const loadImages = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const result = await api.listHeroImagesAdmin(token);
      setImages(result.items || []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const resetForm = () => {
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
  };

  const handleEdit = (image: HeroImage) => {
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !formData.imageUrl) return;

    setIsSaving(true);
    try {
      if (editingId) {
        await api.updateHeroImage(editingId, formData, token);
      } else {
        const publicId =
          formData.imageUrl.split("/").pop()?.split("?")[0] || "hero";
        await api.createHeroImage({ ...formData, publicId }, token);
      }
      await loadImages();
      resetForm();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || !confirm("Delete this hero slide?")) return;
    try {
      await api.deleteHeroImage(id, token);
      await loadImages();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    if (!token) return;
    try {
      await api.updateHeroImage(id, { isActive: !currentState }, token);
      await loadImages();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Drag and Drop Logic
  const handleDragStart = (index: number) => setDraggedFrom(index);
  const handleDragOver = async (index: number) => {
    if (draggedFrom === null || draggedFrom === index) return;
    const newImages = [...images];
    const [draggedItem] = newImages.splice(draggedFrom, 1);
    newImages.splice(index, 0, draggedItem);

    const updated = newImages.map((img, idx) => ({ ...img, order: idx }));
    setImages(updated);
    setDraggedFrom(index);
  };

  const handleDragEnd = async () => {
    setDraggedFrom(null);
    if (!token) return;
    try {
      const orderData = images.map((img, idx) => ({ id: img._id, order: idx }));
      await api.reorderHeroImages(orderData, token);
    } catch (err) {
      setError("Failed to save new order.");
      loadImages();
    }
  };

  const activeCount = images.filter((img) => img.isActive).length;

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            Hero Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Active Slides:{" "}
            <span className="font-bold text-blue-600">{activeCount}/4</span> •
            Drag to reorder
          </p>
        </div>
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
            showForm
              ? "bg-white border text-gray-600 shadow-sm"
              : "bg-black text-white shadow-lg"
          }`}>
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? "Close Form" : "Add Slide"}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Form Section */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl border border-gray-200  p-6 mb-10 overflow-hidden">
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Upload Area */}
              <div className="md:col-span-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-3">
                  Slide Media
                </label>
                <CldUploadWidget
                  uploadPreset={
                    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
                  }
                  onSuccess={(res: any) =>
                    setFormData({ ...formData, imageUrl: res.info.secure_url })
                  }>
                  {({ open }) => (
                    <div
                      onClick={() => open()}
                      className="relative aspect-video rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all group">
                      {formData.imageUrl ? (
                        <Image
                          src={formData.imageUrl}
                          alt="Preview"
                          fill
                          className="object-cover rounded-xl"
                        />
                      ) : (
                        <div className="text-center text-gray-400 group-hover:text-blue-500">
                          <ImageIcon size={32} className="mx-auto mb-2" />
                          <p className="text-xs font-bold">Select Image</p>
                        </div>
                      )}
                    </div>
                  )}
                </CldUploadWidget>
              </div>

              {/* Text Fields */}
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500">
                      Title
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Built for the Top 1%"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500">
                      Subtitle
                    </label>
                    <input
                      type="text"
                      value={formData.subtitle}
                      onChange={(e) =>
                        setFormData({ ...formData, subtitle: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Official RC drift gear..."
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">
                    Link URL
                  </label>
                  <input
                    type="text"
                    value={formData.link}
                    onChange={(e) =>
                      setFormData({ ...formData, link: e.target.value })
                    }
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="/shop/rc-cars"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSaving || !formData.imageUrl}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-100">
                  <Save size={18} />
                  {isSaving
                    ? "Saving Changes..."
                    : editingId
                      ? "Update Slide"
                      : "Create Slide"}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List Section */}
      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        {loading ? (
          <div className="p-20 text-center text-gray-400 animate-pulse">
            Loading Hero Inventory...
          </div>
        ) : images.length === 0 ? (
          <div className="p-20 text-center text-gray-400 font-medium">
            No slides found.
          </div>
        ) : (
          images.map((img, idx) => (
            <div
              key={img._id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => {
                e.preventDefault();
                handleDragOver(idx);
              }}
              onDragEnd={handleDragEnd}
              className={`flex items-center p-4 group transition-colors hover:bg-gray-50/50 ${draggedFrom === idx ? "opacity-30 bg-blue-50" : ""}`}>
              <div className="mr-4 text-gray-300 cursor-grab active:cursor-grabbing hover:text-gray-500">
                <GripVertical size={20} />
              </div>

              <div className="relative h-16 w-24 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex-shrink-0">
                <Image
                  src={img.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                />
              </div>

              <div className="ml-6 flex-grow">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-gray-900 line-clamp-1">
                    {img.title || "Untitled Slide"}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      img.isActive
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                        : "bg-gray-100 text-gray-400 border-gray-200"
                    }`}>
                    {img.isActive ? "Active" : "Hidden"}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                  {img.subtitle || "No subtitle set."}
                </p>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleToggleActive(img._id, img.isActive)}
                  disabled={!img.isActive && activeCount >= 4}
                  className={`p-2 rounded-lg transition-all ${img.isActive ? "text-orange-500 hover:bg-orange-50" : "text-blue-500 hover:bg-blue-50 disabled:opacity-20"}`}>
                  {img.isActive ? (
                    <XCircle size={18} />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                </button>
                <button
                  onClick={() => handleEdit(img)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                  <Pencil size={18} />
                </button>
                <button
                  onClick={() => handleDelete(img._id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
