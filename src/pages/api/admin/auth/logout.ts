import type { APIRoute } from 'astro';
import { destroySession, SESSION_COOKIE } from '../../../../server/auth.ts';
import { handle, json } from '../../../../server/http.ts';

export const prerender = false;
export const POST: APIRoute = handle(async (ctx) => {
  const u = ctx.locals.user;
  if (u) await destroySession(u.sessionId);
  ctx.cookies.delete(SESSION_COOKIE, { path: '/' });
  return json({ ok: true });
});
