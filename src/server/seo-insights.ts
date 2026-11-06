/** SEO health checks computed from real CMS data. */
import { all } from './db.ts';
import { json } from './db.ts';
import { getSettings } from './settings.ts';

type Issue = { level: 'err' | 'warn' | 'info'; title: string; detail: string; href?: string };

export async function seoInsights() {
  const s = await getSettings();
  const pages = await all<any>(
    `SELECT p.id, p.path, p.title, p.template, p.status, p.visibility, p.seo_title, p.seo_description, p.excerpt, p.robots_index, p.body, p.cover_media_id, p.cover_alt, p.property_id,
            pr.seo_description AS prop_desc, pr.seo_title AS prop_title, pr.status AS prop_status
       FROM pages p LEFT JOIN properties pr ON pr.id = p.property_id`,
  );
  const live = pages.filter((p) => p.status === 'published' && (!p.property_id || p.prop_status === 'published'));
  const issues: Issue[] = [];
  const edit = (p: any) => `/admin/pages/${p.id}?tab=seo`;
  const titleOf = (p: any) => p.seo_title || p.prop_title || `${p.title} | ${s.seo.site_title}`;

  for (const p of live) {
    const desc = p.seo_description || p.prop_desc || p.excerpt;
    if (!p.seo_title && !p.prop_title) issues.push({ level: 'info', title: `No custom SEO title: ${p.title}`, detail: `Using “${titleOf(p)}”.`, href: edit(p) });
    if (!desc) issues.push({ level: 'warn', title: `Missing meta description: ${p.title}`, detail: 'Search engines will use the default description.', href: edit(p) });
    else if (desc.length > 170) issues.push({ level: 'info', title: `Long meta description: ${p.title}`, detail: `${desc.length} characters — Google shows about 160.`, href: edit(p) });
    if (titleOf(p).length > 70) issues.push({ level: 'info', title: `Long title: ${p.title}`, detail: `${titleOf(p).length} characters — may be truncated in results.`, href: edit(p) });
    if (!p.robots_index) issues.push({ level: 'warn', title: `Not indexable: ${p.title}`, detail: '“Allow indexing” is off for this published page.', href: edit(p) });
    if (p.template === 'article' && p.cover_media_id && !p.cover_alt) issues.push({ level: 'warn', title: `Cover image without alt text: ${p.title}`, detail: 'Add alt text in the Content tab.', href: `/admin/pages/${p.id}?tab=content` });
  }
  const byTitle = new Map<string, any[]>();
  live.forEach((p) => byTitle.set(titleOf(p).toLowerCase(), [...(byTitle.get(titleOf(p).toLowerCase()) ?? []), p]));
  for (const [, list] of byTitle) if (list.length > 1) issues.push({ level: 'err', title: `Duplicate title on ${list.length} pages`, detail: list.map((p) => p.path).join(', '), href: edit(list[1]) });

  // Images without alt text (library-level alt is the fallback everywhere)
  const missingAlt = await all<{ id: number; original_name: string }>("SELECT id, original_name FROM media WHERE kind = 'image' AND alt = '' ORDER BY id DESC LIMIT 50");
  if (missingAlt.length) issues.push({ level: 'warn', title: `${missingAlt.length} image${missingAlt.length === 1 ? '' : 's'} without alt text`, detail: missingAlt.slice(0, 6).map((m) => m.original_name).join(', ') + (missingAlt.length > 6 ? '…' : ''), href: '/admin/media?kind=missing_alt' });

  // Broken internal links: hrefs in published sections, articles and menus that match no live page.
  const livePaths = new Set(live.map((p) => p.path));
  livePaths.add('/'); livePaths.add('/index.html'); livePaths.add('/sitemap.xml'); livePaths.add('/robots.txt');
  const sources: { where: string; href: string; edit: string }[] = [];
  const revs = await all<any>("SELECT p.id, p.title, r.snapshot FROM pages p JOIN page_revisions r ON r.id = p.published_revision_id WHERE p.status = 'published'");
  for (const r of revs) {
    const snap = json<any>(r.snapshot, null);
    const text = JSON.stringify(snap?.sections ?? []);
    for (const m of text.matchAll(/"href":"(\/[^"#?]*)/g)) sources.push({ where: r.title, href: m[1], edit: `/admin/pages/${r.id}` });
    for (const m of String(snap?.page?.body ?? '').matchAll(/\]\((\/[^)#?\s]*)/g)) if (!m[1].startsWith('/media/')) sources.push({ where: r.title, href: m[1], edit: `/admin/pages/${r.id}?tab=content` });
  }
  for (const n of await all<any>('SELECT label, url FROM navigation_items WHERE enabled = 1')) if (n.url.startsWith('/')) sources.push({ where: `Menu “${n.label}”`, href: n.url.split('#')[0].split('?')[0], edit: '/admin/navigation' });
  const broken = sources.filter((x) => x.href && x.href !== '/' && !livePaths.has(x.href) && !livePaths.has(x.href.replace(/\.html$/, '')) && !livePaths.has(`${x.href}.html`));
  for (const b of broken.slice(0, 20)) issues.push({ level: 'err', title: `Broken internal link ${b.href}`, detail: `In ${b.where} — no published page has this URL.`, href: b.edit });

  if (!s.seo.allow_indexing) issues.unshift({ level: 'err', title: 'Search engines are blocked site-wide', detail: '“Allow indexing” is off in Global SEO; robots.txt disallows everything.' });
  if (!s.seo.sitemap_enabled) issues.push({ level: 'warn', title: 'Sitemap disabled', detail: 'Enable it so search engines discover all pages.' });

  const sitemapCount = live.filter((p) => p.visibility === 'public' && p.robots_index).length;
  const order = { err: 0, warn: 1, info: 2 };
  issues.sort((a, b) => order[a.level] - order[b.level]);
  return { issues, livePages: live.length, sitemapCount, linksChecked: sources.length, settings: s.seo };
}
