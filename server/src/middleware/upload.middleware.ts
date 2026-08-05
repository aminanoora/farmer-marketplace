import multer from "multer";
import path from "path";
import { put, del } from "@vercel/blob";
import { env } from "../config/env";

const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only images and PDF files are allowed"));
  }
};

/**
 * Parses multipart uploads into memory (Buffers). Files are uploaded to Vercel
 * Blob via `uploadFilesToBlob` inside the controllers — serverless functions
 * have no persistent disk, so nothing is written to the filesystem.
 *
 * Keep the per-file limit at or below 4 MB: Vercel serverless functions cap
 * the total request body at 4.5 MB.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: env.maxFileSize },
});

// Total across all files in one request — Vercel serverless functions cap the
// request body at 4.5 MB, so enforce 4 MB here with a clear error instead of a
// confusing platform 413.
const TOTAL_UPLOAD_LIMIT = 4 * 1024 * 1024;

/**
 * Upload in-memory files to Vercel Blob and return their public URLs.
 *
 * Requires a Vercel Blob store: the `BLOB_READ_WRITE_TOKEN` env var is
 * injected automatically when you create a Blob store in the Vercel project
 * (or add it manually to your local .env for local development).
 */
export async function uploadFilesToBlob(
  files: Express.Multer.File[]
): Promise<string[]> {
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > TOTAL_UPLOAD_LIMIT) {
    throw new Error(
      "Total image size exceeds 4MB. Please use fewer or smaller images."
    );
  }

  // Check the total before uploading anything so a failed batch never leaves
  // partially-uploaded (orphaned) blobs behind.
  const urls: string[] = [];
  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const key = `products/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const blob = await put(key, file.buffer, {
      access: "public",
      contentType: file.mimetype,
      addRandomSuffix: true,
    });
    urls.push(blob.url);
  }
  return urls;
}

/**
 * Best-effort deletion of Vercel Blob objects. Only URLs that belong to a
 * Vercel Blob store are touched; anything else (Unsplash, placeholders, etc.)
 * is ignored. Failures are logged, never thrown into the request flow.
 */
export async function deleteBlobs(urls: string[]): Promise<void> {
  const BLOB_URL_RE = /^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//;
  const blobUrls = urls.filter((u) => BLOB_URL_RE.test(u));
  if (blobUrls.length === 0) return;
  await del(blobUrls);
}
