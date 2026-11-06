/** Page actions: publish · unpublish · duplicate · restore · add-section · reorder */
import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { handle, json, readBody, requirePerm } from '../../../../../server/http.ts';
import { publishPage, unpublishPage } from '../../../../../server/content.ts';
import { duplicatePage, restoreRevision, addSection, reorderSections } from '../../../../../server/admin-pages.ts';
import { SECTION_SCHEMAS, type SectionType } from '../../../../../server/sections.ts';
import { logActivity } from '../../../../../server/activity.ts';
import { one } from '../../../../../server/db.ts';

export const prerender = false;

export const POST: APIRoute = handle(async (ctx) => {
  requirePerm(ctx, 'pages', 'read'); // never reveal whether a page exists to users without access
  const id = Number(ctx.params.id) || 0;
  const page = await one<{ title: string; property_id: number | null; template: string }>('SELECT title, property_id, template FROM pages WHERE id = ?', [id]);
  if (!page) return json({ error: 'Not found' }, 404);
  const body = await readBody(ctx.request);
  switch (ctx.params.action) {
    case 'publish': {
      const u = requirePerm(ctx, 'pages', 'publish');
      if (page.property_id) {
        const prop = await one<{ status: string }>('SELECT status FROM properties WHERE id = ?', [page.property_id]);
        if (prop?.status !== 'published') return json({ error: 'Publish the property first — its page goes live together with it.' }, 400);
      }
      await publishPage(id, u.id);
      await logActivity(u.id, 'publish', 'page', id, `Published “${page.title}”`);
      return json({ ok: true });
    }
    case 'unpublish': {
      const u = requirePerm(ctx, 'pages', 'publish');
      if (page.template === 'home') return json({ error: 'The homepage cannot be unpublished. Use maintenance mode in Settings to take the site offline.' }, 400);
      await unpublishPage(id, u.id);
      await logActivity(u.id, 'unpublish', 'page', id, `Unpublished “${page.title}”`);
      return json({ ok: true });
    }
    case 'duplicate': {
      const u = requirePerm(ctx, 'pages', 'create');
      try {
        const newId = await duplicatePage(id, u.id);
        await logActivity(u.id, 'create', 'page', newId, `Duplicated “${page.title}”`);
        return json({ id: newId }, 201);
      } catch (e) {
        if ((e as { status?: number }).status === 400) return json({ error: (e as Error).message }, 400);
        throw e;
      }
    }
    case 'restore': {
      const u = requirePerm(ctx, 'pages', 'update');
      const { revision_id } = z.object({ revision_id: z.coerce.number().int().positive() }).parse(body);
      if (!(await restoreRevision(id, revision_id, u.id))) return json({ error: 'Revision not found' }, 404);
      await logActivity(u.id, 'update', 'page', id, `Restored a previous version of “${page.title}” (draft)`);
      return json({ ok: true });
    }
    case 'add-section': {
      const u = requirePerm(ctx, 'pages', 'update');
      const { type, after } = z.object({ type: z.string(), after: z.coerce.number().int().optional() }).parse(body);
      if (!(type in SECTION_SCHEMAS)) return json({ error: 'Unknown section type' }, 400);
      const sid = await addSection(id, type as SectionType, u.id, after);
      await logActivity(u.id, 'update', 'page', id, `Added a ${type.replace('_', ' ')} section to “${page.title}”`);
      return json({ id: sid }, 201);
    }
    case 'reorder': {
      const u = requirePerm(ctx, 'pages', 'update');
      const { ids } = z.object({ ids: z.array(z.coerce.number().int().positive()).max(100) }).parse(body);
      try { await reorderSections(id, ids, u.id); } catch (e) { if ((e as { status?: number }).status === 409) return json({ error: (e as Error).message }, 409); throw e; }
      return json({ ok: true });
    }
  }
  return json({ error: 'Unknown action' }, 404);
});
