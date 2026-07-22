import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../env.js";

export type StoredObject = {
  url: string;
  key: string;
};

/**
 * R2 is only wired up when every credential is present. Routes call this first
 * so a misconfigured deployment fails with a clear 503 instead of an opaque
 * AWS SDK error.
 */
export function isR2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET &&
      env.R2_PUBLIC_URL,
  );
}

let client: S3Client | null = null;

function r2Client(): S3Client {
  if (!isR2Configured()) {
    const err = new Error("object storage is not configured") as Error & {
      status: number;
    };
    err.status = 503;
    throw err;
  }
  client ??= new S3Client({
    region: "auto",
    endpoint:
      env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    // Custom endpoints (S3-compatible servers) address buckets by path.
    forcePathStyle: Boolean(env.R2_ENDPOINT),
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

function buildKey(folder: string, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  return `${folder}/${Date.now()}-${randomUUID()}${ext}`;
}

export async function uploadToR2(
  file: Express.Multer.File,
  folder: string,
): Promise<StoredObject> {
  const key = buildKey(folder, file.originalname);

  await r2Client().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  );

  return { key, url: `${env.R2_PUBLIC_URL}/${key}` };
}

export async function deleteFromR2(key: string): Promise<void> {
  if (!key) return;
  await r2Client().send(
    new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
  );
}

/**
 * Used when the object is already orphaned (e.g. a video that was just
 * replaced). A failure here leaks a bucket object but must not fail the
 * request, since the database is already consistent.
 */
export async function deleteFromR2Quietly(key: string): Promise<void> {
  try {
    await deleteFromR2(key);
  } catch (err) {
    console.error(`[r2] failed to delete orphaned object ${key}`, err);
  }
}
