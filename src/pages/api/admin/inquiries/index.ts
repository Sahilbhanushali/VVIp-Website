import type { APIRoute } from 'astro';
import { handle, json, requirePerm } from '../../../../server/http.ts';
import { listInquiries } from '../../../../server/inquiries.ts';

export const prerender = false;
export const GET: APIRoute = handle(async (ctx) => {
  requirePerm(ctx, 'inquiries', 'read');
  const sp = ctx.url.searchParams;
  return json(await listInquiries({ q: sp.get('q') ?? '', status: sp.get('status') ?? '', property: Number(sp.get('property')) || undefined, from: sp.get('from') ?? '', to: sp.get('to') ?? '', page: Number(sp.get('page') ?? 1), sort: sp.get('sort') ?? 'newest' }));
});
