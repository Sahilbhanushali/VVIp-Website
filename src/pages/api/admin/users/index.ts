import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { handle, json, readBody, requirePerm } from '../../../../server/http.ts';
import { hashPassword, passwordProblems } from '../../../../server/auth.ts';
import { one, run } from '../../../../server/db.ts';
import { logActivity } from '../../../../server/activity.ts';

export const prerender = false;
export const POST: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'users', 'create');
  const b = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email().max(190), role_id: z.coerce.number().int().positive(), password: z.string().max(200) }).parse(await readBody(ctx.request));
  const problem = passwordProblems(b.password);
  if (problem) return json({ error: problem, fields: { password: problem } }, 422);
  const role = await one<{ slug: string }>('SELECT slug FROM roles WHERE id = ?', [b.role_id]);
  if (!role) return json({ error: 'Unknown role' }, 400);
  if (role.slug === 'super_admin' && u.role_slug !== 'super_admin') return json({ error: 'Only a Super Admin can create Super Admins.' }, 403);
  if (await one('SELECT id FROM admin_users WHERE email = ?', [b.email])) return json({ error: 'A user with this email already exists.', fields: { email: 'Already in use' } }, 409);
  const r = await run('INSERT INTO admin_users (name, email, role_id, password_hash) VALUES (?,?,?,?)', [b.name, b.email, b.role_id, await hashPassword(b.password)]);
  await logActivity(u.id, 'create', 'user', r.insertId, `Created user ${b.email} (${role.slug})`);
  return json({ id: r.insertId }, 201);
});
