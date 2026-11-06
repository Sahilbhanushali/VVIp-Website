/** Page & section management (working copy). Publishing lives in content.ts. */
import { z } from 'astro/zod';
import { all, one, run, tx, json } from './db.ts';
import { parseSection, emptySection, SECTION_SCHEMAS, type SectionType } from './sections.ts';
import { purgePublicCache } from './settings.ts';

const RESERVED = /^\/(admin|api|media|_astro|assets|icons|brand)(\/|$)|^\/(robots\.txt|sitemap\.xml|og-image\.jpg)$/i;
export const pathSchema = z
  .string()
  .trim()
  .max(190)
  .regex(/^\/([a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*)?$/, 'Use lower-case letters, numbers, hyphens; start with “/” (e.g. /about-us or /news/launch.html)')
  .refine((p) => !RESERVED.test(p), 'This path is reserved by the system');

const opt = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));
export const pageFieldsSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  path: pathSchema,
  visibility: z.enum(['public', 'hidden']).default('public'),
  excerpt: opt(800),
  body: z.string().max(200_000).nullable().optional().transform((v) => v ?? null),
  cover_media_id: z.coerce.number().int().positive().nullable().optional().transform((v) => v || null),
  cover_alt: opt(255),
  seo_title: opt(200),
  seo_description: opt(320),
  seo_keywords: opt(500),
  canonical_url: z.string().trim().max(255).nullable().optional().refine((v) => !v || /^https?:\/\//.test(v), 'Canonical URL must be absolute (https://…)').transform((v) => v || null),
  og_title: opt(200),
  og_description: opt(320),
  og_image_id: z.coerce.number().int().positive().nullable().optional().transform((v) => v || null),
  robots_index: z.coerce.boolean().default(true),
  robots_follow: z.coerce.boolean().default(true),
  display_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal('')).transform((v) => v || null),
  sort_order: z.coerce.number().int().min(-999).max(999).default(0),
});
export type PageFieldsInput = z.infer<typeof pageFieldsSchema>;

export async function listPagesAdmin(f: { q?: string; template?: string; status?: string }) {
  const w: string[] = [];
  const p: unknown[] = [];
  if (f.q) { w.push('(p.title LIKE ? OR p.path LIKE ?)'); p.push(`%${f.q}%`, `%${f.q}%`); }
  if (f.template) { w.push('p.template = ?'); p.push(f.template); }
  if (f.status === 'published' || f.status === 'draft') { w.push('p.status = ?'); p.push(f.status); }
  if (f.status === 'changed') w.push("p.status = 'published' AND p.updated_at > r.created_at");
  return all(
    `SELECT p.id, p.path, p.title, p.template, p.status, p.visibility, p.is_system, p.updated_at, p.published_at, p.display_date, p.property_id,
            r.created_at AS revision_at, (p.status = 'published' AND p.updated_at > r.created_at + INTERVAL 1 SECOND) AS has_changes,
            u.name AS updated_by_name, (SELECT COUNT(*) FROM page_sections s WHERE s.page_id = p.id) AS section_count
       FROM pages p LEFT JOIN page_revisions r ON r.id = p.published_revision_id LEFT JOIN admin_users u ON u.id = p.updated_by
       ${w.length ? `WHERE ${w.join(' AND ')}` : ''}
      ORDER BY FIELD(p.template,'home','standard','property','article','legal'), p.sort_order, p.title`,
    p,
  );
}

export async function getPageAdmin(id: number) {
  const page = await one(
    `SELECT p.*, r.created_at AS revision_at, (p.status = 'published' AND p.updated_at > r.created_at + INTERVAL 1 SECOND) AS has_changes
       FROM pages p LEFT JOIN page_revisions r ON r.id = p.published_revision_id WHERE p.id = ?`,
    [id],
  );
  if (!page) return null;
  const sections = (await all('SELECT id, type, label, position, enabled, data, updated_at FROM page_sections WHERE page_id = ? ORDER BY position, id', [id])).map((s) => ({
    ...s, enabled: !!s.enabled, data: json(s.data, {}),
  }));
  const revisions = await all('SELECT r.id, r.created_at, u.name FROM page_revisions r LEFT JOIN admin_users u ON u.id = r.published_by WHERE r.page_id = ? ORDER BY r.id DESC LIMIT 15', [id]);
  return { page, sections, revisions };
}

const touch = (pageId: number, userId: number, c?: any) => run('UPDATE pages SET updated_at = UTC_TIMESTAMP(), updated_by = ? WHERE id = ?', [userId, pageId], c);

