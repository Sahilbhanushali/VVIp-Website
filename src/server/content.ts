/**
 * Public content repository: published page snapshots, previews, navigation,
 * articles and properties. Admin mutations live in the admin services.
 */
import type { PoolConnection } from 'mysql2/promise';
import { all, one, run, json, tx } from './db.ts';
import { getMediaMany, type Media } from './media.ts';
import { collectMediaIds, safeSection, type SectionType } from './sections.ts';
import { purgePublicCache } from './settings.ts';

export type PageTemplate = 'home' | 'property' | 'article' | 'legal' | 'standard';

export type PageFields = {
  id: number;
  path: string;
  title: string;
  template: PageTemplate;
  visibility: 'public' | 'hidden';
  property_id: number | null;
  excerpt: string | null;
  body: string | null;
  cover_media_id: number | null;
  cover_alt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_id: number | null;
  robots_index: boolean;
  robots_follow: boolean;
  display_date: string | null;
  updated_at: string;
};
export type SectionSnapshot = { id: number; type: SectionType; label: string | null; data: any };
export type PageSnapshot = { page: PageFields; sections: SectionSnapshot[] };

const PAGE_COLS =
  'id, path, title, template, visibility, property_id, excerpt, body, cover_media_id, cover_alt, seo_title, seo_description, seo_keywords, canonical_url, og_title, og_description, og_image_id, robots_index, robots_follow, display_date, updated_at';

function normalisePage(r: any): PageFields {
  return {
    ...r,
    robots_index: !!r.robots_index,
    robots_follow: !!r.robots_follow,
    display_date: r.display_date ? new Date(r.display_date).toISOString().slice(0, 10) : null,
    updated_at: new Date(r.updated_at).toISOString(),
  };
}

/** Build a snapshot from the working copy (enabled sections only). */
export async function buildSnapshot(pageId: number, conn?: PoolConnection): Promise<PageSnapshot | null> {
  const page = await one(`SELECT ${PAGE_COLS} FROM pages WHERE id = ?`, [pageId], conn);
  if (!page) return null;
  const rows = await all('SELECT id, type, label, data FROM page_sections WHERE page_id = ? AND enabled = 1 ORDER BY position, id', [pageId], conn);
  const sections: SectionSnapshot[] = [];
  for (const r of rows) {
    const data = safeSection(r.type, json(r.data, {}));
    if (data) sections.push({ id: r.id, type: r.type, label: r.label, data });
  }
  return { page: normalisePage(page), sections };
}

/** Candidate paths for a request: /x, /x.html and the home aliases. */
export function pathCandidates(pathname: string): string[] {
  let p = decodeURIComponent(pathname).replace(/\/{2,}/g, '/');
  if (p === '' || p === '/index.html' || p === '/index') p = '/';
  const out = new Set([p]);
  if (p !== '/') {
    if (p.endsWith('/')) out.add(p.slice(0, -1));
    if (p.endsWith('.html')) out.add(p.slice(0, -5));
    else out.add(`${p.replace(/\/$/, '')}.html`);
  }
  return [...out];
}

export async function getPublishedByPath(pathname: string): Promise<(PageSnapshot & { status: 'published' }) | null> {
  const cands = pathCandidates(pathname);
  const row = await one(
    `SELECT r.snapshot, p.path FROM pages p JOIN page_revisions r ON r.id = p.published_revision_id
      WHERE p.status = 'published' AND p.path IN (${cands.map(() => '?').join(',')}) ORDER BY FIELD(p.path, ${cands.map(() => '?').join(',')}) LIMIT 1`,
    [...cands, ...cands],
  );
  if (!row) return null;
  return { ...json<PageSnapshot>(row.snapshot, null as any), status: 'published' };
}

export async function getPageIdByPath(pathname: string): Promise<number | null> {
  const cands = pathCandidates(pathname);
  const row = await one<{ id: number }>(`SELECT id FROM pages WHERE path IN (${cands.map(() => '?').join(',')}) LIMIT 1`, cands);
  return row?.id ?? null;
}

