import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { handle, json, readBody, requirePerm } from '../../../../server/http.ts';
import { updateSection, duplicateSection, deleteSection } from '../../../../server/admin-pages.ts';
import { logActivity } from '../../../../server/activity.ts';

export const prerender = false;
const sid = (p: Record<string, string | undefined>) => Number(p.id) || 0;

export const PUT: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'pages', 'update');
  const b = z.object({ label: z.string().max(120).nullable().optional(), enabled: z.boolean().optional(), data: z.unknown().optional() }).parse(await readBody(ctx.request));
  const pageId = await updateSection(sid(ctx.params), b, u.id);
  if (!pageId) return json({ error: 'Not found' }, 404);
  if (b.data !== undefined) await logActivity(u.id, 'update', 'section', sid(ctx.params), `Edited section #${sid(ctx.params)}`);
  return json({ ok: true });
});

export const POST: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'pages', 'update');
  const id = await duplicateSection(sid(ctx.params), u.id);
  return id ? json({ id }, 201) : json({ error: 'Not found' }, 404);
});

export const DELETE: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'pages', 'update');
  const pageId = await deleteSection(sid(ctx.params), u.id);
  if (!pageId) return json({ error: 'Not found' }, 404);
  await logActivity(u.id, 'delete', 'section', sid(ctx.params), `Deleted a section`);
  return json({ ok: true });
});
