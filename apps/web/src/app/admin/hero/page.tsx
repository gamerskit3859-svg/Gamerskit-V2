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
import { Button, Card, FieldLabel, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

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
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Hero Management
          </h1>
          <p className="mt-1 text-sm text-fg-soft">
            Active Slides:{" "}
            <span className="font-bold text-blue-600">{activeCount}/4</span> •
            Drag to reorder
          </p>
        </div>
        <Button
          variant={showForm ? "secondary" : "primary"}
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? "Close Form" : "Add Slide"}
        </Button>
      </header>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-red-700">
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
            className="mb-10"
          >
            <Card padding="lg">
              <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 gap-8 md:grid-cols-3"
              >
                <FieldLabel label="Slide Media" className="md:col-span-1">
                  <CldUploadWidget
                    uploadPreset={
                      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
                    }
                    onSuccess={(res: any) =>
                      setFormData({
                        ...formData,
                        imageUrl: res.info.secure_url,
                      })
                    }
                  >
                    {({ open }) => (
                      <button
                        type="button"
                        onClick={() => open()}
                        className="group relative flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-bg-soft transition-all hover:border-blue-300 hover:bg-blue-50"
                      >
                        {formData.imageUrl ? (
                          <Image
                            src={formData.imageUrl}
                            alt="Preview"
                            fill
                            className="rounded-xl object-cover"
                          />
                        ) : (
                          <div className="text-center text-fg-muted group-hover:text-blue-500">
                            <ImageIcon size={32} className="mx-auto mb-2" />
                            <p className="text-xs font-bold">Select Image</p>
                          </div>
                        )}
                      </button>
                    )}
                  </CldUploadWidget>
                </FieldLabel>

                <div className="space-y-4 md:col-span-2">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FieldLabel label="Title">
                      <Input
                        value={formData.title}
                        onChange={(e) =>
                          setFormData({ ...formData, title: e.target.value })
                        }
                        placeholder="Built for the Top 1%"
                      />
                    </FieldLabel>
                    <FieldLabel label="Subtitle">
                      <Input
                        value={formData.subtitle}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            subtitle: e.target.value,
                          })
                        }
                        placeholder="Official RC drift gear..."
                      />
                    </FieldLabel>
                  </div>
                  <FieldLabel label="Link URL">
                    <Input
                      value={formData.link}
                      onChange={(e) =>
                        setFormData({ ...formData, link: e.target.value })
                      }
                      placeholder="/shop/rc-cars"
                    />
                  </FieldLabel>
                  <Button
                    type="submit"
                    disabled={isSaving || !formData.imageUrl}
                    className="w-full justify-center"
                  >
                    <Save size={18} />
                    {isSaving
                      ? "Saving Changes..."
                      : editingId
                        ? "Update Slide"
                        : "Create Slide"}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card padding="none" className="divide-y divide-line">
        {loading ? (
          <div className="animate-pulse p-20 text-center text-fg-muted">
            Loading Hero Inventory...
          </div>
        ) : images.length === 0 ? (
          <div className="p-20 text-center font-medium text-fg-muted">
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
              className={cn(
                "group flex items-center p-4 transition-colors hover:bg-bg-soft",
                draggedFrom === idx && "bg-blue-50 opacity-30",
              )}
            >
              <div className="mr-4 cursor-grab text-fg-muted hover:text-fg-soft active:cursor-grabbing">
                <GripVertical size={20} />
              </div>

              <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-line bg-bg-soft">
                <Image
                  src={img.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                />
              </div>

              <div className="ml-6 flex-grow">
                <div className="flex items-center gap-3">
                  <h3 className="line-clamp-1 font-bold text-foreground">
                    {img.title || "Untitled Slide"}
                  </h3>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest",
                      img.isActive
                        ? "border-emerald-100 bg-emerald-50 text-emerald-600"
                        : "border-line bg-bg-soft text-fg-muted",
                    )}
                  >
                    {img.isActive ? "Active" : "Hidden"}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-fg-muted">
                  {img.subtitle || "No subtitle set."}
                </p>
              </div>

              <div className="ml-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleActive(img._id, img.isActive)}
                  disabled={!img.isActive && activeCount >= 4}
                  className={cn(
                    "rounded-lg p-2 transition-all",
                    img.isActive
                      ? "text-orange-500 hover:bg-orange-50"
                      : "text-blue-500 hover:bg-blue-50 disabled:opacity-20",
                  )}
                >
                  {img.isActive ? (
                    <XCircle size={18} />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleEdit(img)}
                  className="rounded-lg p-2 text-fg-muted hover:bg-blue-50 hover:text-blue-600"
                >
                  <Pencil size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(img._id)}
                  className="rounded-lg p-2 text-fg-muted hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
