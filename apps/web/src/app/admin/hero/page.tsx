"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  CldUploadWidget,
  type CloudinaryUploadWidgetResults,
} from "next-cloudinary";
import {
  AlertCircle,
  CheckCircle2,
  GripVertical,
  Image as ImageIcon,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import {
  api,
  type AnnouncementBarSettings,
  type HeroImageItem,
  type ShopBannerSettings,
} from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { optimizeCloudinaryImage } from "@/lib/images";
import { Button, Card, FieldLabel, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

type HeroForm = {
  imageUrl: string;
  publicId: string;
  title: string;
  subtitle: string;
  link: string;
};

const emptyHeroForm: HeroForm = {
  imageUrl: "",
  publicId: "",
  title: "",
  subtitle: "",
  link: "",
};

const defaultAnnouncement: AnnouncementBarSettings = {
  enabled: true,
  codText: "Full Cash on Delivery",
  deliveryText: "Free Delivery All Over Bangladesh",
  offerText: "Offer ends in",
};

function getUploadInfo(result: CloudinaryUploadWidgetResults) {
  const info = result.info;
  if (!info || typeof info !== "object") return null;
  if (!("secure_url" in info) || typeof info.secure_url !== "string") return null;

  return {
    imageUrl: info.secure_url,
    publicId:
      "public_id" in info && typeof info.public_id === "string"
        ? info.public_id
        : info.secure_url.split("/").pop()?.split("?")[0] || "banner",
  };
}

function heroToForm(image: HeroImageItem): HeroForm {
  return {
    imageUrl: image.imageUrl,
    publicId: image.publicId,
    title: image.title,
    subtitle: image.subtitle,
    link: image.link,
  };
}

export default function AdminHeroImages() {
  const [images, setImages] = useState<HeroImageItem[]>([]);
  const [heroForm, setHeroForm] = useState<HeroForm>(emptyHeroForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showHeroForm, setShowHeroForm] = useState(false);
  const [draggedFrom, setDraggedFrom] = useState<number | null>(null);

  const [shopBanner, setShopBanner] = useState<ShopBannerSettings>({
    imageUrl: "",
    publicId: "",
  });
  const [announcement, setAnnouncement] =
    useState<AnnouncementBarSettings>(defaultAnnouncement);

  const [loading, setLoading] = useState(true);
  const [savingHero, setSavingHero] = useState(false);
  const [savingShop, setSavingShop] = useState(false);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const token = getAdminToken();
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  const loadData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setError("Admin token not found. Please login again.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [heroResult, shopResult, announcementResult] = await Promise.all([
        api.listHeroImagesAdmin(token),
        api.getShopBanner(),
        api.getAnnouncementBar(),
      ]);
      setImages(heroResult.items || []);
      setShopBanner(shopResult.item);
      setAnnouncement(announcementResult.item);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void Promise.resolve().then(() => loadData());
  }, [loadData]);

  function resetHeroForm() {
    setHeroForm(emptyHeroForm);
    setEditingId(null);
    setShowHeroForm(false);
  }

  function startCreateHero() {
    setHeroForm(emptyHeroForm);
    setEditingId(null);
    setSuccess(null);
    setShowHeroForm(true);
  }

  function startEditHero(image: HeroImageItem) {
    setHeroForm(heroToForm(image));
    setEditingId(image._id);
    setSuccess(null);
    setShowHeroForm(true);
  }

  async function saveHeroSlide(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !heroForm.imageUrl) return;

    setSavingHero(true);
    setSuccess(null);
    setError(null);

    try {
      const body = {
        imageUrl: heroForm.imageUrl,
        publicId: heroForm.publicId || "hero-slide",
        title: heroForm.title,
        subtitle: heroForm.subtitle,
        link: heroForm.link,
      };

      if (editingId) {
        const result = await api.updateHeroImage(editingId, body, token);
        setImages((prev) =>
          prev.map((image) => (image._id === editingId ? result.item : image)),
        );
      } else {
        const result = await api.createHeroImage(
          { ...body, isActive: activeCount < 4 },
          token,
        );
        setImages((prev) => [...prev, result.item].sort((a, b) => a.order - b.order));
      }

      setSuccess(editingId ? "Home hero slide updated." : "Home hero slide added.");
      resetHeroForm();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingHero(false);
    }
  }

  async function deleteHeroSlide(id: string) {
    if (!token || !confirm("Delete this home hero slide?")) return;
    setError(null);
    setSuccess(null);

    try {
      await api.deleteHeroImage(id, token);
      setImages((prev) => prev.filter((image) => image._id !== id));
      setSuccess("Home hero slide deleted.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleHeroActive(image: HeroImageItem) {
    if (!token) return;
    if (!image.isActive && activeCount >= 4) {
      setError("Maximum 4 active home hero slides are allowed.");
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const result = await api.updateHeroImage(
        image._id,
        { isActive: !image.isActive },
        token,
      );
      setImages((prev) =>
        prev.map((item) => (item._id === image._id ? result.item : item)),
      );
      setSuccess(result.item.isActive ? "Slide activated." : "Slide hidden.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleDragStart(index: number) {
    setDraggedFrom(index);
  }

  function handleDragOver(index: number) {
    if (draggedFrom === null || draggedFrom === index) return;

    setImages((prev) => {
      const next = [...prev];
      const [draggedItem] = next.splice(draggedFrom, 1);
      next.splice(index, 0, draggedItem);
      return next.map((image, order) => ({ ...image, order }));
    });
    setDraggedFrom(index);
  }

  async function handleDragEnd() {
    setDraggedFrom(null);
    if (!token) return;

    try {
      const result = await api.reorderHeroImages(
        images.map((image, order) => ({ id: image._id, order })),
        token,
      );
      setImages(
        result.items
          .filter(Boolean)
          .sort((a, b) => a.order - b.order) as HeroImageItem[],
      );
      setSuccess("Home hero slide order saved.");
    } catch (err) {
      setError((err as Error).message);
      void loadData();
    }
  }

  async function saveShopBanner(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !shopBanner.imageUrl) return;

    setSavingShop(true);
    setSuccess(null);
    setError(null);

    try {
      const result = await api.updateShopBanner(shopBanner, token);
      setShopBanner(result.item);
      setSuccess("Shop top banner saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingShop(false);
    }
  }

  async function saveAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    setSavingAnnouncement(true);
    setSuccess(null);
    setError(null);

    try {
      const result = await api.updateAnnouncementBar(announcement, token);
      setAnnouncement(result.item);
      setSuccess("Announcement bar saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingAnnouncement(false);
    }
  }

  const activeCount = images.filter((image) => image.isActive).length;

  return (
    <div className="min-h-screen pb-20">
      <header className="mb-8">
        <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
          Admin
        </span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Hero Section
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Manage home hero slides, the Shop top banner, and the announcement bar.
        </p>
      </header>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-100 bg-red-50 p-4 text-red-700">
          <AlertCircle size={18} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-emerald-700">
          <CheckCircle2 size={18} />
          <span className="text-sm font-medium">{success}</span>
        </div>
      )}

      <Card padding="lg" className="mb-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Home Hero Slides
            </h2>
            <p className="mt-1 text-sm text-fg-soft">
              Multiple homepage slides with title, subtitle, link, active state,
              and drag reorder.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-fg-soft">
              Active slides: <strong>{activeCount}/4</strong>
            </span>
            <Button type="button" onClick={startCreateHero}>
              <Plus size={18} />
              Add slide
            </Button>
          </div>
        </div>

        {showHeroForm && (
          <form
            onSubmit={saveHeroSlide}
            className="mb-8 grid gap-6 rounded-lg border border-line bg-bg-soft p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]"
          >
            <FieldLabel label="Slide Image">
              <CldUploadWidget
                uploadPreset={uploadPreset}
                options={{
                  maxFiles: 1,
                  maxFileSize: 5_000_000,
                  resourceType: "image",
                  clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
                  multiple: false,
                }}
                onSuccess={(result) => {
                  const upload = getUploadInfo(result);
                  if (!upload) return;
                  setHeroForm((current) => ({ ...current, ...upload }));
                }}
                onError={(uploadError) => {
                  const message =
                    typeof uploadError === "string"
                      ? uploadError
                      : (uploadError as { statusText?: string })?.statusText ??
                        "Upload failed. Please try again.";
                  setError(message);
                }}
              >
                {({ open, isLoading }) => (
                  <button
                    type="button"
                    onClick={() => open()}
                    disabled={!uploadPreset || isLoading}
                    className="group relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-line bg-white text-sm text-fg-muted transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {heroForm.imageUrl ? (
                      <Image
                        src={optimizeCloudinaryImage(
                          heroForm.imageUrl,
                          "f_auto,q_auto,c_fill,w_1200",
                        )}
                        alt="Home hero slide preview"
                        fill
                        sizes="(max-width: 768px) 100vw, 70vw"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex items-center gap-2">
                        <ImageIcon size={18} />
                        {uploadPreset ? "Upload slide image" : "Cloudinary upload is disabled"}
                      </span>
                    )}
                  </button>
                )}
              </CldUploadWidget>
            </FieldLabel>

            <div className="space-y-4">
              <FieldLabel label="Title">
                <Input
                  value={heroForm.title}
                  onChange={(e) =>
                    setHeroForm({ ...heroForm, title: e.target.value })
                  }
                  placeholder="Built for the Top 1%"
                />
              </FieldLabel>
              <FieldLabel label="Subtitle">
                <Input
                  value={heroForm.subtitle}
                  onChange={(e) =>
                    setHeroForm({ ...heroForm, subtitle: e.target.value })
                  }
                  placeholder="Official RC drift gear..."
                />
              </FieldLabel>
              <FieldLabel label="Link URL">
                <Input
                  value={heroForm.link}
                  onChange={(e) =>
                    setHeroForm({ ...heroForm, link: e.target.value })
                  }
                  placeholder="/shop/rc-car"
                />
              </FieldLabel>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" onClick={resetHeroForm}>
                  <X size={16} />
                  Cancel
                </Button>
                <Button type="submit" disabled={savingHero || !heroForm.imageUrl}>
                  <Save size={18} />
                  {savingHero
                    ? "Saving..."
                    : editingId
                      ? "Update slide"
                      : "Create slide"}
                </Button>
              </div>
            </div>
          </form>
        )}

        {loading ? (
          <div className="animate-pulse rounded-lg bg-bg-soft p-16 text-center text-fg-muted">
            Loading home hero slides...
          </div>
        ) : images.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line p-12 text-center text-sm text-fg-muted">
            No home hero slides yet.
          </div>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {images.map((image, index) => (
              <div
                key={image._id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => {
                  e.preventDefault();
                  handleDragOver(index);
                }}
                onDragEnd={handleDragEnd}
                className={cn(
                  "flex flex-col gap-4 bg-white p-4 transition-colors hover:bg-bg-soft sm:flex-row sm:items-center",
                  draggedFrom === index && "bg-blue-50 opacity-40",
                )}
              >
                <div className="hidden cursor-grab text-fg-muted active:cursor-grabbing sm:block">
                  <GripVertical size={20} />
                </div>

                <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-line bg-bg-soft sm:h-20 sm:w-32 sm:flex-shrink-0">
                  <Image
                    src={optimizeCloudinaryImage(
                      image.imageUrl,
                      "f_auto,q_auto,c_fill,w_500",
                    )}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, 128px"
                    className="object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold">
                      {image.title || "Untitled Slide"}
                    </h3>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest",
                        image.isActive
                          ? "border-emerald-100 bg-emerald-50 text-emerald-600"
                          : "border-line bg-bg-soft text-fg-muted",
                      )}
                    >
                      {image.isActive ? "Active" : "Hidden"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-fg-muted">
                    {image.subtitle || "No subtitle set."}
                  </p>
                  {image.link && (
                    <p className="mt-1 truncate font-mono text-[11px] text-fg-muted">
                      {image.link}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => toggleHeroActive(image)}
                    disabled={!image.isActive && activeCount >= 4}
                    className={cn(
                      "rounded-lg p-2 transition-all disabled:cursor-not-allowed disabled:opacity-30",
                      image.isActive
                        ? "text-orange-500 hover:bg-orange-50"
                        : "text-blue-500 hover:bg-blue-50",
                    )}
                    aria-label={image.isActive ? "Hide slide" : "Activate slide"}
                  >
                    {image.isActive ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEditHero(image)}
                    className="rounded-lg p-2 text-fg-muted hover:bg-blue-50 hover:text-blue-600"
                    aria-label="Edit slide"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteHeroSlide(image._id)}
                    className="rounded-lg p-2 text-fg-muted hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete slide"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card padding="lg" className="mb-6">
        <form
          onSubmit={saveShopBanner}
          className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]"
        >
          <div>
            <h2 className="mb-1 text-lg font-semibold tracking-tight">
              Shop Top Banner
            </h2>
            <p className="mb-4 text-sm text-fg-soft">
              Single image shown at the top of the Shop page only.
            </p>
            {loading ? (
              <div className="aspect-[16/6] animate-pulse rounded-lg bg-bg-soft" />
            ) : (
              <FieldLabel label="Shop Banner Image">
                <CldUploadWidget
                  uploadPreset={uploadPreset}
                  options={{
                    maxFiles: 1,
                    maxFileSize: 5_000_000,
                    resourceType: "image",
                    clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
                    multiple: false,
                  }}
                  onSuccess={(result) => {
                    const upload = getUploadInfo(result);
                    if (!upload) return;
                    setShopBanner(upload);
                  }}
                  onError={(uploadError) => {
                    const message =
                      typeof uploadError === "string"
                        ? uploadError
                        : (uploadError as { statusText?: string })?.statusText ??
                          "Upload failed. Please try again.";
                    setError(message);
                  }}
                >
                  {({ open, isLoading }) => (
                    <button
                      type="button"
                      onClick={() => open()}
                      disabled={!uploadPreset || isLoading}
                      className="group relative flex aspect-[16/6] w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-line bg-bg-soft text-sm text-fg-muted transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {shopBanner.imageUrl ? (
                        <Image
                          src={optimizeCloudinaryImage(
                            shopBanner.imageUrl,
                            "f_auto,q_auto,c_fill,w_1600",
                          )}
                          alt="Shop banner preview"
                          fill
                          sizes="(max-width: 768px) 100vw, 70vw"
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex items-center gap-2">
                          <ImageIcon size={18} />
                          {uploadPreset ? "Upload shop banner" : "Cloudinary upload is disabled"}
                        </span>
                      )}
                    </button>
                  )}
                </CldUploadWidget>
              </FieldLabel>
            )}
          </div>
          <div className="flex flex-col justify-end gap-3">
            <p className="rounded-lg border border-line bg-bg-soft p-3 text-sm text-fg-soft">
              This does not change homepage hero slides.
            </p>
            <Button
              type="submit"
              disabled={loading || savingShop || !shopBanner.imageUrl}
              className="w-full justify-center"
            >
              <Save size={18} />
              {savingShop ? "Saving..." : "Save shop banner"}
            </Button>
          </div>
        </form>
      </Card>

      <Card padding="lg">
        <form onSubmit={saveAnnouncement} className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Announcement Bar
              </h2>
              <p className="mt-1 text-sm text-fg-soft">
                Controls the global top bar and daily countdown text.
              </p>
            </div>
            <label className="inline-flex items-center gap-3 rounded-full border border-line bg-bg-soft px-4 py-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={announcement.enabled}
                onChange={(e) =>
                  setAnnouncement({
                    ...announcement,
                    enabled: e.target.checked,
                  })
                }
                className="h-4 w-4"
              />
              {announcement.enabled ? "Enabled" : "Disabled"}
            </label>
          </div>

          {loading ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="h-10 animate-pulse rounded bg-bg-soft" />
              <div className="h-10 animate-pulse rounded bg-bg-soft" />
              <div className="h-10 animate-pulse rounded bg-bg-soft" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <FieldLabel label="COD Text">
                <Input
                  value={announcement.codText}
                  onChange={(e) =>
                    setAnnouncement({ ...announcement, codText: e.target.value })
                  }
                />
              </FieldLabel>
              <FieldLabel label="Delivery Text">
                <Input
                  value={announcement.deliveryText}
                  onChange={(e) =>
                    setAnnouncement({
                      ...announcement,
                      deliveryText: e.target.value,
                    })
                  }
                />
              </FieldLabel>
              <FieldLabel label="Offer Text">
                <Input
                  value={announcement.offerText}
                  onChange={(e) =>
                    setAnnouncement({ ...announcement, offerText: e.target.value })
                  }
                />
              </FieldLabel>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || savingAnnouncement}
            className="justify-center"
          >
            <Save size={18} />
            {savingAnnouncement ? "Saving..." : "Save announcement"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