export async function publishPage(pageId: number, userId: number | null) {
  await tx(async (c) => {
    const snap = await buildSnapshot(pageId, c);
    if (!snap) throw new Error('Page not found');
    const rev = await run('INSERT INTO page_revisions (page_id, snapshot, published_by) VALUES (?,?,?)', [pageId, JSON.stringify(snap), userId], c);
    await run(
      "UPDATE pages SET status='published', published_revision_id=?, published_at=COALESCE(published_at, UTC_TIMESTAMP()), updated_by=? WHERE id=?",
      [rev.insertId, userId, pageId],
      c,
    );
    // keep the last 30 revisions per page
    await run(
      'DELETE FROM page_revisions WHERE page_id = ? AND id NOT IN (SELECT id FROM (SELECT id FROM page_revisions WHERE page_id = ? ORDER BY id DESC LIMIT 30) t)',
      [pageId, pageId],
      c,
    );
  });
  await purgePublicCache();
}

export async function unpublishPage(pageId: number, userId: number | null) {
  await run("UPDATE pages SET status='draft', updated_by=? WHERE id=?", [userId, pageId]);
  await purgePublicCache();
}

/* ───────────────────────── Navigation ───────────────────────── */
export type NavItem = { id: number; label: string; url: string; new_tab: boolean; dropdown: 'none' | 'articles' | 'properties'; children: NavItem[] };

export async function getNavigation(location: 'header' | 'footer' | 'legal'): Promise<NavItem[]> {
  const rows = await all(
    'SELECT id, parent_id, label, url, new_tab, dropdown FROM navigation_items WHERE location = ? AND enabled = 1 ORDER BY position, id',
    [location],
  );
  const map = new Map<number, NavItem>();
  rows.forEach((r) => map.set(r.id, { id: r.id, label: r.label, url: r.url, new_tab: !!r.new_tab, dropdown: r.dropdown, children: [] }));
  const roots: NavItem[] = [];
  rows.forEach((r) => (r.parent_id && map.get(r.parent_id) ? map.get(r.parent_id)!.children.push(map.get(r.id)!) : roots.push(map.get(r.id)!)));
  return roots;
}

/* ───────────────────────── Articles ───────────────────────── */
export type ArticleCard = { path: string; title: string; card_title: string; excerpt: string; date: string | null; cover: Media | null; cover_alt: string; minutes: number };

export async function listArticles(limit = 12, excludePath?: string): Promise<ArticleCard[]> {
  const rows = await all(
    `SELECT r.snapshot FROM pages p JOIN page_revisions r ON r.id = p.published_revision_id
      WHERE p.template = 'article' AND p.status = 'published' AND p.visibility = 'public' AND p.path <> ?
      ORDER BY p.sort_order, p.display_date DESC, p.id LIMIT ?`,
    [excludePath ?? '', limit],
  );
  const snaps = rows.map((r) => json<PageSnapshot>(r.snapshot, null as any)).filter(Boolean);
  const media = await getMediaMany(snaps.map((s) => s.page.cover_media_id ?? 0));
  return snaps.map((s) => ({
    path: s.page.path,
    title: s.page.title,
    card_title: s.page.og_title || s.page.title,
    excerpt: s.page.excerpt ?? '',
    date: s.page.display_date,
    cover: s.page.cover_media_id ? media.get(s.page.cover_media_id) ?? null : null,
    cover_alt: s.page.cover_alt ?? '',
    minutes: readingTime(s.page.body ?? ''),
  }));
}

