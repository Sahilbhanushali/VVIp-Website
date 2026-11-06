import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { handle, json, readBody, requirePerm } from '../../../server/http.ts';
import { run, tx } from '../../../server/db.ts';
import { purgePublicCache } from '../../../server/settings.ts';
import { logActivity } from '../../../server/activity.ts';

export const prerender = false;
const url = z.string().trim().min(1, 'Link required').max(255).refine((v) => /^(\/|#|https?:\/\/|tel:|mailto:)/.test(v), 'Use /path, #anchor, https://, tel: or mailto:');
const item = z.object({ label: z.string().trim().min(1, 'Label required').max(80), url, new_tab: z.boolean().default(false), enabled: z.boolean().default(true), dropdown: z.enum(['none', 'articles', 'properties']).default('none') });
const schema = z.object({
  location: z.enum(['header', 'footer', 'legal']),
  items: z.array(item.extend({ children: z.array(item).max(12).default([]) })).max(20),
});

export const PUT: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'navigation', 'update');
  const { location, items } = schema.parse(await readBody(ctx.request));
  await tx(async (c) => {
    await run('DELETE FROM navigation_items WHERE location = ?', [location], c);
    for (const [i, it] of items.entries()) {
      const r = await run('INSERT INTO navigation_items (location, label, url, position, enabled, new_tab, dropdown) VALUES (?,?,?,?,?,?,?)', [location, it.label, it.url, i, it.enabled ? 1 : 0, it.new_tab ? 1 : 0, location === 'header' ? it.dropdown : 'none'], c);
      if (location === 'header')
        for (const [j, ch] of it.children.entries())
          await run('INSERT INTO navigation_items (location, parent_id, label, url, position, enabled, new_tab) VALUES (?,?,?,?,?,?,?)', [location, r.insertId, ch.label, ch.url, j, ch.enabled ? 1 : 0, ch.new_tab ? 1 : 0], c);
    }
  });
  await purgePublicCache();
  await logActivity(u.id, 'update', 'navigation', location, `Updated the ${location} menu`);
  return json({ ok: true });
});
