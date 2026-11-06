/** notes (POST {note}) · resend (POST) */
import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { handle, json, readBody, requirePerm } from '../../../../../server/http.ts';
import { resendNotification } from '../../../../../server/inquiries.ts';
import { one, run } from '../../../../../server/db.ts';

export const prerender = false;
export const POST: APIRoute = handle(async (ctx) => {
  const id = Number(ctx.params.id) || 0;
  if (!(await one('SELECT id FROM inquiries WHERE id = ?', [id]))) return json({ error: 'Not found' }, 404);
  if (ctx.params.action === 'notes') {
    const u = requirePerm(ctx, 'inquiries', 'update');
    const { note } = z.object({ note: z.string().trim().min(1, 'Write a note').max(5000) }).parse(await readBody(ctx.request));
    await run('INSERT INTO inquiry_notes (inquiry_id, user_id, note) VALUES (?,?,?)', [id, u.id, note]);
    return json({ ok: true }, 201);
  }
  if (ctx.params.action === 'resend') {
    requirePerm(ctx, 'inquiries', 'update');
    await resendNotification(id);
    const s = await one<{ email_status: string }>('SELECT email_status FROM inquiries WHERE id = ?', [id]);
    return s?.email_status === 'sent' ? json({ ok: true }) : json({ error: s?.email_status === 'disabled' ? 'Email is not configured (Settings → Email).' : 'Sending failed — check the SMTP settings and server log.' }, 502);
  }
  return json({ error: 'Unknown action' }, 404);
});
