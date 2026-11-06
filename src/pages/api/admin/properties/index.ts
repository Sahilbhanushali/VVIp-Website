import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { handle, json, readBody, requirePerm } from '../../../../server/http.ts';
import { listProperties, createProperty } from '../../../../server/admin-properties.ts';
import { logActivity } from '../../../../server/activity.ts';

export const prerender = false;

export const GET: APIRoute = handle(async (ctx) => {
  requirePerm(ctx, 'properties', 'read');
  const sp = ctx.url.searchParams;
  return json(await listProperties({ q: sp.get('q') ?? '', status: sp.get('status') ?? '', type: sp.get('type') ?? '', availability: sp.get('availability') ?? '', featured: sp.get('featured') ?? '', sort: sp.get('sort') ?? '', page: Number(sp.get('page') ?? 1) }));
});

export const POST: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'properties', 'create');
  const { title } = z.object({ title: z.string().trim().min(2, 'Enter a title').max(160) }).parse(await readBody(ctx.request));
  try {
    const id = await createProperty(title, u.id);
    await logActivity(u.id, 'create', 'property', id, `Created property “${title}”`);
    return json({ id }, 201);
  } catch (e) {
    if ((e as { status?: number }).status === 409) return json({ error: (e as Error).message }, 409);
    throw e;
  }
});
