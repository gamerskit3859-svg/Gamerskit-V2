"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Film,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { api, type DemoVideoItem, type GoobliqueHero } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatDate } from "@/lib/format";
import { Button, Card, FieldLabel, Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "mov", "webm"];
const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];

const emptyHero: GoobliqueHero = { title: "", subtitle: "", media: null };

type VideoOrientation = "portrait" | "landscape";

type VideoDraft = {
  title: string;
  file: File | null;
  orientation: VideoOrientation;
};

const emptyVideoDraft: VideoDraft = {
  title: "",
  file: null,
  orientation: "portrait",
};

/** Mirrors the API's own limits so the user gets feedback before a long upload. */
function validateVideoFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_VIDEO_EXTENSIONS.includes(ext)) {
    return "Video must be one of: mp4, mov, webm.";
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return "Video must be 100MB or smaller.";
  }
  return null;
}

function heroMediaTypeFromFile(file: File): "image" | "video" | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ALLOWED_IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (ALLOWED_VIDEO_EXTENSIONS.includes(ext)) return "video";
  return null;
}

/** Mirrors the API's own limits so the user gets feedback before a long upload. */
function validateHeroMediaFile(file: File): string | null {
  if (!heroMediaTypeFromFile(file)) {
    return "Hero media must be an image (jpg, png, webp, gif) or video (mp4, mov, webm).";
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return "Hero media must be 100MB or smaller.";
  }
  return null;
}

