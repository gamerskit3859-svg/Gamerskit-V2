import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import multer, { MulterError } from "multer";

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB

const ALLOWED_VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm"]);
const ALLOWED_VIDEO_MIMETYPES = new Set([
  "video/mp4",
  "video/quicktime", // .mov
  "video/webm",
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const ALLOWED_IMAGE_MIMETYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** The extension is authoritative — some clients send a generic mimetype. */
export function mediaTypeFromExtension(ext: string): "image" | "video" | null {
  if (ALLOWED_IMAGE_EXTENSIONS.has(ext)) return "image";
  if (ALLOWED_VIDEO_EXTENSIONS.has(ext)) return "video";
  return null;
}

/**
 * Files are buffered in memory because they are streamed straight back out to
 * R2 — nothing is ever written to the (read-only, on serverless) local disk.
 */
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Some clients send a generic mimetype, so the extension is authoritative.
    const mimetypeOk =
      ALLOWED_VIDEO_MIMETYPES.has(file.mimetype) ||
      file.mimetype === "application/octet-stream";

    if (!ALLOWED_VIDEO_EXTENSIONS.has(ext) || !mimetypeOk) {
      cb(new Error("video must be one of: mp4, mov, webm"));
      return;
    }
    cb(null, true);
  },
}).single("video");

/**
 * Wraps multer so upload failures come back as the same JSON error shape as
 * the rest of the API instead of multer's raw errors.
 */
export function singleVideoUpload(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  videoUpload(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "video must be 100MB or smaller"
          : err.message;
      res.status(status).json({ error: message, code: err.code });
      return;
    }
    if (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    next();
  });
}

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const type = mediaTypeFromExtension(ext);
    const mimetypeOk =
      type === "image"
        ? ALLOWED_IMAGE_MIMETYPES.has(file.mimetype) || file.mimetype === "application/octet-stream"
        : type === "video"
          ? ALLOWED_VIDEO_MIMETYPES.has(file.mimetype) || file.mimetype === "application/octet-stream"
          : false;

    if (!type || !mimetypeOk) {
      cb(new Error("media must be an image (jpg, png, webp, gif) or video (mp4, mov, webm)"));
      return;
    }
    cb(null, true);
  },
}).single("media");

/** Same wrapping as {@link singleVideoUpload}, for the hero image/video field. */
export function singleMediaUpload(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  mediaUpload(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "media must be 100MB or smaller"
          : err.message;
      res.status(status).json({ error: message, code: err.code });
      return;
    }
    if (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    next();
  });
}
