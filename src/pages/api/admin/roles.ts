/** PUT {role_id, permissions: ["module:action", …]} — Super Admin role is always full access. */
import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { handle, json, readBody, requirePerm } from '../../../server/http.ts';
import { all, one, run, tx } from '../../../server/db.ts';
import { logActivity } from '../../../server/activity.ts';

export const prerender = false;
export const PUT: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'users', 'manage');
  const b = z.object({ role_id: z.coerce.number().int().positive(), permissions: z.array(z.string().regex(/^[a-z_]+:[a-z]+$/)).max(200) }).parse(await readBody(ctx.request));
  const role = await one<{ slug: string; name: string }>('SELECT slug, name FROM roles WHERE id = ?', [b.role_id]);
  if (!role) return json({ error: 'Unknown role' }, 404);
  if (role.slug === 'super_admin') return json({ error: 'The Super Admin role always has every permission.' }, 400);
  const perms = await all<{ id: number; k: string }>("SELECT id, CONCAT(module, ':', action) k FROM permissions");
  const map = new Map(perms.map((p) => [p.k, p.id]));
  await tx(async (c) => {
    await run('DELETE FROM role_permissions WHERE role_id = ?', [b.role_id], c);
    for (const p of new Set(b.permissions)) if (map.has(p)) await run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?,?)', [b.role_id, map.get(p)], c);
  });
  await logActivity(u.id, 'update', 'role', b.role_id, `Changed permissions of ${role.name}`);
  return json({ ok: true });
});
