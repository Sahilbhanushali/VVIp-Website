import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { handle, json, readBody, requirePerm } from '../../../server/http.ts';
import { renderMarkdown } from '../../../server/markdown.ts';

export const prerender = false;
export const POST: APIRoute = handle(async (ctx) => {
  requirePerm(ctx, 'pages', 'read');
  const { markdown } = z.object({ markdown: z.string().max(200_000) }).parse(await readBody(ctx.request));
  return json({ html: renderMarkdown(markdown) });
});
