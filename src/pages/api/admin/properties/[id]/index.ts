import type { APIRoute } from 'astro';
import { handle, json, readBody, requirePerm } from '../../../../../server/http.ts';
import { getPropertyForEdit, propertySchema, saveProperty, deleteProperty, duplicateProperty } from '../../../../../server/admin-properties.ts';
import { can } from '../../../../../server/permissions.ts';
import { one } from '../../../../../server/db.ts';
import { logActivity } from '../../../../../server/activity.ts';

export const prerender = false;
const pid = (p: Record<string, string | undefined>) => Number(p.id) || 0;

export const GET: APIRoute = handle(async (ctx) => {
  requirePerm(ctx, 'properties', 'read');
  const p = await getPropertyForEdit(pid(ctx.params));
  return p ? json(p) : json({ error: 'Not found' }, 404);
});

export const PUT: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'properties', 'update');
  const id = pid(ctx.params);
  const d = propertySchema.parse(await readBody(ctx.request));
  const before = await one<{ status: string }>('SELECT status FROM properties WHERE id = ?', [id]);
  if (!before) return json({ error: 'Not found' }, 404);
  if (before.status !== d.status && !can(u.permissions, 'properties', 'publish'))
    return json({ error: 'You don’t have permission to publish or unpublish properties.' }, 403);
  try {
    await saveProperty(id, d, u.id);
  } catch (e) {
    const err = e as { status?: number; fields?: Record<string, string>; message: string };
    if (err.status === 409) return json({ error: err.message, fields: err.fields }, 409);
    throw e;
  }
  await logActivity(u.id, before.status !== d.status ? (d.status === 'published' ? 'publish' : 'unpublish') : 'update', 'property', id, `${before.status !== d.status ? (d.status === 'published' ? 'Published' : 'Unpublished') : 'Updated'} property “${d.title}”`);
  return json({ ok: true });
});

/** POST = duplicate */
export const POST: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'properties', 'create');
  const newId = await duplicateProperty(pid(ctx.params), u.id);
  if (!newId) return json({ error: 'Not found' }, 404);
  await logActivity(u.id, 'create', 'property', newId, `Duplicated property #${pid(ctx.params)}`);
  return json({ id: newId }, 201);
});

export const DELETE: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'properties', 'delete');
  const id = pid(ctx.params);
  const title = (await one<{ title: string }>('SELECT title FROM properties WHERE id = ?', [id]))?.title;
  if (!(await deleteProperty(id))) return json({ error: 'Not found' }, 404);
  await logActivity(u.id, 'delete', 'property', id, `Deleted property “${title}”`);
  return json({ ok: true });
});
