import type { APIRoute } from 'astro';
import { handle, json, requirePerm } from '../../../../server/http.ts';
import { listMedia, mediaDto } from '../../../../server/admin-media.ts';
import { storeUpload, MediaError } from '../../../../server/media.ts';
import { logActivity } from '../../../../server/activity.ts';

export const prerender = false;

export const GET: APIRoute = handle(async (ctx) => {
  requirePerm(ctx, 'media', 'read');
  const sp = ctx.url.searchParams;
  return json(await listMedia({ q: sp.get('q') ?? '', folder: sp.get('folder') ?? '', kind: sp.get('kind') ?? '', page: Number(sp.get('page') ?? 1), perPage: Number(sp.get('perPage') ?? 48), sort: sp.get('sort') ?? '' }));
});

export const POST: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'media', 'create');
  const form = await ctx.request.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return json({ error: 'Choose at least one file.' }, 400);
  if (files.length > 20) return json({ error: 'Upload up to 20 files at a time.' }, 400);
  const folder = String(form.get('folder') ?? 'general').replace(/[^\w-]/g, '').slice(0, 60) || 'general';
  const created = [];
  const errors: { name: string; error: string }[] = [];
  for (const f of files) {
    try {
      const m = await storeUpload(Buffer.from(await f.arrayBuffer()), f.name, { folder, alt: String(form.get('alt') ?? ''), userId: u.id });
      created.push(mediaDto(m));
    } catch (e) {
      errors.push({ name: f.name, error: e instanceof MediaError ? e.message : 'Could not process this file.' });
      if (!(e instanceof MediaError)) console.error('[media] upload failed', e);
    }
  }
  if (created.length) await logActivity(u.id, 'create', 'media', created.map((c) => c.id).join(','), `Uploaded ${created.length} file(s)`);
  return json({ created, errors }, created.length ? 201 : 400);
});
