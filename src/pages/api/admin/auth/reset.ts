import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { consumePasswordReset } from '../../../../server/auth.ts';
import { clientIp, handle, json, rateLimit, readBody, sameOrigin } from '../../../../server/http.ts';

export const prerender = false;
export const POST: APIRoute = handle(async (ctx) => {
  sameOrigin(ctx);
  if (!rateLimit('reset', clientIp(ctx), 10, 15 * 60_000)) return json({ error: 'Too many attempts. Try again later.' }, 429);
  const { token, password } = z.object({ token: z.string().max(100), password: z.string().max(200) }).parse(await readBody(ctx.request));
  const r = await consumePasswordReset(token, password);
  return r.ok ? json({ ok: true }) : json({ error: r.error }, 400);
});
