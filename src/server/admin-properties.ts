/**
 * Property management. Every property owns a companion page (template
 * "property") whose path is /<slug>.html; publishing/unpublishing the
 * property publishes/unpublishes that page so the public site follows.
 */
import { z } from 'astro/zod';
import { all, one, run, tx } from './db.ts';
import { publishPage, unpublishPage } from './content.ts';
import { purgePublicCache } from './settings.ts';
import { SECTION_SCHEMAS } from './sections.ts';

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'property';

const optStr = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));
const optNum = (max = 1e12) => z.union([z.number(), z.string()]).nullable().optional().transform((v, c) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) { c.addIssue({ code: 'custom', message: 'Enter a valid number' }); return z.NEVER; }
  return n;
});
const idOrNull = z.union([z.number(), z.string()]).nullable().optional().transform((v) => (v ? Number(v) || null : null));

export const propertySchema = z.object({
  title: z.string().trim().min(2, 'Title is required').max(160),
  slug: z.string().trim().max(120).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lower-case letters, numbers and hyphens only'),
  tagline: optStr(255),
  summary: optStr(600),
  description: z.string().max(100_000).nullable().optional().transform((v) => v || null),
  property_type: z.string().trim().min(1).max(60),
  category_id: idOrNull,
  developer: optStr(120),
  location: optStr(160),
  address: optStr(255),
  latitude: optNum(90),
  longitude: optNum(180),
  price_amount: optNum(),
  price_label: optStr(80),
  bedrooms: optNum(255),
  bathrooms: optNum(255),
  area: optNum(),
  area_unit: z.enum(['sqft', 'sqm', 'acre', 'sqyd']).default('sqft'),
  availability: z.enum(['available', 'upcoming', 'sold_out', 'on_request']),
  is_featured: z.coerce.boolean().default(false),
  status: z.enum(['draft', 'published']),
  main_image_id: idOrNull,
  seo_title: optStr(160),
  seo_description: optStr(320),
  og_image_id: idOrNull,
  images: z.array(z.object({ media_id: z.coerce.number().int().positive(), caption: optStr(160), category: optStr(40), shape: z.enum(['std', 'wide', 'tall']).default('std') })).max(80).default([]),
  amenities: z.array(z.object({ name: z.string().trim().min(1, 'Name required').max(80), icon: optStr(60), media_id: idOrNull })).max(60).default([]),
  specs: z.array(z.object({ label: z.string().trim().min(1, 'Label required').max(80), value: z.string().trim().min(1, 'Value required').max(160) })).max(40).default([]),
});
export type PropertyInput = z.infer<typeof propertySchema>;

export type PropertyFilters = { q?: string; status?: string; type?: string; availability?: string; featured?: string; sort?: string; page?: number; perPage?: number };
const SORTS: Record<string, string> = {
  updated: 'p.updated_at DESC', newest: 'p.id DESC', title: 'p.title ASC', price_asc: 'p.price_amount IS NULL, p.price_amount ASC', price_desc: 'p.price_amount DESC',
};
function filters(f: PropertyFilters) {
  const w: string[] = [];
  const p: unknown[] = [];
  if (f.q) { const l = `%${f.q.replace(/[%_]/g, '\\$&')}%`; w.push('(p.title LIKE ? OR p.location LIKE ? OR p.slug LIKE ?)'); p.push(l, l, l); }
  if (f.status === 'draft' || f.status === 'published') { w.push('p.status = ?'); p.push(f.status); }
  if (f.type) { w.push('p.property_type = ?'); p.push(f.type); }
  if (f.availability) { w.push('p.availability = ?'); p.push(f.availability); }
  if (f.featured === '1') w.push('p.is_featured = 1');
  return { where: w.length ? `WHERE ${w.join(' AND ')}` : '', params: p };
}