export async function createPage(input: { title: string; path: string; template: 'standard' | 'article' | 'legal' }, userId: number) {
  const res = await run('INSERT INTO pages (title, path, template, status, updated_by, display_date) VALUES (?,?,?,?,?, ?)', [
    input.title, input.path, input.template, 'draft', userId, input.template === 'standard' ? null : new Date().toISOString().slice(0, 10),
  ]);
  if (input.template === 'standard') {
    await run('INSERT INTO page_sections (page_id, type, label, position, data) VALUES (?,?,?,?,?)', [
      res.insertId, 'rich_text', 'Content', 0, JSON.stringify(SECTION_SCHEMAS.rich_text.parse({ title: input.title, body: '' })),
    ]);
  }
  return res.insertId;
}

export async function updatePageFields(id: number, data: PageFieldsInput, userId: number) {
  const cur = await one<{ is_system: number; template: string; path: string }>('SELECT is_system, template, path FROM pages WHERE id = ?', [id]);
  if (!cur) return false;
  if (cur.template === 'home' && data.path !== '/') throw Object.assign(new Error('The homepage path cannot change.'), { status: 400 });
  await run(
    `UPDATE pages SET title=?, path=?, visibility=?, excerpt=?, body=?, cover_media_id=?, cover_alt=?, seo_title=?, seo_description=?, seo_keywords=?,
       canonical_url=?, og_title=?, og_description=?, og_image_id=?, robots_index=?, robots_follow=?, display_date=?, sort_order=?, updated_by=?, updated_at=UTC_TIMESTAMP() WHERE id=?`,
    [data.title, data.path, data.visibility, data.excerpt, data.body, data.cover_media_id, data.cover_alt, data.seo_title, data.seo_description, data.seo_keywords,
      data.canonical_url, data.og_title, data.og_description, data.og_image_id, data.robots_index ? 1 : 0, data.robots_follow ? 1 : 0, data.display_date, data.sort_order, userId, id],
  );
  // A path change on a live page must not 404 old links until republished: update navigation that pointed to the old path.
  if (cur.path !== data.path) {
    await run('UPDATE navigation_items SET url = ? WHERE url = ?', [data.path, cur.path]);
    await purgePublicCache();
  }
  return true;
}

export async function deletePage(id: number) {
  const p = await one<{ is_system: number; property_id: number | null }>('SELECT is_system, property_id FROM pages WHERE id = ?', [id]);
  if (!p) return 'missing';
  if (p.is_system) return 'system';
  if (p.property_id) return 'property';
  await run('DELETE FROM pages WHERE id = ?', [id]);
  await purgePublicCache();
  return 'ok';
}

export async function duplicatePage(id: number, userId: number) {
  return tx(async (c) => {
    const p = await one<any>('SELECT * FROM pages WHERE id = ?', [id], c);
    if (!p) return null;
    if (p.template === 'home' || p.property_id) throw Object.assign(new Error('The homepage and property pages cannot be duplicated (duplicate the property instead).'), { status: 400 });
    let path = '';
    for (let i = 2; i < 100; i++) {
      const cand = p.path.endsWith('.html') ? p.path.replace(/\.html$/, `-copy${i > 2 ? i : ''}.html`) : `${p.path}-copy${i > 2 ? i : ''}`;
      if (!(await one('SELECT id FROM pages WHERE path = ?', [cand], c))) { path = cand; break; }
    }
    const cols = ['title', 'template', 'visibility', 'excerpt', 'body', 'cover_media_id', 'cover_alt', 'seo_title', 'seo_description', 'seo_keywords', 'og_title', 'og_description', 'og_image_id', 'robots_index', 'robots_follow', 'display_date', 'sort_order'];
    const res = await run(`INSERT INTO pages (path, status, updated_by, ${cols.join(',')}) VALUES (?, 'draft', ?, ${cols.map(() => '?').join(',')})`, [path, userId, ...cols.map((k) => (k === 'title' ? `${p.title} (copy)` : p[k]))], c);
    await run('INSERT INTO page_sections (page_id, type, label, position, enabled, data) SELECT ?, type, label, position, enabled, data FROM page_sections WHERE page_id = ?', [res.insertId, id], c);
    return res.insertId;
  });
}

