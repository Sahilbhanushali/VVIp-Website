import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { handle, json, readBody, requirePerm } from '../../../../server/http.ts';
import { bulkProperties } from '../../../../server/admin-properties.ts';
import { logActivity } from '../../../../server/activity.ts';

export const prerender = false;
export const POST: APIRoute = handle(async (ctx) => {
  const { ids, action } = z.object({ ids: z.array(z.coerce.number().int().positive()).min(1).max(200), action: z.enum(['publish', 'unpublish', 'feature', 'unfeature', 'delete']) }).parse(await readBody(ctx.request));
  const u = requirePerm(ctx, 'properties', action === 'delete' ? 'delete' : action.endsWith('publish') ? 'publish' : 'update');
  const n = await bulkProperties(ids, action, u.id);
  await logActivity(u.id, action, 'property', ids.join(',').slice(0, 64), `Bulk ${action}: ${n} propert${n === 1 ? 'y' : 'ies'}`);
  return json({ ok: true, count: n });
});