export default function AdminPortfolioCms() {
  const [hero, setHero] = useState<GoobliqueHero>(emptyHero);
  const [heroDraft, setHeroDraft] = useState<GoobliqueHero>(emptyHero);
  const [editingHero, setEditingHero] = useState(false);
  const [savingHero, setSavingHero] = useState(false);
  const [heroMediaFile, setHeroMediaFile] = useState<File | null>(null);
  const [heroMediaPreview, setHeroMediaPreview] = useState<string | null>(null);
  const heroFileInputRef = useRef<HTMLInputElement>(null);

  const [videos, setVideos] = useState<DemoVideoItem[]>([]);
  const [videoDraft, setVideoDraft] = useState<VideoDraft>(emptyVideoDraft);
  const [editingVideo, setEditingVideo] = useState<DemoVideoItem | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [savingVideo, setSavingVideo] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draggedFrom, setDraggedFrom] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token = getAdminToken();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [heroResult, videosResult] = await Promise.all([
        api.getGoobliqueHero(),
        api.listDemoVideos(),
      ]);
      setHero(heroResult);
      setHeroDraft(heroResult);
      setVideos(videosResult.items || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadData());
  }, [loadData]);

  // Revoke the previous object URL whenever the picked file changes or unmounts.
  useEffect(() => {
    return () => {
      if (heroMediaPreview) URL.revokeObjectURL(heroMediaPreview);
    };
  }, [heroMediaPreview]);

  function pickHeroMediaFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setHeroMediaFile(null);
      setHeroMediaPreview(null);
      return;
    }

    const invalid = validateHeroMediaFile(file);
    if (invalid) {
      setError(invalid);
      e.target.value = "";
      setHeroMediaFile(null);
      setHeroMediaPreview(null);
      return;
    }

    setError(null);
    setHeroMediaFile(file);
    setHeroMediaPreview(URL.createObjectURL(file));
  }

  function cancelEditHero() {
    setHeroDraft(hero);
    setEditingHero(false);
    setHeroMediaFile(null);
    setHeroMediaPreview(null);
    if (heroFileInputRef.current) heroFileInputRef.current.value = "";
  }

  async function saveHero(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    setSavingHero(true);
    setError(null);
    setSuccess(null);

    try {
      const body = new FormData();
      body.set("title", heroDraft.title.trim());
      body.set("subtitle", heroDraft.subtitle.trim());
      // Leaving the media field off keeps the currently stored image/video as is.
      if (heroMediaFile) body.set("media", heroMediaFile);

      const result = await api.updateGoobliqueHero(body, token);
      setHero(result);
      setHeroDraft(result);
      setEditingHero(false);
      setHeroMediaFile(null);
      setHeroMediaPreview(null);
      if (heroFileInputRef.current) heroFileInputRef.current.value = "";
      setSuccess("Hero content saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingHero(false);
    }
  }

  function startCreateVideo() {
    setVideoDraft(emptyVideoDraft);
    setEditingVideo(null);
    setSuccess(null);
    setError(null);
    setVideoModalOpen(true);
  }

  function startEditVideo(video: DemoVideoItem) {
    setVideoDraft({
      title: video.title,
      file: null,
      orientation: video.orientation ?? "portrait",
    });
    setEditingVideo(video);
    setSuccess(null);
    setError(null);
    setVideoModalOpen(true);
  }

  function closeVideoModal() {
    if (savingVideo) return;
    setVideoModalOpen(false);
    setVideoDraft(emptyVideoDraft);
    setEditingVideo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function pickVideoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setVideoDraft((current) => ({ ...current, file: null }));
      return;
    }

    const invalid = validateVideoFile(file);
    if (invalid) {
      setError(invalid);
      e.target.value = "";
      setVideoDraft((current) => ({ ...current, file: null }));
      return;
    }

    setError(null);
    setVideoDraft((current) => ({ ...current, file }));
  }

  async function saveVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    const title = videoDraft.title.trim();
    if (!title) {
      setError("Video title is required.");
      return;
    }
    if (!editingVideo && !videoDraft.file) {
      setError("Please choose a video file to upload.");
      return;
    }

    setSavingVideo(true);
    setError(null);
    setSuccess(null);

    try {
      const body = new FormData();
      body.set("title", title);
      body.set("orientation", videoDraft.orientation);
      // On edit the file is optional — omitting it leaves the stored video as is.
      if (videoDraft.file) body.set("video", videoDraft.file);

      if (editingVideo) {
        const result = await api.updateDemoVideo(editingVideo._id, body, token);
        setVideos((prev) =>
          prev.map((video) =>
            video._id === editingVideo._id ? result.item : video,
          ),
        );
        setSuccess("Demo video updated.");
      } else {
        const result = await api.createDemoVideo(body, token);
        setVideos((prev) => [...prev, result.item]);
        setSuccess("Demo video uploaded.");
      }

      setVideoModalOpen(false);
      setVideoDraft(emptyVideoDraft);
      setEditingVideo(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      void loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingVideo(false);
    }
  }

  function handleVideoDragStart(index: number) {
    setDraggedFrom(index);
  }

  function handleVideoDragOver(index: number) {
    if (draggedFrom === null || draggedFrom === index) return;
    setVideos((prev) => {
      const next = [...prev];
      const [dragged] = next.splice(draggedFrom, 1);
      next.splice(index, 0, dragged);
      return next.map((video, order) => ({ ...video, order }));
    });
    setDraggedFrom(index);
  }

  async function handleVideoDragEnd() {
    const from = draggedFrom;
    setDraggedFrom(null);
    if (from === null || !token) return;

    setSavingOrder(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await api.reorderDemoVideos(
        videos.map((video, order) => ({ id: video._id, order })),
        token,
      );
      setVideos(result.items || []);
      setSuccess("Video order saved.");
    } catch (err) {
      setError((err as Error).message);
      void loadData();
    } finally {
      setSavingOrder(false);
    }
  }

  async function deleteVideo(video: DemoVideoItem) {
    if (!token) return;
    if (
      !confirm(
        "Are you sure you want to delete this demo video?\n\nThis action cannot be undone.",
      )
    ) {
      return;
    }

    setDeletingId(video._id);
    setError(null);
    setSuccess(null);

    try {
      await api.deleteDemoVideo(video._id, token);
      setVideos((prev) => prev.filter((item) => item._id !== video._id));
      setSuccess("Demo video deleted.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="mb-8">
        <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
          Admin
        </span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Portfolio CMS
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Manage the portfolio site&apos;s hero copy and demo showreel videos.
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

      {/* ── Hero content ──────────────────────────────────────────────────── */}
      <Card padding="lg" className="mb-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Hero Content
            </h2>
            <p className="mt-1 text-sm text-fg-soft">
              The title and subtitle shown at the top of the portfolio site.
            </p>
          </div>
          {!editingHero && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setHeroDraft(hero);
                setSuccess(null);
                setError(null);
                setEditingHero(true);
              }}
              disabled={loading}>
              <Pencil size={16} />
              Edit
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-5 w-1/3 animate-pulse rounded bg-bg-soft" />
            <div className="h-5 w-2/3 animate-pulse rounded bg-bg-soft" />
          </div>
        ) : editingHero ? (
          <form onSubmit={saveHero} className="grid gap-4">
            <FieldLabel label="Title" required>
              <Input
                value={heroDraft.title}
                onChange={(e) =>
                  setHeroDraft({ ...heroDraft, title: e.target.value })
                }
                placeholder="Level up your setup"
                minLength={3}
                maxLength={120}
                required
              />
            </FieldLabel>
            <FieldLabel label="Subtitle" required>
              <Textarea
                value={heroDraft.subtitle}
                onChange={(e) =>
                  setHeroDraft({ ...heroDraft, subtitle: e.target.value })
                }
                placeholder="A short line describing the portfolio."
                minLength={5}
                maxLength={300}
                rows={3}
                required
              />
            </FieldLabel>
            <FieldLabel
              label="Hero media"
              hint="Image (jpg, png, webp, gif) or video (mp4, mov, webm) · max 100MB">
              <Input
                ref={heroFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm"
                onChange={pickHeroMediaFile}
                className="file:mr-3 file:rounded-full file:border-0 file:bg-neutral-950 file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              />
            </FieldLabel>

            {(heroMediaPreview || hero.media) && (
              <div className="overflow-hidden rounded-lg border border-line bg-black">
                {(heroMediaFile ? heroMediaTypeFromFile(heroMediaFile) : hero.media?.type) === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={heroMediaPreview ?? hero.media!.url}
                    alt="Hero media preview"
                    className="aspect-video w-full object-contain"
                  />
                ) : (
                  <video
                    controls
                    preload="metadata"
                    src={heroMediaPreview ?? hero.media!.url}
                    className="aspect-video w-full object-contain"
                  />
                )}
              </div>
            )}
            {!heroMediaFile && (
              <p className="text-xs text-fg-muted">
                {hero.media
                  ? "Current media will be kept. Choosing a new file replaces it."
                  : "No hero media set yet."}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={savingHero}>
                <Save size={16} />
                {savingHero ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={cancelEditHero}
                disabled={savingHero}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-fg-soft">
                Title
              </dt>
              <dd className="mt-1 text-base font-medium">
                {hero.title || (
                  <span className="text-fg-muted">Not set yet</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-fg-soft">
                Subtitle
              </dt>
              <dd className="mt-1 text-sm text-fg-soft">
                {hero.subtitle || (
                  <span className="text-fg-muted">Not set yet</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-fg-soft">
                Hero media
              </dt>
              <dd className="mt-2">
                {hero.media ? (
                  <div className="max-w-md overflow-hidden rounded-lg border border-line bg-black">
                    {hero.media.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hero.media.url}
                        alt="Hero media"
                        className="aspect-video w-full object-contain"
                      />
                    ) : (
                      <video
                        controls
                        preload="metadata"
                        src={hero.media.url}
                        className="aspect-video w-full object-contain"
                      />
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-fg-muted">Not set yet</span>
                )}
              </dd>
            </div>
          </dl>
        )}
      </Card>

      {/* ── Demo videos ───────────────────────────────────────────────────── */}
      <Card padding="lg">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Demo Videos</h2>
            <p className="mt-1 text-sm text-fg-soft">
              Showreel clips displayed on the portfolio site. mp4, mov or webm,
              up to 100MB each.
            </p>
            {videos.length > 1 && (
              <p className="mt-1 text-xs text-fg-muted">
                Drag the cards to reorder — the first card shows first on the
                site.
                {savingOrder && (
                  <span className="ml-1 text-fg-soft">Saving order…</span>
                )}
              </p>
            )}
          </div>
          <Button type="button" onClick={startCreateVideo} disabled={loading}>
            <Plus size={18} />
            Upload Video
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((key) => (
              <div
                key={key}
                className="overflow-hidden rounded-lg border border-line">
                <div className="aspect-video animate-pulse bg-bg-soft" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-bg-soft" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-bg-soft" />
                </div>
              </div>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-bg-soft px-6 py-14 text-center">
            <Film size={28} className="text-fg-muted" />
            <p className="mt-3 text-sm font-medium">No demo videos yet</p>
            <p className="mt-1 text-sm text-fg-soft">
              Upload your first showreel clip to see it here.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="mt-5"
              onClick={startCreateVideo}>
              <Plus size={16} />
              Upload Video
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {videos.map((video, index) => (
              <div
                key={video._id}
                draggable
                onDragStart={() => handleVideoDragStart(index)}
                onDragOver={(e) => {
                  e.preventDefault();
                  handleVideoDragOver(index);
                }}
                onDragEnd={handleVideoDragEnd}
                className={cn(
                  "flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-white transition-colors",
                  draggedFrom === index && "opacity-40 ring-2 ring-blue-400",
                )}>
                <div className="relative">
                  <video
                    controls
                    preload="metadata"
                    src={video.video.url}
                    className="aspect-video w-full bg-black object-contain"
                  />
                  <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                      <GripVertical size={12} />#{index + 1}
                    </span>
                    {index === 0 && (
                      <span className="rounded-full bg-emerald-500/90 px-2 py-0.5 text-[11px] font-medium text-white">
                        Shows first
                      </span>
                    )}
                    {index === videos.length - 1 && videos.length > 1 && (
                      <span className="rounded-full bg-neutral-700/80 px-2 py-0.5 text-[11px] font-medium text-white">
                        Shows last
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col p-4">
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-0.5 cursor-grab text-fg-muted active:cursor-grabbing"
                      title="Drag to reorder">
                      <GripVertical size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold" title={video.title}>
                        {video.title}
                      </h3>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded-full bg-bg-soft px-2 py-0.5 text-[11px] font-medium text-fg-soft">
                          {(video.orientation ?? "portrait") === "landscape"
                            ? "Landscape 16:9"
                            : "Short 9:16"}
                        </span>
                        <span className="text-xs text-fg-muted">
                          {formatDate(video.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => startEditVideo(video)}>
                      <Pencil size={14} />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => void deleteVideo(video)}
                      disabled={deletingId === video._id}>
                      <Trash2 size={14} />
                      {deletingId === video._id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Upload / edit video modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {videoModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-3 py-6 backdrop-blur-sm sm:p-4"
            onClick={closeVideoModal}>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <h2 className="text-xl font-semibold">
                  {editingVideo ? "Edit demo video" : "Upload demo video"}
                </h2>
                <button
                  type="button"
                  onClick={closeVideoModal}
                  disabled={savingVideo}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-fg-soft transition hover:bg-bg-soft disabled:opacity-50"
                  aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={saveVideo} className="space-y-4">
                <FieldLabel label="Title" required>
                  <Input
                    value={videoDraft.title}
                    onChange={(e) =>
                      setVideoDraft({ ...videoDraft, title: e.target.value })
                    }
                    placeholder="Showreel 2026"
                    maxLength={100}
                    required
                  />
                </FieldLabel>

                <FieldLabel
                  label="Orientation"
                  hint="Controls the card shape on the portfolio site">
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { value: "portrait", label: "Short", sub: "9:16 vertical" },
                        { value: "landscape", label: "Landscape", sub: "16:9 wide" },
                      ] as const
                    ).map((opt) => {
                      const active = videoDraft.orientation === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setVideoDraft((current) => ({
                              ...current,
                              orientation: opt.value,
                            }))
                          }
                          className={cn(
                            "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                            active
                              ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900"
                              : "border-line hover:border-neutral-400",
                          )}>
                          <span
                            className={cn(
                              "flex-shrink-0 rounded border-2",
                              opt.value === "portrait" ? "h-8 w-[18px]" : "h-[18px] w-8",
                              active ? "border-neutral-900" : "border-neutral-300",
                            )}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{opt.label}</span>
                            <span className="block text-xs text-fg-muted">{opt.sub}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </FieldLabel>

                <FieldLabel
                  label="Video file"
                  required={!editingVideo}
                  hint={
                    editingVideo
                      ? "optional — leave empty to keep the current video"
                      : "mp4, mov or webm · max 100MB"
                  }>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                    onChange={pickVideoFile}
                    className="file:mr-3 file:rounded-full file:border-0 file:bg-neutral-950 file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                  />
                </FieldLabel>

                {editingVideo && !videoDraft.file && (
                  <p className="text-xs text-fg-muted">
                    Current video will be kept. Choosing a new file replaces it.
                  </p>
                )}

                <div className="flex flex-wrap gap-3 pt-1">
                  <Button type="submit" disabled={savingVideo}>
                    {savingVideo
                      ? "Uploading..."
                      : editingVideo
                        ? "Save Changes"
                        : "Upload Video"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={closeVideoModal}
                    disabled={savingVideo}>
                    Cancel
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
