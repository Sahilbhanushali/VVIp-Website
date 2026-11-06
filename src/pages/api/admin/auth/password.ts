/** Change own password (requires the current one). Signs out other sessions. */
import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { hashPassword, passwordProblems, verifyPassword, destroyUserSessions } from '../../../../server/auth.ts';
import { one, run } from '../../../../server/db.ts';
import { logActivity } from '../../../../server/activity.ts';
import { handle, json, readBody } from '../../../../server/http.ts';

export const prerender = false;
export const POST: APIRoute = handle(async (ctx) => {
  const u = ctx.locals.user!;
  const b = z.object({ current: z.string().max(200), password: z.string().max(200), name: z.string().trim().min(2).max(120).optional() }).parse(await readBody(ctx.request));
  if (b.name && !b.password) {
    await run('UPDATE admin_users SET name = ? WHERE id = ?', [b.name, u.id]);
    return json({ ok: true });
  }
  const row = await one<{ password_hash: string }>('SELECT password_hash FROM admin_users WHERE id = ?', [u.id]);
  if (!row || !(await verifyPassword(row.password_hash, b.current))) return json({ error: 'Your current password is incorrect.', fields: { current: 'Incorrect password' } }, 400);
  const problem = passwordProblems(b.password);
  if (problem) return json({ error: problem, fields: { password: problem } }, 400);
  await run('UPDATE admin_users SET password_hash = ?, password_changed_at = UTC_TIMESTAMP() WHERE id = ?', [await hashPassword(b.password), u.id]);
  await destroyUserSessions(u.id, u.sessionId);
  await logActivity(u.id, 'update', 'account', u.id, 'Changed password');
  return json({ ok: true });
});
