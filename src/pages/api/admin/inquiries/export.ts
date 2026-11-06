import type { APIRoute } from 'astro';
import { csv, handle, requirePerm } from '../../../../server/http.ts';
import { exportInquiries } from '../../../../server/inquiries.ts';
import { logActivity } from '../../../../server/activity.ts';

export const prerender = false;
export const GET: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'inquiries', 'export');
  const sp = ctx.url.searchParams;
  const rows = await exportInquiries({ q: sp.get('q') ?? '', status: sp.get('status') ?? '', property: Number(sp.get('property')) || undefined, from: sp.get('from') ?? '', to: sp.get('to') ?? '' });
  await logActivity(u.id, 'export', 'inquiry', null, `Exported ${rows.length} inquiries`);
  return csv(rows, `inquiries-${new Date().toISOString().slice(0, 10)}.csv`);
});
