/** First-party analytics beacon. Always answers 204; never blocks the page. */
import type { APIRoute } from 'astro';
import { trackPayload, ingest, isBot } from '../../server/analytics.ts';
import { getSettings } from '../../server/settings.ts';
import { clientIp, rateLimit, readBody } from '../../server/http.ts';

export const prerender = false;
const NO = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

export const POST: APIRoute = async (ctx) => {
  try {
    if (ctx.locals.user) return NO(); // exclude signed-in admins
    const ua = ctx.request.headers.get('user-agent') ?? '';
    if (isBot(ua) || ctx.request.headers.get('sec-purpose')?.includes('prefetch')) return NO();
    if (!rateLimit('track', clientIp(ctx), 240, 60_000)) return NO();
    const s = await getSettings();
    if (!s.analytics.enabled) return NO();
    const parsed = trackPayload.safeParse(await readBody(ctx.request));
    if (!parsed.success) return NO();
    await ingest(parsed.data, ua, ctx.url.hostname.replace(/^www\./, ''));
  } catch (e) {
    console.error('[track]', (e as Error).message);
  }
  return NO();
};
