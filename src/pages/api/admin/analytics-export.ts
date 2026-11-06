import type { APIRoute } from 'astro';
import { csv, handle, requirePerm } from '../../../server/http.ts';
import * as A from '../../../server/analytics.ts';

export const prerender = false;
export const GET: APIRoute = handle(async (ctx) => {
  requirePerm(ctx, 'analytics', 'export');
  const r = A.parseRange(ctx.url.searchParams);
  const report = ctx.url.searchParams.get('report') ?? 'daily';
  const rows: Record<string, unknown>[] =
    report === 'pages' ? await A.topPages(r, 500)
    : report === 'landing' ? await A.landingPages(r)
    : report === 'sources' ? (await A.sources(r)).map((x) => ({ source: x.k, sessions: x.n }))
    : report === 'referrers' ? (await A.referrers(r)).map((x) => ({ referrer: x.k, sessions: x.n }))
    : report === 'events' ? (await A.conversions(r)).labels
    : await A.dailySeries(r);
  return csv(rows, `analytics-${report}-${r.from.toISOString().slice(0, 10)}.csv`);
});
