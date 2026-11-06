import type { APIRoute } from 'astro';
import { getSettings } from '../server/settings.ts';

export const prerender = false;
export const GET: APIRoute = async () => {
  const s = await getSettings();
  const base = s.seo.canonical_domain.replace(/\/$/, '');
  // /admin is deliberately NOT disallowed: crawlers must be able to fetch it to see the
  // `X-Robots-Tag: noindex, nofollow` it always sends. A robots.txt block would hide that
  // header and let Google list the bare URL ("indexed, though blocked by robots.txt").
  const body = s.seo.allow_indexing
    ? `User-agent: *\nAllow: /\nDisallow: /api/\n${s.seo.sitemap_enabled ? `\nSitemap: ${base}/sitemap.xml\n` : ''}`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
