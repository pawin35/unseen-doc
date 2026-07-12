import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const DATA_DIR = path.resolve(
  /* turbopackIgnore: true */ process.cwd(),
  process.env.DATA_DIR ?? "./data",
);
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
};

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export class UploadError extends Error {}

/**
 * Persist an uploaded image; returns the filename (relative to UPLOADS_DIR)
 * to store in the DB. Deletes `previous` on success when provided.
 */
export async function saveUpload(
  file: File,
  kind: "logo" | "signature",
  previous?: string | null,
): Promise<string> {
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    throw new UploadError("รองรับเฉพาะไฟล์ภาพ PNG หรือ JPEG");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("ไฟล์ต้องมีขนาดไม่เกิน 2 MB");
  }
  await mkdir(UPLOADS_DIR, { recursive: true });
  const name = `${kind}-${randomUUID()}${ext}`;
  await writeFile(path.join(UPLOADS_DIR, name), Buffer.from(await file.arrayBuffer()));
  if (previous) {
    await unlink(path.join(UPLOADS_DIR, previous)).catch(() => {});
  }
  return name;
}

/** Resolve an upload filename to an absolute path, rejecting traversal. */
export function resolveUploadPath(relative: string): string {
  const resolved = path.resolve(UPLOADS_DIR, relative);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
    throw new UploadError("Invalid upload path");
  }
  return resolved;
}
