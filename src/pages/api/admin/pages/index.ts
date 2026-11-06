import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { handle, json, readBody, requirePerm } from '../../../../server/http.ts';
import { listPagesAdmin, createPage, pathSchema } from '../../../../server/admin-pages.ts';
import { logActivity } from '../../../../server/activity.ts';

export const prerender = false;

export const GET: APIRoute = handle(async (ctx) => {
  requirePerm(ctx, 'pages', 'read');
  const sp = ctx.url.searchParams;
  return json({ items: await listPagesAdmin({ q: sp.get('q') ?? '', template: sp.get('template') ?? '', status: sp.get('status') ?? '' }) });
});

export const POST: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'pages', 'create');
  const b = z.object({ title: z.string().trim().min(1).max(200), path: pathSchema, template: z.enum(['standard', 'article', 'legal']) }).parse(await readBody(ctx.request));
  const id = await createPage(b, u.id);
  await logActivity(u.id, 'create', 'page', id, `Created ${b.template} “${b.title}”`);
  return json({ id }, 201);
});
