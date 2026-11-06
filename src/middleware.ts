/**
 * Request pipeline:
 *  1. security headers on every response
 *  2. admin session → Astro.locals.user (only resolved when an admin cookie is present)
 *  3. /admin/* and /api/admin/* require a session; mutating admin API calls require the CSRF token
 *  4. maintenance mode for the public site (admins still see the site)
 *  5. in-memory cache for public HTML (purged on publish)
 */
import { defineMiddleware } from 'astro:middleware';
import { getSessionUser, SESSION_COOKIE } from './server/auth.ts';
import { getCached, setCached } from './server/cache.ts';
import { getSettings, syncCacheVersion } from './server/settings.ts';
import { safeEqual } from './server/crypto.ts';

const PUBLIC_ADMIN = new Set(['/admin/login', '/admin/forgot-password', '/admin/reset-password', '/api/admin/auth/login', '/api/admin/auth/forgot', '/api/admin/auth/reset']);
const isPublicPage = (p: string) => !p.startsWith('/admin') && !p.startsWith('/api/') && !p.startsWith('/media/') && !p.startsWith('/_astro/') && !/\.(xml|txt|webmanifest|ico|png|svg|webp|jpg|js|css|woff2)$/.test(p);

function secure(res: Response, path: string) {
  const h = res.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('X-Frame-Options', 'SAMEORIGIN');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
    h.set('Cache-Control', 'no-store');
    h.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  return res;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, request, cookies } = context;
  const path = url.pathname;
  const token = cookies.get(SESSION_COOKIE)?.value;
  context.locals.user = token ? await getSessionUser(token).catch(() => null) : null;

  /* ── Admin area ── */
  if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
    const user = context.locals.user;
    if (!user && !PUBLIC_ADMIN.has(path)) {
      if (path.startsWith('/api/')) return secure(Response.json({ error: 'Not signed in' }, { status: 401 }), path);
      return secure(context.redirect(`/admin/login?next=${encodeURIComponent(path + url.search)}`, 302), path);
    }
    if (user && path === '/admin/login') return secure(context.redirect('/admin', 302), path);
    if (path.startsWith('/api/admin') && !['GET', 'HEAD'].includes(request.method) && !PUBLIC_ADMIN.has(path)) {
      const sent = request.headers.get('x-csrf-token') ?? '';
      if (!user || !sent || !safeEqual(sent, user.csrf)) return secure(Response.json({ error: 'Invalid or missing CSRF token. Reload the page and try again.' }, { status: 403 }), path);
    }
    return secure(await next(), path);
  }

  if (!isPublicPage(path) || request.method !== 'GET') return secure(await next(), path);

  /* ── Public pages ── */
  const settings = await getSettings().catch(() => null);
  if (settings?.maintenance.enabled && !context.locals.user) {
    const msg = settings.maintenance.message.replace(/[<>&]/g, '');
    return secure(
      new Response(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${settings.site.name} — Back soon</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0d0c;color:#fff;font-family:Montserrat,Arial,sans-serif;text-align:center;padding:2rem}h1{font-weight:300;font-size:clamp(2rem,5vw,3.5rem);margin:0 0 1rem}p{color:rgba(255,255,255,.7);max-width:40ch;margin:auto}span{color:#bf7840;letter-spacing:.3em;font-size:.75rem;text-transform:uppercase}</style></head><body><main><span>${settings.site.name}</span><h1>Back soon</h1><p>${msg}</p></main></body></html>`,
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '3600' } },
      ),
      path,
    );
  }

  // Query strings (UTMs etc.) are rendered fresh. In development the cache is off so code edits show immediately.
  const cacheable = !import.meta.env.DEV && !url.searchParams.has('preview') && !url.search;
  const key = path;
  if (cacheable) {
    await syncCacheVersion().catch(() => {});
    const hit = getCached(key);
    if (hit) {
      const res = new Response(hit.body, { status: hit.status, headers: hit.headers });
      res.headers.set('X-Cache', 'HIT');
      return secure(res, path);
    }
  }
  const res = await next();
  const type = res.headers.get('content-type') ?? '';
  if (cacheable && (res.status === 200 || res.status === 404) && type.includes('text/html')) {
    const body = await res.text();
    const headers = [...res.headers.entries()].filter(([k]) => k !== 'set-cookie') as [string, string][];
    setCached(key, { body, headers, status: res.status });
    const out = new Response(body, { status: res.status, headers });
    out.headers.set('X-Cache', 'MISS');
    return secure(out, path);
  }
  return secure(res, path);
});
