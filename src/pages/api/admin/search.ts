/** Global admin search — results filtered by the user's read permissions. */
import type { APIRoute } from 'astro';
import { handle, json } from '../../../server/http.ts';
import { all } from '../../../server/db.ts';
import { can } from '../../../server/permissions.ts';

export const prerender = false;
export const GET: APIRoute = handle(async (ctx) => {
  const u = ctx.locals.user!;
  const q = (ctx.url.searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q.length < 2) return json({ results: [] });
  const like = `%${q.replace(/[%_]/g, '\\$&')}%`;
  const out: { type: string; title: string; sub: string; href: string }[] = [];
  if (can(u.permissions, 'pages', 'read'))
    (await all('SELECT id, title, path, template FROM pages WHERE title LIKE ? OR path LIKE ? LIMIT 6', [like, like])).forEach((r) => out.push({ type: r.template === 'article' ? 'Article' : 'Page', title: r.title, sub: r.path, href: `/admin/pages/${r.id}` }));
  if (can(u.permissions, 'properties', 'read'))
    (await all('SELECT id, title, location FROM properties WHERE title LIKE ? OR location LIKE ? OR slug LIKE ? LIMIT 6', [like, like, like])).forEach((r) => out.push({ type: 'Property', title: r.title, sub: r.location ?? '', href: `/admin/properties/${r.id}` }));
  if (can(u.permissions, 'inquiries', 'read'))
    (await all('SELECT id, name, email, phone FROM inquiries WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? ORDER BY id DESC LIMIT 6', [like, like, like])).forEach((r) => out.push({ type: 'Inquiry', title: r.name, sub: `${r.email} · ${r.phone}`, href: `/admin/inquiries/${r.id}` }));
  if (can(u.permissions, 'media', 'read'))
    (await all('SELECT id, original_name, folder FROM media WHERE original_name LIKE ? OR alt LIKE ? ORDER BY id DESC LIMIT 6', [like, like])).forEach((r) => out.push({ type: 'Media', title: r.original_name, sub: r.folder, href: `/admin/media?open=${r.id}` }));
  return json({ results: out });
});
