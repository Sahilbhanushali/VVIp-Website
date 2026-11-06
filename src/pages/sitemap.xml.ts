/** Generated from published, indexable, public pages. */
import type { APIRoute } from 'astro';
import { all } from '../server/db.ts';
import { getSettings } from '../server/settings.ts';

export const prerender = false;
export const GET: APIRoute = async () => {
  const s = await getSettings();
  if (!s.seo.sitemap_enabled) return new Response('Sitemap disabled', { status: 404 });
  const base = s.seo.canonical_domain.replace(/\/$/, '');
  const rows = await all<{ path: string; template: string; updated_at: Date; display_date: Date | null }>(
    `SELECT p.path, p.template, r.created_at AS updated_at, p.display_date FROM pages p JOIN page_revisions r ON r.id = p.published_revision_id
      LEFT JOIN properties pr ON pr.id = p.property_id
      WHERE p.status = 'published' AND p.visibility = 'public' AND p.robots_index = 1 AND p.canonical_url IS NULL
        AND (p.property_id IS NULL OR pr.status = 'published')
      ORDER BY p.template = 'home' DESC, p.path`,
  );
  const prio: Record<string, string> = { home: '1.0', property: '0.9', standard: '0.8', article: '0.6', legal: '0.3' };
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows
  .map(
    (r) => `  <url>
    <loc>${base}${r.path}</loc>
    <lastmod>${new Date(r.updated_at).toISOString().slice(0, 10)}</lastmod>
    <changefreq>${r.template === 'home' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${prio[r.template] ?? '0.5'}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' } });
};