export function readingTime(md: string) {
  const words = md.replace(/[#>*_`!\[\]()-]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

/* ───────────────────────── Properties ───────────────────────── */
export type PropertyFull = {
  id: number; slug: string; title: string; tagline: string | null; summary: string | null; description: string | null;
  property_type: string; category: string | null; developer: string | null; location: string | null; address: string | null;
  latitude: number | null; longitude: number | null; price_amount: number | null; price_label: string | null;
  bedrooms: number | null; bathrooms: number | null; area: number | null; area_unit: string;
  availability: 'available' | 'upcoming' | 'sold_out' | 'on_request'; is_featured: boolean; status: 'draft' | 'published';
  main_image: Media | null; seo_title: string | null; seo_description: string | null; og_image: Media | null;
  images: Array<{ media: Media; caption: string | null; category: string | null; shape: 'std' | 'wide' | 'tall' }>;
  amenities: Array<{ name: string; icon: string | null; media: Media | null }>;
  specs: Array<{ label: string; value: string }>;
  url: string;
  updated_at: string;
};

export const AVAILABILITY_LABEL: Record<PropertyFull['availability'], string> = {
  available: 'Available', upcoming: 'Upcoming', sold_out: 'Sold out', on_request: 'On request',
};

export async function getProperty(id: number, opts: { publishedOnly?: boolean } = {}): Promise<PropertyFull | null> {
  const p = await one<any>(
    `SELECT p.*, c.name AS category, pg.path AS page_path FROM properties p
       LEFT JOIN property_categories c ON c.id = p.category_id
       LEFT JOIN pages pg ON pg.property_id = p.id
      WHERE p.id = ? ${opts.publishedOnly ? "AND p.status = 'published'" : ''}`,
    [id],
  );
  if (!p) return null;
  const [imgs, amen, specs] = await Promise.all([
    all('SELECT media_id, caption, category, shape FROM property_images WHERE property_id = ? ORDER BY position, media_id', [id]),
    all('SELECT name, icon, media_id FROM property_amenities WHERE property_id = ? ORDER BY position, id', [id]),
    all<{ label: string; value: string }>('SELECT label, value FROM property_specs WHERE property_id = ? ORDER BY position, id', [id]),
  ]);
  const media = await getMediaMany([p.main_image_id, p.og_image_id, ...imgs.map((i) => i.media_id), ...amen.map((a) => a.media_id)]);
  return {
    ...p,
    is_featured: !!p.is_featured,
    main_image: media.get(p.main_image_id) ?? null,
    og_image: media.get(p.og_image_id) ?? null,
    images: imgs.filter((i) => media.has(i.media_id)).map((i) => ({ media: media.get(i.media_id)!, caption: i.caption, category: i.category, shape: i.shape })),
    amenities: amen.map((a) => ({ name: a.name, icon: a.icon, media: a.media_id ? media.get(a.media_id) ?? null : null })),
    specs,
    url: p.page_path ?? `/${p.slug}.html`,
    updated_at: new Date(p.updated_at).toISOString(),
  };
}

export type PropertyCard = Pick<PropertyFull, 'id' | 'slug' | 'title' | 'tagline' | 'summary' | 'property_type' | 'category' | 'location' | 'price_label' | 'price_amount' | 'availability' | 'is_featured' | 'area' | 'area_unit' | 'bedrooms' | 'bathrooms' | 'main_image' | 'url'>;

export async function listPublishedProperties(opts: { featuredOnly?: boolean } = {}): Promise<PropertyCard[]> {
  const rows = await all(
    `SELECT p.id, p.slug, p.title, p.tagline, p.summary, p.property_type, c.name AS category, p.location, p.price_label, p.price_amount,
            p.availability, p.is_featured, p.area, p.area_unit, p.bedrooms, p.bathrooms, p.main_image_id, pg.path AS page_path
       FROM properties p LEFT JOIN property_categories c ON c.id = p.category_id
       LEFT JOIN pages pg ON pg.property_id = p.id
      WHERE p.status = 'published' ${opts.featuredOnly ? 'AND p.is_featured = 1' : ''}
      ORDER BY p.is_featured DESC, p.published_at DESC, p.id DESC`,
  );
  const media = await getMediaMany(rows.map((r) => r.main_image_id));
  return rows.map((r) => ({ ...r, is_featured: !!r.is_featured, main_image: media.get(r.main_image_id) ?? null, url: r.page_path ?? `/${r.slug}.html` })) as unknown as PropertyCard[];
}

/** Resolve every media id referenced by a snapshot's sections (and page fields). */
export async function mediaForSnapshot(snap: PageSnapshot): Promise<Map<number, Media>> {
  return getMediaMany([...collectMediaIds(snap.sections.map((s) => s.data)), snap.page.cover_media_id ?? 0, snap.page.og_image_id ?? 0]);
}
