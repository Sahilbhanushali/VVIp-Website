import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { handle, json, readBody, requirePerm } from '../../../../server/http.ts';
import { getMedia, deleteMedia, mediaUsage, storeUpload, MediaError } from '../../../../server/media.ts';
import { mediaDto } from '../../../../server/admin-media.ts';
import { run } from '../../../../server/db.ts';
import { purgePublicCache } from '../../../../server/settings.ts';
import { logActivity } from '../../../../server/activity.ts';

export const prerender = false;
const idOf = (p: Record<string, string | undefined>) => Number(p.id) || 0;

export const GET: APIRoute = handle(async (ctx) => {
  requirePerm(ctx, 'media', 'read');
  const m = await getMedia(idOf(ctx.params));
  if (!m) return json({ error: 'Not found' }, 404);
  return json({ ...mediaDto(m), usage: await mediaUsage(m.id) });
});

export const PUT: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'media', 'update');
  const id = idOf(ctx.params);
  const b = z.object({ alt: z.string().trim().max(255), description: z.string().trim().max(500).nullable().optional(), folder: z.string().trim().regex(/^[\w-]{1,60}$/, 'Letters, numbers, - and _ only') }).parse(await readBody(ctx.request));
  const res = await run('UPDATE media SET alt=?, description=?, folder=? WHERE id=?', [b.alt, b.description || null, b.folder, id]);
  if (!res.affectedRows) return json({ error: 'Not found' }, 404);
  await purgePublicCache();
  await logActivity(u.id, 'update', 'media', id, `Updated media #${id} details`);
  return json(mediaDto((await getMedia(id))!));
});

/** POST = replace the file (keeps the id, so every usage updates). */
export const POST: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'media', 'update');
  const id = idOf(ctx.params);
  const f = (await ctx.request.formData()).get('file');
  if (!(f instanceof File) || !f.size) return json({ error: 'Choose a file.' }, 400);
  try {
    const m = await storeUpload(Buffer.from(await f.arrayBuffer()), f.name, { replaceId: id, userId: u.id });
    await purgePublicCache();
    await logActivity(u.id, 'update', 'media', id, `Replaced file of media #${id}`);
    return json(mediaDto(m));
  } catch (e) {
    if (e instanceof MediaError) return json({ error: e.message }, 400);
    throw e;
  }
});

export const DELETE: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'media', 'delete');
  const id = idOf(ctx.params);
  const usage = await mediaUsage(id);
  if (usage.length) return json({ error: `This file is in use (${usage.slice(0, 3).join('; ')}${usage.length > 3 ? '…' : ''}). Remove it there first.`, usage }, 409);
  if (!(await deleteMedia(id))) return json({ error: 'Not found' }, 404);
  await logActivity(u.id, 'delete', 'media', id, `Deleted media #${id}`);
  return json({ ok: true });
});