/* ───── Sections ───── */
export async function addSection(pageId: number, type: SectionType, userId: number, afterPosition?: number) {
  return tx(async (c) => {
    const max = await one<{ m: number | null }>('SELECT MAX(position) m FROM page_sections WHERE page_id = ?', [pageId], c);
    const pos = afterPosition !== undefined ? afterPosition + 1 : (max?.m ?? -1) + 1;
    await run('UPDATE page_sections SET position = position + 1 WHERE page_id = ? AND position >= ?', [pageId, pos], c);
    const res = await run('INSERT INTO page_sections (page_id, type, label, position, enabled, data) VALUES (?,?,?,?,0,?)', [pageId, type, null, pos, JSON.stringify(emptySection(type))], c);
    await touch(pageId, userId, c);
    return res.insertId;
  });
}

export async function updateSection(sectionId: number, input: { label?: string | null; enabled?: boolean; data?: unknown }, userId: number) {
  const s = await one<{ page_id: number; type: string }>('SELECT page_id, type FROM page_sections WHERE id = ?', [sectionId]);
  if (!s) return null;
  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.data !== undefined) { sets.push('data = ?'); params.push(JSON.stringify(parseSection(s.type, input.data))); }
  if (input.label !== undefined) { sets.push('label = ?'); params.push(input.label ? String(input.label).slice(0, 120) : null); }
  if (input.enabled !== undefined) { sets.push('enabled = ?'); params.push(input.enabled ? 1 : 0); }
  if (sets.length) await run(`UPDATE page_sections SET ${sets.join(', ')} WHERE id = ?`, [...params, sectionId]);
  await touch(s.page_id, userId);
  return s.page_id;
}

export async function duplicateSection(sectionId: number, userId: number) {
  return tx(async (c) => {
    const s = await one<any>('SELECT * FROM page_sections WHERE id = ?', [sectionId], c);
    if (!s) return null;
    await run('UPDATE page_sections SET position = position + 1 WHERE page_id = ? AND position > ?', [s.page_id, s.position], c);
    const res = await run('INSERT INTO page_sections (page_id, type, label, position, enabled, data) VALUES (?,?,?,?,?,?)', [s.page_id, s.type, s.label ? `${s.label} (copy)` : null, s.position + 1, s.enabled, typeof s.data === 'string' ? s.data : JSON.stringify(s.data)], c);
    await touch(s.page_id, userId, c);
    return res.insertId;
  });
}

export async function deleteSection(sectionId: number, userId: number) {
  const s = await one<{ page_id: number }>('SELECT page_id FROM page_sections WHERE id = ?', [sectionId]);
  if (!s) return null;
  await run('DELETE FROM page_sections WHERE id = ?', [sectionId]);
  await touch(s.page_id, userId);
  return s.page_id;
}

export async function reorderSections(pageId: number, ids: number[], userId: number) {
  await tx(async (c) => {
    const existing = await all<{ id: number }>('SELECT id FROM page_sections WHERE page_id = ?', [pageId], c);
    const set = new Set(existing.map((e) => e.id));
    if (ids.length !== set.size || !ids.every((i) => set.has(i))) throw Object.assign(new Error('Section list is out of date — reload the page.'), { status: 409 });
    for (const [i, id] of ids.entries()) await run('UPDATE page_sections SET position = ? WHERE id = ?', [i, id], c);
    await touch(pageId, userId, c);
  });
}

export async function restoreRevision(pageId: number, revisionId: number, userId: number) {
  const r = await one<{ snapshot: unknown }>('SELECT snapshot FROM page_revisions WHERE id = ? AND page_id = ?', [revisionId, pageId]);
  if (!r) return false;
  const snap = json<any>(r.snapshot, null);
  await tx(async (c) => {
    await run('DELETE FROM page_sections WHERE page_id = ?', [pageId], c);
    for (const [i, s] of snap.sections.entries())
      await run('INSERT INTO page_sections (page_id, type, label, position, enabled, data) VALUES (?,?,?,?,1,?)', [pageId, s.type, s.label, i, JSON.stringify(s.data)], c);
    const p = snap.page;
    await run(
      'UPDATE pages SET title=?, excerpt=?, body=?, cover_media_id=?, cover_alt=?, seo_title=?, seo_description=?, seo_keywords=?, canonical_url=?, og_title=?, og_description=?, og_image_id=?, robots_index=?, robots_follow=? WHERE id=?',
      [p.title, p.excerpt, p.body, p.cover_media_id, p.cover_alt, p.seo_title, p.seo_description, p.seo_keywords, p.canonical_url, p.og_title, p.og_description, p.og_image_id, p.robots_index ? 1 : 0, p.robots_follow ? 1 : 0, pageId],
      c,
    );
    await touch(pageId, userId, c);
  });
  return true;
}
