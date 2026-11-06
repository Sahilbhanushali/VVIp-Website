import type { APIRoute } from 'astro';
import { csv, handle, requirePerm } from '../../../../server/http.ts';
import { exportProperties } from '../../../../server/admin-properties.ts';
import { logActivity } from '../../../../server/activity.ts';

export const prerender = false;
export const GET: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'properties', 'export');
  const sp = ctx.url.searchParams;
  const rows = await exportProperties({ q: sp.get('q') ?? '', status: sp.get('status') ?? '', type: sp.get('type') ?? '', availability: sp.get('availability') ?? '', featured: sp.get('featured') ?? '' });
  await logActivity(u.id, 'export', 'property', null, `Exported ${rows.length} properties`);
  return csv(rows, `properties-${new Date().toISOString().slice(0, 10)}.csv`);
});
