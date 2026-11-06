/** Admin queries for the media library. */
import { all, one } from './db.ts';
import { hydrate, mediaUrl, pickVariant, type Media } from './media.ts';

export function mediaDto(m: Media) {
  const thumb = m.kind === 'image' ? pickVariant(m, 480) : null;
  return {
    id: m.id, kind: m.kind, mime: m.mime, original_name: m.original_name, alt: m.alt, description: m.description, folder: m.folder,
    width: m.width, height: m.height, size_bytes: m.size_bytes, created_at: m.created_at,
    thumb: thumb ? mediaUrl(m, thumb.file) : m.kind === 'video' ? mediaUrl(m, m.variants[0]?.file ?? '') : null,
    url: m.variants.length ? mediaUrl(m, [...m.variants].sort((a, b) => b.w - a.w)[0].file) : null,
    variants: m.variants.map((v) => ({ w: v.w, h: v.h, bytes: v.bytes, url: mediaUrl(m, v.file) })),
  };
}

export async function listMedia(f: { q?: string; folder?: string; kind?: string; page?: number; perPage?: number; sort?: string }) {
  const w: string[] = [];
  const p: unknown[] = [];
  if (f.q) { w.push('(original_name LIKE ? OR alt LIKE ? OR description LIKE ?)'); const l = `%${f.q.replace(/[%_]/g, '\\$&')}%`; p.push(l, l, l); }
  if (f.folder) { w.push('folder = ?'); p.push(f.folder); }
  if (f.kind === 'image' || f.kind === 'video') { w.push('kind = ?'); p.push(f.kind); }
  if (f.kind === 'missing_alt') w.push("kind = 'image' AND alt = ''");
  const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const perPage = Math.min(96, Math.max(12, f.perPage ?? 48));
  const page = Math.max(1, f.page ?? 1);
  const total = Number((await one<{ n: number }>(`SELECT COUNT(*) n FROM media ${where}`, p))?.n ?? 0);
  const order = f.sort === 'oldest' ? 'id ASC' : f.sort === 'name' ? 'original_name ASC' : f.sort === 'size' ? 'size_bytes DESC' : 'id DESC';
  const rows = await all(`SELECT * FROM media ${where} ORDER BY ${order} LIMIT ? OFFSET ?`, [...p, perPage, (page - 1) * perPage]);
  return { items: rows.map((r) => mediaDto(hydrate(r))), total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function mediaFolders() {
  return all<{ folder: string; n: number }>('SELECT folder, COUNT(*) n FROM media GROUP BY folder ORDER BY folder');
}
export const formatBytes = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
