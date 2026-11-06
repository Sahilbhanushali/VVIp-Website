import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { handle, json, readBody, requirePerm } from '../../../../server/http.ts';
import { hashPassword, passwordProblems } from '../../../../server/auth.ts';
import { one, run } from '../../../../server/db.ts';
import { logActivity } from '../../../../server/activity.ts';

export const prerender = false;
const superCount = async () => Number((await one<{ n: number }>("SELECT COUNT(*) n FROM admin_users u JOIN roles r ON r.id = u.role_id WHERE r.slug = 'super_admin' AND u.is_active = 1"))?.n ?? 0);

export const PUT: APIRoute = handle(async (ctx) => {
  const me = requirePerm(ctx, 'users', 'update');
  const id = Number(ctx.params.id) || 0;
  const b = z.object({ name: z.string().trim().min(2).max(120), role_id: z.coerce.number().int().positive(), is_active: z.coerce.boolean(), password: z.string().max(200).optional().default('') }).parse(await readBody(ctx.request));
  const target = await one<{ email: string; role_slug: string; is_active: number }>('SELECT u.email, r.slug role_slug, u.is_active FROM admin_users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?', [id]);
  if (!target) return json({ error: 'Not found' }, 404);
  const role = await one<{ slug: string }>('SELECT slug FROM roles WHERE id = ?', [b.role_id]);
  if (!role) return json({ error: 'Unknown role' }, 400);
  if ((role.slug === 'super_admin' || target.role_slug === 'super_admin') && me.role_slug !== 'super_admin') return json({ error: 'Only a Super Admin can change Super Admin accounts.' }, 403);
  if (id === me.id && (!b.is_active || role.slug !== me.role_slug)) return json({ error: 'You cannot deactivate yourself or change your own role.' }, 400);
  if (target.role_slug === 'super_admin' && (role.slug !== 'super_admin' || !b.is_active) && (await superCount()) <= 1) return json({ error: 'At least one active Super Admin must remain.' }, 400);
  if (b.password) {
    const problem = passwordProblems(b.password);
    if (problem) return json({ error: problem, fields: { password: problem } }, 422);
  }
  await run('UPDATE admin_users SET name=?, role_id=?, is_active=?, failed_attempts = IF(? = 1, 0, failed_attempts), locked_until = IF(? = 1, NULL, locked_until) WHERE id=?', [b.name, b.role_id, b.is_active ? 1 : 0, b.is_active ? 1 : 0, b.is_active ? 1 : 0, id]);
  if (b.password) await run('UPDATE admin_users SET password_hash = ?, password_changed_at = UTC_TIMESTAMP() WHERE id = ?', [await hashPassword(b.password), id]);
  if (!b.is_active || b.password || role.slug !== target.role_slug) await run('DELETE FROM admin_sessions WHERE user_id = ?', [id]); // force re-login with new rights
  await logActivity(me.id, 'update', 'user', id, `Updated user ${target.email}${b.password ? ' (password reset)' : ''}`);
  return json({ ok: true });
});

export const DELETE: APIRoute = handle(async (ctx) => {
  const me = requirePerm(ctx, 'users', 'delete');
  const id = Number(ctx.params.id) || 0;
  if (id === me.id) return json({ error: 'You cannot delete your own account.' }, 400);
  const t = await one<{ email: string; role_slug: string }>('SELECT u.email, r.slug role_slug FROM admin_users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?', [id]);
  if (!t) return json({ error: 'Not found' }, 404);
  if (t.role_slug === 'super_admin' && (me.role_slug !== 'super_admin' || (await superCount()) <= 1)) return json({ error: 'This Super Admin cannot be deleted.' }, 400);
  await run('DELETE FROM admin_users WHERE id = ?', [id]);
  await logActivity(me.id, 'delete', 'user', id, `Deleted user ${t.email}`);
  return json({ ok: true });
});
