import type { APIRoute } from 'astro';
import { handle, json, readBody, requirePerm } from '../../../../../server/http.ts';
import { getPageAdmin, pageFieldsSchema, updatePageFields, deletePage } from '../../../../../server/admin-pages.ts';
import { logActivity } from '../../../../../server/activity.ts';
import { one } from '../../../../../server/db.ts';

export const prerender = false;
const pid = (p: Record<string, string | undefined>) => Number(p.id) || 0;

export const GET: APIRoute = handle(async (ctx) => {
  requirePerm(ctx, 'pages', 'read');
  const p = await getPageAdmin(pid(ctx.params));
  return p ? json(p) : json({ error: 'Not found' }, 404);
});

export const PUT: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'pages', 'update');
  const id = pid(ctx.params);
  const data = pageFieldsSchema.parse(await readBody(ctx.request));
  const clash = await one('SELECT id FROM pages WHERE path = ? AND id <> ?', [data.path, id]);
  if (clash) return json({ error: 'Another page already uses this path.', fields: { path: 'Already in use' } }, 409);
  try {
    if (!(await updatePageFields(id, data, u.id))) return json({ error: 'Not found' }, 404);
  } catch (e) {
    if ((e as { status?: number }).status === 400) return json({ error: (e as Error).message }, 400);
    throw e;
  }
  await logActivity(u.id, 'update', 'page', id, `Saved draft of “${data.title}”`);
  return json({ ok: true });
});

export const DELETE: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'pages', 'delete');
  const id = pid(ctx.params);
  const title = (await one<{ title: string }>('SELECT title FROM pages WHERE id = ?', [id]))?.title;
  const r = await deletePage(id);
  if (r === 'missing') return json({ error: 'Not found' }, 404);
  if (r === 'system') return json({ error: 'System pages (homepage, legal pages) cannot be deleted. Unpublish them instead.' }, 400);
  if (r === 'property') return json({ error: 'This page belongs to a property. Delete or unpublish the property instead.' }, 400);
  await logActivity(u.id, 'delete', 'page', id, `Deleted “${title}”`);
  return json({ ok: true });
});
