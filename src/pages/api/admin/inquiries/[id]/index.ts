import type { APIRoute } from 'astro';
import { handle, json, readBody, requirePerm } from '../../../../../server/http.ts';
import { inquiryUpdate, updateInquiry } from '../../../../../server/inquiries.ts';
import { run } from '../../../../../server/db.ts';
import { logActivity } from '../../../../../server/activity.ts';

export const prerender = false;
const iid = (p: Record<string, string | undefined>) => Number(p.id) || 0;

export const PUT: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'inquiries', 'update');
  const d = inquiryUpdate.parse(await readBody(ctx.request));
  if (!(await updateInquiry(iid(ctx.params), d, u.id))) return json({ error: 'Not found' }, 404);
  await logActivity(u.id, 'update', 'inquiry', iid(ctx.params), `Updated inquiry from ${d.name} (${d.status})`);
  return json({ ok: true });
});

export const DELETE: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'inquiries', 'delete');
  const r = await run('DELETE FROM inquiries WHERE id = ?', [iid(ctx.params)]);
  if (!r.affectedRows) return json({ error: 'Not found' }, 404);
  await logActivity(u.id, 'delete', 'inquiry', iid(ctx.params), `Deleted inquiry #${iid(ctx.params)}`);
  return json({ ok: true });
});
