import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { handle, json, readBody, requirePerm } from '../../../server/http.ts';
import { run } from '../../../server/db.ts';
import { slugify } from '../../../server/admin-properties.ts';

export const prerender = false;
export const POST: APIRoute = handle(async (ctx) => {
  requirePerm(ctx, 'properties', 'update');
  const { name } = z.object({ name: z.string().trim().min(2).max(80) }).parse(await readBody(ctx.request));
  const r = await run('INSERT INTO property_categories (name, slug) VALUES (?, ?)', [name, slugify(name)]);
  return json({ id: r.insertId, name }, 201);
});
