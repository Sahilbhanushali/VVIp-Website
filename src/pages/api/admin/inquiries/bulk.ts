import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { handle, json, readBody, requirePerm } from '../../../../server/http.ts';
import { INQUIRY_STATUSES } from '../../../../server/inquiries.ts';
import { all, run } from '../../../../server/db.ts';
import { logActivity } from '../../../../server/activity.ts';

export const prerender = false;
export const POST: APIRoute = handle(async (ctx) => {
  const b = z.object({ ids: z.array(z.coerce.number().int().positive()).min(1).max(500), action: z.enum(['status', 'delete']), status: z.enum(INQUIRY_STATUSES).optional() }).parse(await readBody(ctx.request));
  const u = requirePerm(ctx, 'inquiries', b.action === 'delete' ? 'delete' : 'update');
  const marks = b.ids.map(() => '?').join(',');
  if (b.action === 'delete') {
    const r = await run(`DELETE FROM inquiries WHERE id IN (${marks})`, b.ids);
    await logActivity(u.id, 'delete', 'inquiry', null, `Deleted ${r.affectedRows} inquiries`);
    return json({ count: r.affectedRows });
  }
  if (!b.status) return json({ error: 'Choose a status' }, 400);
  const before = await all<{ id: number; status: string }>(`SELECT id, status FROM inquiries WHERE id IN (${marks})`, b.ids);
  for (const row of before.filter((x) => x.status !== b.status))
    await run('INSERT INTO inquiry_history (inquiry_id, user_id, field, old_value, new_value) VALUES (?,?,?,?,?)', [row.id, u.id, 'status', row.status, b.status]);
  const r = await run(`UPDATE inquiries SET status = ? WHERE id IN (${marks})`, [b.status, ...b.ids]);
  await logActivity(u.id, 'update', 'inquiry', null, `Marked ${r.affectedRows} inquiries as ${b.status}`);
  return json({ count: r.affectedRows });
});
