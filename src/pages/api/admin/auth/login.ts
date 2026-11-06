import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { login, cookieOptions, SESSION_COOKIE, SESSION_MAX_AGE } from '../../../../server/auth.ts';
import { logActivity } from '../../../../server/activity.ts';
import { clientIp, handle, json, readBody, sameOrigin } from '../../../../server/http.ts';

export const prerender = false;
const input = z.object({ email: z.string().trim().max(190), password: z.string().min(1).max(200) });

export const POST: APIRoute = handle(async (ctx) => {
  sameOrigin(ctx);
  const parsed = input.safeParse(await readBody(ctx.request));
  if (!parsed.success) return json({ error: 'Enter your email and password.' }, 400);
  const res = await login(parsed.data.email, parsed.data.password, clientIp(ctx), ctx.request.headers.get('user-agent') ?? '');
  if (!res.ok) return json({ error: res.error }, res.status);
  ctx.cookies.set(SESSION_COOKIE, res.token, cookieOptions(SESSION_MAX_AGE));
  await logActivity(res.user.id, 'login', 'auth', res.user.id, 'Signed in');
  return json({ ok: true });
});