export async function listProperties(f: PropertyFilters) {
  const { where, params } = filters(f);
  const perPage = Math.min(100, Math.max(5, f.perPage ?? 20));
  const page = Math.max(1, f.page ?? 1);
  const total = Number((await one<{ n: number }>(`SELECT COUNT(*) n FROM properties p ${where}`, params))?.n ?? 0);
  const rows = await all(
    `SELECT p.id, p.slug, p.title, p.location, p.property_type, p.availability, p.is_featured, p.status, p.price_amount, p.price_label, p.updated_at, p.main_image_id,
            pg.path, (SELECT COUNT(*) FROM property_images i WHERE i.property_id = p.id) AS image_count,
            (SELECT COUNT(*) FROM inquiries q WHERE q.property_id = p.id) AS inquiry_count
       FROM properties p LEFT JOIN pages pg ON pg.property_id = p.id ${where}
      ORDER BY ${SORTS[f.sort ?? 'updated'] ?? SORTS.updated} LIMIT ? OFFSET ?`,
    [...params, perPage, (page - 1) * perPage],
  );
  return { rows, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function exportProperties(f: PropertyFilters) {
  const { where, params } = filters(f);
  return all(
    `SELECT p.id, p.title, p.slug, p.status, p.is_featured, p.property_type, c.name AS category, p.developer, p.location, p.address, p.price_amount, p.price_label,
            p.area, p.area_unit, p.bedrooms, p.bathrooms, p.availability, pg.path AS url, p.updated_at
       FROM properties p LEFT JOIN property_categories c ON c.id = p.category_id LEFT JOIN pages pg ON pg.property_id = p.id ${where} ORDER BY p.title`,
    params,
  );
}

export async function getPropertyForEdit(id: number) {
  const p = await one<any>('SELECT p.*, pg.id AS page_id, pg.path AS page_path FROM properties p LEFT JOIN pages pg ON pg.property_id = p.id WHERE p.id = ?', [id]);
  if (!p) return null;
  const [images, amenities, specs] = await Promise.all([
    all('SELECT media_id, caption, category, shape FROM property_images WHERE property_id = ? ORDER BY position, media_id', [id]),
    all('SELECT name, icon, media_id FROM property_amenities WHERE property_id = ? ORDER BY position, id', [id]),
    all('SELECT label, value FROM property_specs WHERE property_id = ? ORDER BY position, id', [id]),
  ]);
  return { ...p, is_featured: !!p.is_featured, images, amenities, specs };
}

async function uniqueSlug(base: string, exceptId = 0, c?: any) {
  let s = base;
  for (let i = 2; await one('SELECT id FROM properties WHERE slug = ? AND id <> ?', [s, exceptId], c); i++) s = `${base}-${i}`;
  return s;
}

async function pathFree(path: string, exceptPropertyId: number, c?: any) {
  const row = await one<{ property_id: number | null }>('SELECT property_id FROM pages WHERE path = ?', [path], c);
  return !row || row.property_id === exceptPropertyId;
}

/** Default sections for a new property's page — all reference the property itself. */
function defaultSections(propertyId: number, title: string) {
  return [
    ['property_overview', 'Overview', SECTION_SCHEMAS.property_overview.parse({ eyebrow: 'Overview', title, show_stats: false })],
    ['gallery', 'Gallery', SECTION_SCHEMAS.gallery.parse({ eyebrow: 'Gallery', title: 'Inside *' + title + '*', source: 'property', property_id: propertyId })],
    ['amenities', 'Amenities', SECTION_SCHEMAS.amenities.parse({ eyebrow: 'Facilities', title: 'Amenities', source: 'property', property_id: propertyId })],
    ['contact', 'Contact', SECTION_SCHEMAS.contact.parse({ eyebrow: 'Enquire', title: 'Schedule a *visit*', card_title: 'Send us a message', show_map: true })],
  ] as const;
}

export async function createProperty(title: string, userId: number) {
  return tx(async (c) => {
    const slug = await uniqueSlug(slugify(title), 0, c);
    if (!(await pathFree(`/${slug}.html`, 0, c))) throw Object.assign(new Error('A page already uses this URL. Choose a different title.'), { status: 409 });
    const res = await run("INSERT INTO properties (slug, title, status, availability, property_type) VALUES (?, ?, 'draft', 'available', 'Commercial')", [slug, title], c);
    const page = await run("INSERT INTO pages (path, title, template, status, property_id, updated_by) VALUES (?, ?, 'property', 'draft', ?, ?)", [`/${slug}.html`, title, res.insertId, userId], c);
    for (const [i, [type, label, data]] of defaultSections(res.insertId, title).entries())
      await run('INSERT INTO page_sections (page_id, type, label, position, data) VALUES (?,?,?,?,?)', [page.insertId, type, label, i, JSON.stringify(data)], c);
    return res.insertId;
  });
}

export async function saveProperty(id: number, d: PropertyInput, userId: number) {
  const before = await one<{ status: string; slug: string }>('SELECT status, slug FROM properties WHERE id = ?', [id]);
  if (!before) return false;
  await tx(async (c) => {
    if (d.slug !== before.slug) {
      if (await one('SELECT id FROM properties WHERE slug = ? AND id <> ?', [d.slug, id], c)) throw Object.assign(new Error('Another property already uses this slug.'), { status: 409, fields: { slug: 'Already in use' } });
      if (!(await pathFree(`/${d.slug}.html`, id, c))) throw Object.assign(new Error('A page already uses this URL.'), { status: 409, fields: { slug: 'URL already used by a page' } });
    }
    await run(
      `UPDATE properties SET title=?, slug=?, tagline=?, summary=?, description=?, property_type=?, category_id=?, developer=?, location=?, address=?, latitude=?, longitude=?,
         price_amount=?, price_label=?, bedrooms=?, bathrooms=?, area=?, area_unit=?, availability=?, is_featured=?, status=?, main_image_id=?, seo_title=?, seo_description=?, og_image_id=?,
         published_at = IF(? = 'published', COALESCE(published_at, UTC_TIMESTAMP()), published_at) WHERE id=?`,
      [d.title, d.slug, d.tagline, d.summary, d.description, d.property_type, d.category_id, d.developer, d.location, d.address, d.latitude, d.longitude,
        d.price_amount, d.price_label, d.bedrooms, d.bathrooms, d.area, d.area_unit, d.availability, d.is_featured ? 1 : 0, d.status, d.main_image_id, d.seo_title, d.seo_description, d.og_image_id,
        d.status, id],
      c,
    );
    await run('DELETE FROM property_images WHERE property_id = ?', [id], c);
    const seen = new Set<number>();
    for (const [i, img] of d.images.entries()) {
      if (seen.has(img.media_id)) continue;
      seen.add(img.media_id);
      await run('INSERT INTO property_images (property_id, media_id, position, caption, category, shape) VALUES (?,?,?,?,?,?)', [id, img.media_id, i, img.caption, img.category, img.shape], c);
    }
    await run('DELETE FROM property_amenities WHERE property_id = ?', [id], c);
    for (const [i, a] of d.amenities.entries()) await run('INSERT INTO property_amenities (property_id, name, icon, media_id, position) VALUES (?,?,?,?,?)', [id, a.name, a.icon, a.media_id, i], c);
    await run('DELETE FROM property_specs WHERE property_id = ?', [id], c);
    for (const [i, s] of d.specs.entries()) await run('INSERT INTO property_specs (property_id, label, value, position) VALUES (?,?,?,?)', [id, s.label, s.value, i], c);
    // keep the companion page in sync
    const page = await one<{ id: number; path: string }>('SELECT id, path FROM pages WHERE property_id = ?', [id], c);
    if (page) {
      const newPath = d.slug === before.slug ? page.path : `/${d.slug}.html`;
      await run('UPDATE pages SET title = ?, path = ? WHERE id = ?', [d.title, newPath, page.id], c);
      if (newPath !== page.path) await run('UPDATE navigation_items SET url = ? WHERE url = ?', [newPath, page.path], c);
    } else {
      await run("INSERT INTO pages (path, title, template, status, property_id, updated_by) VALUES (?, ?, 'property', 'draft', ?, ?)", [`/${d.slug}.html`, d.title, id, userId], c);
    }
  });
  await syncPublication(id, d.status, userId);
  return true;
}

/** Property status drives its page: published → (re)publish page; draft → unpublish. */
export async function syncPublication(id: number, status: string, userId: number) {
  const page = await one<{ id: number; status: string }>('SELECT id, status FROM pages WHERE property_id = ?', [id]);
  if (!page) return purgePublicCache();
  if (status === 'published') await publishPage(page.id, userId);
  else if (page.status === 'published') await unpublishPage(page.id, userId);
  else await purgePublicCache();
}

export async function duplicateProperty(id: number, userId: number) {
  const src = await getPropertyForEdit(id);
  if (!src) return null;
  const newId = await createProperty(`${src.title} (copy)`, userId);
  const slug = (await one<{ slug: string }>('SELECT slug FROM properties WHERE id = ?', [newId]))!.slug;
  await saveProperty(newId, propertySchema.parse({
    ...src, title: `${src.title} (copy)`, slug, status: 'draft', is_featured: false,
    images: src.images, amenities: src.amenities, specs: src.specs,
  }), userId);
  // copy the source page's sections, retargeting property references
  const [srcPage, newPage] = await Promise.all([
    one<{ id: number }>('SELECT id FROM pages WHERE property_id = ?', [id]),
    one<{ id: number }>('SELECT id FROM pages WHERE property_id = ?', [newId]),
  ]);
  if (srcPage && newPage) {
    await run('DELETE FROM page_sections WHERE page_id = ?', [newPage.id]);
    const secs = await all('SELECT type, label, position, enabled, data FROM page_sections WHERE page_id = ?', [srcPage.id]);
    for (const s of secs) {
      const data = typeof s.data === 'string' ? JSON.parse(s.data) : s.data;
      if (data && data.property_id === id) data.property_id = newId;
      await run('INSERT INTO page_sections (page_id, type, label, position, enabled, data) VALUES (?,?,?,?,?,?)', [newPage.id, s.type, s.label, s.position, s.enabled, JSON.stringify(data)]);
    }
  }
  return newId;
}

export async function deleteProperty(id: number) {
  const res = await run('DELETE FROM properties WHERE id = ?', [id]); // companion page cascades
  await purgePublicCache();
  return res.affectedRows > 0;
}

export async function bulkProperties(ids: number[], action: 'publish' | 'unpublish' | 'feature' | 'unfeature' | 'delete', userId: number) {
  let n = 0;
  for (const id of ids) {
    if (action === 'delete') { if (await deleteProperty(id)) n++; continue; }
    if (action === 'feature' || action === 'unfeature') { n += (await run('UPDATE properties SET is_featured = ? WHERE id = ?', [action === 'feature' ? 1 : 0, id])).affectedRows; continue; }
    const status = action === 'publish' ? 'published' : 'draft';
    const r = await run(`UPDATE properties SET status = ?, published_at = IF(? = 'published', COALESCE(published_at, UTC_TIMESTAMP()), published_at) WHERE id = ?`, [status, status, id]);
    if (r.affectedRows) { n++; await syncPublication(id, status, userId); }
  }
  await purgePublicCache();
  return n;
}

export async function propertyTypes() {
  return (await all<{ t: string }>('SELECT DISTINCT property_type t FROM properties ORDER BY t')).map((r) => r.t);
}
export const categories = () => all<{ id: number; name: string }>('SELECT id, name FROM property_categories ORDER BY name');
