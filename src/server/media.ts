/**
 * Media library storage.
 * Files live in UPLOAD_DIR/<storage_key>/ (outside the build output, so they
 * persist across deployments). Only metadata is stored in the database.
 * Images are validated by decoding them with sharp (not by extension or the
 * client-supplied MIME type), EXIF-stripped, and converted to responsive WebP
 * variants. Videos are validated by their container signature. SVG and any
 * other type is rejected (SVG can carry script).
 */
import fs from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import sharp, { type Metadata } from 'sharp';
import { all, one, run, json } from './db.ts';
import { env } from './env.ts';
import { randomToken } from './crypto.ts';

export const IMAGE_WIDTHS = [240, 480, 960, 1600, 2560] as const;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

export type Variant = { w: number; h: number; file: string; bytes: number };
export type Media = {
  id: number;
  storage_key: string;
  original_name: string;
  kind: 'image' | 'video' | 'icon';
  mime: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt: string;
  description: string | null;
  folder: string;
  variants: Variant[];
  created_at: Date;
  updated_at: Date;
};

export const uploadRoot = () => path.resolve(env('UPLOAD_DIR', './storage/uploads'));
const KEY_RE = /^[a-z0-9-]{8,80}$/;
const FILE_RE = /^[a-z0-9._-]{1,80}$/;

export function mediaUrl(m: Pick<Media, 'storage_key'>, file: string) {
  return `/media/${m.storage_key}/${file}`;
}

/** Choose the smallest variant at least `w` wide (or the largest available). */
export function pickVariant(m: Media, w: number): Variant | null {
  if (!m.variants.length) return null;
  const sorted = [...m.variants].sort((a, b) => a.w - b.w);
  return sorted.find((v) => v.w >= w) ?? sorted[sorted.length - 1];
}
export function srcset(m: Media): string {
  return [...m.variants].sort((a, b) => a.w - b.w).map((v) => `${mediaUrl(m, v.file)} ${v.w}w`).join(', ');
}

export function hydrate(row: any): Media {
  return { ...row, variants: json<Variant[]>(row.variants, []) } as Media;
}

function sniffVideo(buf: Buffer): 'video/mp4' | 'video/webm' | null {
  if (buf.length > 12 && buf.subarray(4, 8).toString('latin1') === 'ftyp') return 'video/mp4';
  if (buf.length > 4 && buf.readUInt32BE(0) === 0x1a45dfa3) return 'video/webm';
  return null;
}

export class MediaError extends Error {}

export async function storeUpload(
  buf: Buffer,
  originalName: string,
  opts: { alt?: string; description?: string; folder?: string; userId?: number | null; replaceId?: number },
): Promise<Media> {
  const safeName = path.basename(originalName).replace(/[^\w.\- ()]+/g, '_').slice(0, 200) || 'upload';
  const key = `${new Date().toISOString().slice(0, 7).replace('-', '')}-${randomToken(8)}`;
  const dir = path.join(uploadRoot(), key);

  let kind: Media['kind'];
  let mime: string;
  let width: number | null = null;
  let height: number | null = null;
  const variants: Variant[] = [];

  const video = sniffVideo(buf);
  if (video) {
    if (buf.length > MAX_VIDEO_BYTES) throw new MediaError('Videos must be 80 MB or smaller.');
    kind = 'video';
    mime = video;
    await fs.mkdir(dir, { recursive: true });
    const file = video === 'video/mp4' ? 'video.mp4' : 'video.webm';
    await fs.writeFile(path.join(dir, file), buf, { mode: 0o644 });
    variants.push({ w: 0, h: 0, file, bytes: buf.length });
  } else {
    if (buf.length > MAX_IMAGE_BYTES) throw new MediaError('Images must be 15 MB or smaller.');
    let meta: Metadata;
    try {
      meta = await sharp(buf, { limitInputPixels: 80_000_000 }).metadata();
    } catch {
      throw new MediaError('Unsupported file. Upload a JPEG, PNG, WebP, AVIF or GIF image, or an MP4/WebM video.');
    }
    if (!meta.format || !['jpeg', 'png', 'webp', 'avif', 'gif', 'heif'].includes(meta.format) || !meta.width || !meta.height)
      throw new MediaError('Unsupported image format. Use JPEG, PNG, WebP, AVIF or GIF.');
    kind = 'image';
    mime = 'image/webp';
    const base = sharp(buf, { limitInputPixels: 80_000_000 }).rotate(); // honour EXIF orientation, metadata stripped on output
    const oriented = await base.clone().metadata();
    const swap = (oriented.orientation ?? 1) >= 5;
    width = swap ? meta.height : meta.width;
    height = swap ? meta.width : meta.height;
    await fs.mkdir(dir, { recursive: true });
    const hasAlpha = !!meta.hasAlpha;
    const widths = [...IMAGE_WIDTHS.filter((w) => w < width!), Math.min(width!, 2560)];
    for (const w of [...new Set(widths)]) {
      const file = `w${w}.webp`;
      const out = await base.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: hasAlpha ? 88 : 76, effort: 4 }).toBuffer({ resolveWithObject: true });
      await fs.writeFile(path.join(dir, file), out.data, { mode: 0o644 });
      variants.push({ w: out.info.width, h: out.info.height, file, bytes: out.data.length });
    }
  }

  const sizeBytes = variants.reduce((s, v) => Math.max(s, v.bytes), 0) || buf.length;
  if (opts.replaceId) {
    const old = await getMedia(opts.replaceId);
    if (!old) throw new MediaError('Media not found.');
    await run('UPDATE media SET storage_key=?, original_name=?, kind=?, mime=?, size_bytes=?, width=?, height=?, variants=? WHERE id=?', [
      key, safeName, kind, mime, sizeBytes, width, height, JSON.stringify(variants), old.id,
    ]);
    await removeFiles(old.storage_key);
    return (await getMedia(old.id))!;
  }
  const res = await run(
    'INSERT INTO media (storage_key, original_name, kind, mime, size_bytes, width, height, alt, description, folder, variants, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [key, safeName, kind, mime, sizeBytes, width, height, (opts.alt ?? '').slice(0, 255), opts.description ?? null, (opts.folder || 'general').slice(0, 60), JSON.stringify(variants), opts.userId ?? null],
  );
  return (await getMedia(res.insertId))!;
}

async function removeFiles(key: string) {
  if (!KEY_RE.test(key)) return;
  await fs.rm(path.join(uploadRoot(), key), { recursive: true, force: true });
}

export async function getMedia(id: number): Promise<Media | null> {
  const row = await one('SELECT * FROM media WHERE id = ?', [id]);
  return row ? hydrate(row) : null;
}
export async function getMediaMany(ids: number[]): Promise<Map<number, Media>> {
  const uniq = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
  if (!uniq.length) return new Map();
  const rows = await all(`SELECT * FROM media WHERE id IN (${uniq.map(() => '?').join(',')})`, uniq);
  return new Map(rows.map((r) => [r.id as number, hydrate(r)]));
}

/** Where is a media item referenced? Used to block deleting media that is in use. */
export async function mediaUsage(id: number): Promise<string[]> {
  const uses: string[] = [];
  const add = (rows: any[], label: (r: any) => string) => rows.forEach((r) => uses.push(label(r)));
  add(await all('SELECT title FROM properties WHERE main_image_id = ? OR og_image_id = ?', [id, id]), (r) => `Property: ${r.title}`);
  add(await all('SELECT p.title FROM property_images pi JOIN properties p ON p.id = pi.property_id WHERE pi.media_id = ?', [id]), (r) => `Gallery of ${r.title}`);
  add(await all('SELECT p.title FROM property_amenities a JOIN properties p ON p.id = a.property_id WHERE a.media_id = ?', [id]), (r) => `Amenity on ${r.title}`);
  add(await all('SELECT title FROM pages WHERE cover_media_id = ? OR og_image_id = ?', [id, id]), (r) => `Page: ${r.title}`);
  // Section payloads and settings reference media as {"media_id": n} / "*_media_id": n
  const re = `"[a-z_]*media_id": ?${id}([^0-9]|$)`;
  add(await all('SELECT DISTINCT p.title FROM page_sections s JOIN pages p ON p.id = s.page_id WHERE JSON_COMPACT(s.data) REGEXP ?', [re]), (r) => `Section on ${r.title}`);
  add(await all('SELECT setting_key FROM settings WHERE JSON_COMPACT(value) REGEXP ?', [re]), (r) => `Setting: ${r.setting_key}`);
  return [...new Set(uses)];
}

export async function deleteMedia(id: number) {
  const m = await getMedia(id);
  if (!m) return false;
  await run('DELETE FROM media WHERE id = ?', [id]);
  await removeFiles(m.storage_key);
  return true;
}

/** Resolve a /media/<key>/<file> request to a file on disk (path-traversal safe). */
export function resolveMediaFile(key: string, file: string): { path: string; size: number; type: string } | null {
  if (!KEY_RE.test(key) || !FILE_RE.test(file)) return null;
  const p = path.join(uploadRoot(), key, file);
  if (!p.startsWith(uploadRoot() + path.sep) || !existsSync(p)) return null;
  const type = file.endsWith('.webp') ? 'image/webp' : file.endsWith('.mp4') ? 'video/mp4' : file.endsWith('.webm') ? 'video/webm' : null;
  if (!type) return null;
  return { path: p, size: statSync(p).size, type };
}
export { createReadStream };
